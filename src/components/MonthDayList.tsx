import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DayType, HolidayType, ManualHoliday, SalaryCalculationResult, ShiftInput, ShiftRecord, UserSettings } from "../types";
import { TimeInput } from "./TimeInput";

interface MonthDayListProps {
  dates: string[];
  items: Array<{ shift: ShiftRecord; salary: SalaryCalculationResult }>;
  settings: UserSettings;
  manualHolidays: ManualHoliday[];
  editingShift?: ShiftRecord | null;
  editingShiftId?: string | null;
  onCancelEdit: () => void;
  onHolidayChange: (date: string, holidayType: HolidayType | "") => Promise<void>;
  onSubmit: (shift: ShiftInput) => Promise<void>;
  onEdit: (shift: ShiftRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

const labels = {
  start: "\u05d4\u05ea\u05d7\u05dc\u05d4",
  end: "\u05e1\u05d9\u05d5\u05dd",
  type: "\u05e1\u05d5\u05d2",
  work: "\u05e2\u05d1\u05d5\u05d3\u05d4",
  sick: "\u05de\u05d7\u05dc\u05d4",
  off: "\u05d9\u05d5\u05dd \u05d7\u05d5\u05e4\u05e9",
  add: "\u05d4\u05d5\u05e1\u05e4\u05d4",
  save: "\u05e9\u05de\u05d9\u05e8\u05d4",
  cancel: "\u05d1\u05d9\u05d8\u05d5\u05dc",
  edit: "\u05e2\u05e8\u05d9\u05db\u05d4",
  editing: "\u05d1\u05e2\u05e8\u05d9\u05db\u05d4",
  delete: "\u05de\u05d7\u05d9\u05e7\u05d4",
  holidayRule: "\u05db\u05dc\u05dc \u05ea\u05e9\u05dc\u05d5\u05dd \u05dc\u05d7\u05d2",
  regularDay: "\u05d9\u05d5\u05dd \u05e8\u05d2\u05d9\u05dc",
  holidayEve: "\u05d7\u05d2 \u05db\u05de\u05d5 \u05d9\u05d5\u05dd \u05e9\u05d9\u05e9\u05d9",
  fullHoliday: "\u05d7\u05d2 \u05db\u05de\u05d5 \u05e9\u05d1\u05ea",
  yomKippurEve: "\u05d9\u05d5\u05dd \u05db\u05d9\u05e4\u05d5\u05e8 \u05d9\u05d5\u05dd \u05d0",
  yomKippurFull: "\u05d9\u05d5\u05dd \u05db\u05d9\u05e4\u05d5\u05e8 \u05d9\u05d5\u05dd \u05d1",
  fillTimes: "\u05de\u05dc\u05d0 \u05e9\u05e2\u05ea \u05d4\u05ea\u05d7\u05dc\u05d4 \u05d5\u05e9\u05e2\u05ea \u05e1\u05d9\u05d5\u05dd",
  invalidTime: "\u05d4\u05d6\u05df \u05e9\u05e2\u05d4 \u05d1\u05e4\u05d5\u05e8\u05de\u05d8 00:00 \u05e2\u05d3 23:59",
  saveError: "\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e9\u05de\u05d5\u05e8 \u05d0\u05ea \u05d4\u05de\u05e9\u05de\u05e8\u05ea",
  holidayError: "\u05d0\u05d9 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e9\u05de\u05d5\u05e8 \u05d0\u05ea \u05d4\u05d7\u05d2",
  holidaySchemaError:
    "\u05e6\u05e8\u05d9\u05da \u05dc\u05e2\u05d3\u05db\u05df \u05d0\u05ea Supabase \u05db\u05d3\u05d9 \u05dc\u05e9\u05de\u05d5\u05e8 \u05d0\u05ea \u05d9\u05d5\u05dd \u05db\u05d9\u05e4\u05d5\u05e8 \u05d9\u05d5\u05dd \u05d0/\u05d1",
  hours: "\u05e9\u05e2\u05d5\u05ea",
} as const;

function createDefaultShift(date: string): ShiftInput {
  return {
    shift_date: date,
    start_time: "07:30",
    end_time: "16:00",
    day_type: "work",
  };
}

function addHoursToTime(time: string, hours: number) {
  const [hour = "0", minute = "0"] = time.split(":");
  const totalMinutes = Number(hour) * 60 + Number(minute) + hours * 60;
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatWeekday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
  });
}

