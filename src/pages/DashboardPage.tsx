import { useEffect, useMemo, useState } from "react";
import { MonthDayList } from "../components/MonthDayList";
import { MonthSelector } from "../components/MonthSelector";
import { SummaryCards } from "../components/SummaryCards";
import { deleteShift, fetchHolidays, fetchSettings, fetchShifts, removeHoliday, upsertHoliday, upsertShift } from "../services/api";
import { exportShiftsToExcel, exportShiftsToPdf } from "../services/export";
import { useAuth } from "../services/auth-context";
import type { HolidayType, ManualHoliday, ShiftInput, ShiftRecord, UserSettings } from "../types";
import { calculateSalary } from "../utils/calculateSalary";
import { combineDateAndTime, formatDate } from "../utils/date";

const selectedMonthStorageKey = "mertens-selected-month";

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function getMonthContextRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setDate(start.getDate() - 1);

  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function getMonthDates(date: Date) {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => formatDate(new Date(date.getFullYear(), date.getMonth(), index + 1)));
}

function getPreviousDate(date: string) {
  const previousDate = new Date(`${date}T00:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  return formatDate(previousDate);
}

function getInitialSelectedMonth() {
  if (typeof window === "undefined") {
    return new Date();
  }

  const storedMonth = window.localStorage.getItem(selectedMonthStorageKey);
  if (!storedMonth) {
    return new Date();
  }

  const [year, month] = storedMonth.split("-").map(Number);
  if (!year || !month) {
    return new Date();
  }

  return new Date(year, month - 1, 1);
}

export function DashboardPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(getInitialSelectedMonth);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    base_rate: 60,
    default_off_hours: 9,
    default_sick_hours: 9,
  });
  const [manualHolidays, setManualHolidays] = useState<ManualHoliday[]>([]);
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    const { start, end } = getMonthContextRange(selectedMonth);

    setLoadError("");

    Promise.all([fetchShifts(user.id, start, end), fetchSettings(user.id), fetchHolidays(user.id)])
      .then(([loadedShifts, loadedSettings, loadedHolidays]) => {
        setShifts(loadedShifts);
        setSettings(loadedSettings);
        setManualHolidays(
          loadedHolidays.map((holiday) => ({
            id: holiday.id,
            date: holiday.holiday_date,
            type: holiday.holiday_type ?? "full",
          })),
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load saved data for this account.";
        setLoadError(message);
        setShifts([]);
        setManualHolidays([]);
      });
  }, [selectedMonth, user]);

  const { start: visibleMonthStart, end: visibleMonthEnd } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const visibleShifts = useMemo(
    () => shifts.filter((shift) => shift.shift_date >= visibleMonthStart && shift.shift_date <= visibleMonthEnd),
    [shifts, visibleMonthEnd, visibleMonthStart],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      selectedMonthStorageKey,
      `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`,
    );
  }, [selectedMonth]);

  const shiftRows = useMemo(() => {
    const elapsedHoursByDate: Record<string, number> = {};
    const sickDates = new Set(shifts.filter((shift) => shift.day_type === "sick").map((shift) => shift.shift_date));

    return [...visibleShifts]
      .sort((left, right) => `${left.shift_date} ${left.start_time}`.localeCompare(`${right.shift_date} ${right.start_time}`))
      .map((shift) => {
        const elapsedHoursOffset = elapsedHoursByDate[shift.shift_date] ?? 0;
        const salary = calculateSalary(combineDateAndTime(shift.shift_date, shift.start_time), combineDateAndTime(shift.shift_date, shift.end_time), {
          baseRate: settings.base_rate,
          elapsedHoursOffset,
          isPaidSickDay: shift.day_type === "sick" && sickDates.has(getPreviousDate(shift.shift_date)),
          manualHolidays,
          dayType: shift.day_type,
        });

        elapsedHoursByDate[shift.shift_date] =
          elapsedHoursOffset + salary.breakdown.reduce((sum, item) => sum + item.hours, 0);

        return { shift, salary };
      });
  }, [manualHolidays, settings.base_rate, shifts, visibleShifts]);

  const monthTotal = shiftRows.reduce((sum, item) => sum + item.salary.total, 0);
  const monthHours = shiftRows.reduce(
    (sum, item) => sum + item.salary.breakdown.reduce((breakdownSum, breakdownItem) => breakdownSum + breakdownItem.hours, 0),
    0,
  );
  const monthWorkHours = shiftRows
    .filter((item) => item.shift.day_type === "work")
    .reduce((sum, item) => sum + item.salary.breakdown.reduce((breakdownSum, breakdownItem) => breakdownSum + breakdownItem.hours, 0), 0);
  const monthOffHours = shiftRows
    .filter((item) => item.shift.day_type === "off")
    .reduce((sum, item) => sum + item.salary.breakdown.reduce((breakdownSum, breakdownItem) => breakdownSum + breakdownItem.hours, 0), 0);
  const monthSickHours = shiftRows
    .filter((item) => item.shift.day_type === "sick")
    .reduce((sum, item) => sum + item.salary.breakdown.reduce((breakdownSum, breakdownItem) => breakdownSum + breakdownItem.hours, 0), 0);
  const monthLeaveHours = monthOffHours + monthSickHours;
  const monthWorkingDays = new Set(shiftRows.map((item) => item.shift.shift_date)).size;

  const monthRateSummaryMap = shiftRows.reduce<Record<string, number>>((summary, item) => {
    item.salary.breakdown.forEach((breakdownItem) => {
      const isHoliday150 = breakdownItem.base_category === "holiday_150";
      const isHoliday200 = breakdownItem.base_category === "holiday_200";
      const isOvertime150 = breakdownItem.overtime_category === "150";
      const appliedMultiplier = settings.base_rate > 0 ? Number((breakdownItem.rate / settings.base_rate).toFixed(2)) : 0;
      const isActualOvertime125 = appliedMultiplier === 1.25;

      if (!isActualOvertime125 && !isOvertime150 && !isHoliday150 && !isHoliday200 && breakdownItem.rate > 0) {
        summary["100%"] = Number(((summary["100%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (appliedMultiplier === 1.2) {
        summary["20%"] = Number(((summary["20%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (appliedMultiplier === 1.3) {
        summary["30%"] = Number(((summary["30%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (isOvertime150) {
        summary["150%"] = Number(((summary["150%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (isActualOvertime125) {
        summary["125%"] = Number(((summary["125%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (isHoliday150 && !isOvertime150) {
        summary["50%"] = Number(((summary["50%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }

      if (isHoliday200 && !isOvertime150) {
        summary["200%"] = Number(((summary["200%"] ?? 0) + breakdownItem.hours).toFixed(2));
      }
    });

    return summary;
  }, {});

  const monthRateSummary = ["100%", "20%", "30%", "50%", "125%", "150%", "200%"]
    .map((label) => ({ label, hours: monthRateSummaryMap[label] ?? 0 }))
    .filter((item) => item.hours > 0);

  const monthDates = useMemo(() => getMonthDates(selectedMonth), [selectedMonth]);

  async function handleSaveShift(shift: ShiftInput) {
    if (!user) {
      return;
    }

    const duplicate = shifts.find(
      (item) =>
        item.id !== editingShift?.id &&
        item.shift_date === shift.shift_date &&
        item.start_time === shift.start_time &&
        item.end_time === shift.end_time,
    );

    if (duplicate) {
      throw new Error("כבר קיימת משמרת עם אותם זמנים");
    }

    await upsertShift(user.id, editingShift ? { ...shift, id: editingShift.id } : shift);

    const { start, end } = getMonthContextRange(selectedMonth);
    const loadedShifts = await fetchShifts(user.id, start, end);
    setShifts(loadedShifts);
    setEditingShift(null);
  }

  async function handleDeleteShift(id: string) {
    if (!user) {
      return;
    }

    await deleteShift(id);
    const { start, end } = getMonthContextRange(selectedMonth);
    const loadedShifts = await fetchShifts(user.id, start, end);
    setShifts(loadedShifts);
  }

  async function handleHolidayChange(date: string, holidayType: HolidayType | "") {
    if (!user) {
      return;
    }

    const existingHoliday = manualHolidays.find((holiday) => holiday.date === date);
    const previousHolidays = manualHolidays;

    setManualHolidays((current) => {
      const withoutDate = current.filter((holiday) => holiday.date !== date);
      return holidayType ? [...withoutDate, { id: existingHoliday?.id, date, type: holidayType }] : withoutDate;
    });

    try {
      if (!holidayType) {
        if (existingHoliday?.id) {
          await removeHoliday(existingHoliday.id);
        }
      } else {
        await upsertHoliday(user.id, date, holidayType);
      }

      const loadedHolidays = await fetchHolidays(user.id);
      setManualHolidays(
        loadedHolidays.map((holiday) => ({
          id: holiday.id,
          date: holiday.holiday_date,
          type: holiday.holiday_type ?? "full",
        })),
      );
    } catch (error) {
      setManualHolidays(previousHolidays);
      throw error;
    }
  }

  return (
    <div className="stack">
      {loadError ? <div className="card warning-banner">{loadError}</div> : null}
      <SummaryCards
        total={monthTotal}
        hours={monthHours}
        workHours={monthWorkHours}
        leaveHours={monthLeaveHours}
        workingDays={monthWorkingDays}
        rateSummary={monthRateSummary}
      />
      <div className="dashboard-toolbar">
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
        <div className="dashboard-exports">
        <button
          onClick={() =>
            exportShiftsToExcel(shiftRows, selectedMonth, {
              total: monthTotal,
              hours: monthHours,
              workHours: monthWorkHours,
              leaveHours: monthLeaveHours,
              rateSummary: monthRateSummary,
            })
          }
        >
          ייצוא לאקסל
        </button>
        <button
          className="ghost-button"
          onClick={() =>
            exportShiftsToPdf(shiftRows, selectedMonth, {
              total: monthTotal,
              hours: monthHours,
              workHours: monthWorkHours,
              leaveHours: monthLeaveHours,
              rateSummary: monthRateSummary,
            })
          }
        >
          ייצוא ל-PDF
        </button>
        </div>
      </div>
      <MonthDayList
        dates={monthDates}
        items={shiftRows}
        settings={settings}
        manualHolidays={manualHolidays}
        editingShift={editingShift}
        editingShiftId={editingShift?.id ?? null}
        onCancelEdit={() => setEditingShift(null)}
        onHolidayChange={handleHolidayChange}
        onSubmit={handleSaveShift}
        onEdit={setEditingShift}
        onDelete={handleDeleteShift}
      />
    </div>
  );
}