function getRowTimeRange(items: Array<{ shift: ShiftRecord; salary: SalaryCalculationResult }>) {
  if (!items.length) {
    return null;
  }

  const sortedItems = [...items].sort((left, right) =>
    `${left.shift.start_time}-${left.shift.end_time}`.localeCompare(`${right.shift.start_time}-${right.shift.end_time}`),
  );

  return {
    start: formatTime(sortedItems[0].shift.start_time),
    end: formatTime(sortedItems[sortedItems.length - 1].shift.end_time),
  };
}

function getHolidayLabel(holiday?: ManualHoliday) {
  if (!holiday) {
    return labels.regularDay;
  }

  if (holiday.type === "eve") {
    return labels.holidayEve;
  }

  if (holiday.type === "full") {
    return labels.fullHoliday;
  }

  if (holiday.type === "yom_kippur_eve") {
    return labels.yomKippurEve;
  }

  return labels.yomKippurFull;
}

function getDayTypeLabel(dayType: DayType) {
  if (dayType === "sick") {
    return labels.sick;
  }

  if (dayType === "off") {
    return labels.off;
  }

  return labels.work;
}

function getDayVisualType(dayItems: Array<{ shift: ShiftRecord; salary: SalaryCalculationResult }>, form: ShiftInput): DayType | "empty" {
  if (dayItems.length) {
    return dayItems[0].shift.day_type;
  }

  return form.day_type ?? "empty";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    String(error.code) === "23514" &&
    String(error.message).includes("holidays_holiday_type_check")
  ) {
    return labels.holidaySchemaError;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const details = "details" in error ? ` ${String(error.details)}` : "";
    const hint = "hint" in error ? ` ${String(error.hint)}` : "";
    const code = "code" in error ? ` (${String(error.code)})` : "";
    return `${String(error.message)}${details}${hint}${code}`;
  }

  return fallback;
}

export function MonthDayList({
  dates,
  items,
  settings,
  manualHolidays,
  editingShift,
  editingShiftId,
  onCancelEdit,
  onHolidayChange,
  onSubmit,
  onEdit,
  onDelete,
}: MonthDayListProps) {
  const [forms, setForms] = useState<Record<string, ShiftInput>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [holidayErrors, setHolidayErrors] = useState<Record<string, string>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const itemsByDate = useMemo(() => {
    return items.reduce<Record<string, Array<{ shift: ShiftRecord; salary: SalaryCalculationResult }>>>((groups, item) => {
      groups[item.shift.shift_date] = [...(groups[item.shift.shift_date] ?? []), item];
      return groups;
    }, {});
  }, [items]);

  useEffect(() => {
    if (!editingShift) {
      return;
    }

    setExpandedDate(editingShift.shift_date);
    setForms((current) => ({
      ...current,
      [editingShift.shift_date]: {
        ...editingShift,
        start_time: formatTime(editingShift.start_time),
        end_time: formatTime(editingShift.end_time),
      },
    }));
  }, [editingShift]);

  function getForm(date: string) {
    return forms[date] ?? createDefaultShift(date);
  }

  function updateForm(date: string, updater: ShiftInput | ((current: ShiftInput) => ShiftInput)) {
    setForms((current) => {
      const currentForm = current[date] ?? createDefaultShift(date);
      const nextForm = typeof updater === "function" ? updater(currentForm) : updater;
      return { ...current, [date]: nextForm };
    });
  }

  function updateDayType(date: string, dayType: DayType) {
    if (dayType === "sick") {
      updateForm(date, (form) => ({
        ...form,
        day_type: dayType,
        start_time: "07:30",
        end_time: addHoursToTime("07:30", settings.default_sick_hours),
      }));
      return;
    }

    if (dayType === "off") {
      updateForm(date, (form) => ({
        ...form,
        day_type: dayType,
        start_time: "07:30",
        end_time: addHoursToTime("07:30", settings.default_off_hours),
      }));
      return;
    }

    updateForm(date, (form) => ({ ...form, day_type: dayType }));
  }

  async function handleSubmit(event: FormEvent, date: string) {
    event.preventDefault();
    const form = getForm(date);
    setErrors((current) => ({ ...current, [date]: "" }));

    if (!form.start_time || !form.end_time) {
      setErrors((current) => ({ ...current, [date]: labels.fillTimes }));
      return;
    }

    if (
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(form.start_time) ||
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(form.end_time)
    ) {
      setErrors((current) => ({ ...current, [date]: labels.invalidTime }));
      return;
    }

    try {
      await onSubmit(form);
      updateForm(date, createDefaultShift(date));
    } catch (submitError) {
      setErrors((current) => ({
        ...current,
        [date]: getErrorMessage(submitError, labels.saveError),
      }));
    }
  }

  async function handleHolidaySelect(date: string, holidayType: HolidayType | "") {
    setHolidayErrors((current) => ({ ...current, [date]: "" }));

    try {
      await onHolidayChange(date, holidayType);
    } catch (error) {
      setHolidayErrors((current) => ({
        ...current,
        [date]: getErrorMessage(error, labels.holidayError),
      }));
    }
  }

  return (
    <div className="month-days">
      {dates.map((date) => {
        const dayItems = itemsByDate[date] ?? [];
        const rowTimeRange = getRowTimeRange(dayItems);
        const dayTotal = dayItems.reduce((sum, item) => sum + item.salary.total, 0);
        const dayHours = dayItems.reduce(
          (sum, item) => sum + item.salary.breakdown.reduce((breakdownSum, breakdownItem) => breakdownSum + breakdownItem.hours, 0),
          0,
        );
        const form = getForm(date);
        const visualDayType = getDayVisualType(dayItems, form);
        const manualHoliday = manualHolidays.find((holiday) => holiday.date === date);
        const isEditingDay = editingShift?.shift_date === date;
        const isExpanded = expandedDate === date;
        const rowClassName = [
          "compact-day-row",
          isExpanded ? "compact-day-row-open" : "",
          dayItems.length ? "worked-day-row" : "",
          visualDayType === "off" ? "off-day-row" : "",
          visualDayType === "sick" ? "sick-day-row" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const cardClassName = [
          "card",
          "compact-day-card",
          dayItems.length ? "worked-day-card" : "",
          visualDayType === "off" ? "off-day-card" : "",
          visualDayType === "sick" ? "sick-day-card" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <article key={date} className={cardClassName}>
            <button
              type="button"
              className={rowClassName}
              onClick={() => setExpandedDate((current) => (current === date ? null : date))}
            >
              <span className="compact-day-toggle">{isExpanded ? "−" : "+"}</span>
              <span className="compact-day-row-body">
                <span className="compact-day-row-top">
                  <span className="compact-day-row-value compact-day-row-date">{date}</span>
                  <span className="compact-day-row-value compact-day-row-weekday">{formatWeekday(date)}</span>
                </span>
                {dayItems.length ? (
                  <span className="compact-day-row-bottom">
                    <span className="compact-day-row-value compact-day-row-start">{rowTimeRange?.start ?? ""}</span>
                    <span className="compact-day-row-value compact-day-row-end">{rowTimeRange?.end ?? ""}</span>
                    <span className="compact-day-row-value compact-day-row-hours">{dayHours.toFixed(2)} {labels.hours}</span>
                  </span>
                ) : null}
              </span>
            </button>

            {isExpanded ? (
              <div className="expanded-day-panel">
                <div className="row space-between day-card-header">
                  <div>
                    <strong>{date}</strong>
                    <p className="muted">{formatDayLabel(date)}</p>
                    <p className="muted">{getHolidayLabel(manualHoliday)}</p>
                  </div>
                  <div className="day-total">
                    <span>{dayHours.toFixed(2)} {labels.hours}</span>
                    <strong>₪{dayTotal.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="field day-holiday-field">
                  <label>{labels.holidayRule}</label>
                  <select
                    value={manualHoliday?.type ?? ""}
                    onChange={(event) => void handleHolidaySelect(date, event.target.value as HolidayType | "")}
                  >
                    <option value="">{labels.regularDay}</option>
                    <option value="eve">{labels.holidayEve}</option>
                    <option value="full">{labels.fullHoliday}</option>
                    <option value="yom_kippur_eve">{labels.yomKippurEve}</option>
                    <option value="yom_kippur_full">{labels.yomKippurFull}</option>
                  </select>
                  {holidayErrors[date] ? <p className="error-text">{holidayErrors[date]}</p> : null}
                </div>

                {dayItems.length ? (
                  <div className="day-shifts">
                    {dayItems.map(({ shift, salary }) => {
                      const isEditing = editingShiftId === shift.id;

                      return (
                        <div key={shift.id} className={`day-shift${isEditing ? " editing-shift" : ""}`}>
                          <div className="row space-between">
                            <span className="shift-time-line">
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)} | {getDayTypeLabel(shift.day_type)}
                            </span>
                            <strong>₪{salary.total.toFixed(2)}</strong>
                          </div>
                          <div className="breakdown-list">
                            {salary.breakdown.map((item, index) => (
                              <div className="breakdown-row" key={`${shift.id}-${index}`}>
                                <span>{item.type}</span>
                                <span>
                                  {item.hours.toFixed(2)} {labels.hours} x ₪{item.rate.toFixed(2)} = ₪{item.amount.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="actions">
                            <button
                              type="button"
                              className={`ghost-button${isEditing ? " active-button" : ""}`}
                              onClick={() => onEdit(shift)}
                            >
                              {isEditing ? labels.editing : labels.edit}
                            </button>
                            <button type="button" className="ghost-button danger" onClick={() => void onDelete(shift.id)}>
                              {labels.delete}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <form className={`compact-day-form${isEditingDay ? " editing-entry" : ""}`} onSubmit={(event) => void handleSubmit(event, date)}>
                  <div className="compact-form-meta">
                    <strong className="compact-form-date">{date}</strong>
                    <span className="muted compact-form-weekday">{formatWeekday(date)}</span>
                  </div>
                  <div className="field compact-form-field">
                    <label>{labels.start}</label>
                    <TimeInput
                      value={form.start_time}
                      onChange={(value) => updateForm(date, (current) => ({ ...current, start_time: value }))}
                    />
                  </div>
                  <div className="field compact-form-field">
                    <label>{labels.end}</label>
                    <TimeInput
                      value={form.end_time}
                      onChange={(value) => updateForm(date, (current) => ({ ...current, end_time: value }))}
                    />
                  </div>
                  <div className="field compact-form-field">
                    <label>{labels.type}</label>
                    <select value={form.day_type} onChange={(event) => updateDayType(date, event.target.value as DayType)}>
                      <option value="work">{labels.work}</option>
                      <option value="sick">{labels.sick}</option>
                      <option value="off">{labels.off}</option>
                    </select>
                  </div>
                  <button type="submit" className="compact-submit-button">{isEditingDay ? labels.save : labels.add}</button>
                  {isEditingDay ? (
                    <button type="button" className="ghost-button compact-cancel-button" onClick={onCancelEdit}>
                      {labels.cancel}
                    </button>
                  ) : null}
                  {errors[date] ? <p className="error-text compact-form-error">{errors[date]}</p> : null}
                </form>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
