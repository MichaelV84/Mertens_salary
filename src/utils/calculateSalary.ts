import type { ManualHoliday, SalaryBreakdownItem, SalaryCalculationOptions, SalaryCalculationResult } from "../types";
import { minutesBetween } from "./date";
import { getEffectiveHolidayType } from "./holidays";

const DEFAULT_BASE_RATE = 60;
const REGULAR_HOURS_LIMIT = 9;
const SECOND_OVERTIME_LIMIT = 11;

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date: Date, days: number) {
  return addMinutes(date, days * 1440);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function formatDateForLookup(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextBoundary(date: Date, shiftStart: Date, elapsedHoursOffset: number) {
  const dayStart = startOfDay(date);
  const boundaries = [
    new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 7, 30),
    new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 16, 0),
    addDays(dayStart, 1),
    addMinutes(shiftStart, (REGULAR_HOURS_LIMIT - elapsedHoursOffset) * 60),
    addMinutes(shiftStart, (SECOND_OVERTIME_LIMIT - elapsedHoursOffset) * 60),
  ].sort((left, right) => left.getTime() - right.getTime());

  for (const boundary of boundaries) {
    if (boundary > date) {
      return boundary;
    }
  }

  return addDays(dayStart, 1);
}

function isWeekendWindow(date: Date) {
  const day = date.getDay();
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  if (day === 5 && totalMinutes >= 16 * 60) {
    return true;
  }

  if (day === 6) {
    return true;
  }

  if (day === 0 && totalMinutes < 7 * 60 + 30) {
    return true;
  }

  return false;
}

function isManualHolidayWindow(date: Date, manualHolidays: ManualHoliday[]) {
  const currentDateKey = formatDateForLookup(date);
  const effectiveType = getEffectiveHolidayType(currentDateKey, manualHolidays);

  if (!effectiveType) {
    const previousDay = addDays(startOfDay(date), -1);
    const previousDayType = getEffectiveHolidayType(formatDateForLookup(previousDay), manualHolidays);

    if (previousDayType !== "full" && previousDayType !== "yom_kippur_full") {
      return false;
    }

    const previousDayEnd = new Date(
      previousDay.getFullYear(),
      previousDay.getMonth(),
      previousDay.getDate() + 1,
      7,
      30,
    );

    return date >= previousDay && date < previousDayEnd;
  }

  const dayStart = startOfDay(date);

  if (effectiveType === "eve" || effectiveType === "yom_kippur_eve") {
    const holidayStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 16, 0);
    const holidayEnd = addDays(dayStart, 1);
    return date >= holidayStart && date < holidayEnd;
  }

  const holidayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1, 7, 30);
  return date >= dayStart && date < holidayEnd;
}

function getManualHolidayCategory(date: Date, manualHolidays: ManualHoliday[]) {
  const effectiveHolidayType = getEffectiveHolidayType(formatDateForLookup(date), manualHolidays);

  if (effectiveHolidayType === "yom_kippur_eve" || effectiveHolidayType === "yom_kippur_full") {
    return "holiday_200" as const;
  }

  if (effectiveHolidayType === "eve" || effectiveHolidayType === "full") {
    return "holiday_150" as const;
  }

  const previousDay = addDays(startOfDay(date), -1);
  const previousDayType = getEffectiveHolidayType(formatDateForLookup(previousDay), manualHolidays);

  if (previousDayType === "yom_kippur_full") {
    return "holiday_200" as const;
  }

  if (previousDayType === "full") {
    return "holiday_150" as const;
  }

  return null;
}

function getBaseLabelAndMultiplier(date: Date, manualHolidays: ManualHoliday[], treatAsHoliday: boolean) {
  if (treatAsHoliday) {
    return { label: "חג 150%", multiplier: 1.5, category: "holiday_150" as const };
  }

  if (isManualHolidayWindow(date, manualHolidays)) {
    if (getManualHolidayCategory(date, manualHolidays) === "holiday_200") {
      return { label: "יום כיפור 200%", multiplier: 2, category: "holiday_200" as const };
    }

    return { label: "חג 150%", multiplier: 1.5, category: "holiday_150" as const };
  }

  if (isWeekendWindow(date)) {
    return { label: "שבת 150%", multiplier: 1.5, category: "holiday_150" as const };
  }

  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 7 * 60 + 30 && minutes < 16 * 60) {
    return { label: "רגיל 100%", multiplier: 1, category: "regular" as const };
  }

  if (minutes >= 16 * 60) {
    return { label: "ערב 120%", multiplier: 1.2, category: "evening" as const };
  }

  return { label: "לילה 130%", multiplier: 1.3, category: "night" as const };
}

function getOvertimeMultiplier(elapsedHours: number) {
  if (elapsedHours >= SECOND_OVERTIME_LIMIT) {
    return 1.5;
  }

  if (elapsedHours >= REGULAR_HOURS_LIMIT) {
    return 1.25;
  }

  return 1;
}

function getAppliedLabel(baseLabel: string, baseMultiplier: number, overtimeMultiplier: number) {
  if (overtimeMultiplier <= 1 || baseMultiplier >= overtimeMultiplier) {
    return baseLabel;
  }

  if (overtimeMultiplier === 1.5) {
    return "שעות נוספות 150%";
  }

  if (overtimeMultiplier === 1.25) {
    return "שעות נוספות 125%";
  }

  return baseLabel;
}

function getOvertimeCategory(multiplier: number): "none" | "125" | "150" {
  if (multiplier === 1.5) {
    return "150";
  }

  if (multiplier === 1.25) {
    return "125";
  }

  return "none";
}

function pushBreakdown(breakdown: SalaryBreakdownItem[], item: SalaryBreakdownItem) {
  const lastItem = breakdown[breakdown.length - 1];

  if (
    lastItem &&
    lastItem.type === item.type &&
    lastItem.rate === item.rate &&
    lastItem.base_category === item.base_category &&
    lastItem.overtime_category === item.overtime_category
  ) {
    lastItem.hours += item.hours;
    lastItem.amount += item.amount;
    return;
  }

  breakdown.push(item);
}

function getFlatDayResult(start: Date, end: Date, baseRate: number, type: string, paid: boolean): SalaryCalculationResult {
  let adjustedEnd = end;
  if (adjustedEnd <= start) {
    adjustedEnd = addDays(adjustedEnd, 1);
  }

  const hours = Number((minutesBetween(start, adjustedEnd) / 60).toFixed(2));
  const rate = paid ? baseRate : 0;
  const amount = Number((hours * rate).toFixed(2));

  return {
    total: amount,
    breakdown: [
      {
        hours,
        rate,
        amount,
        type,
      },
    ],
  };
}

export function calculateSalary(
  start: Date,
  end: Date,
  options: SalaryCalculationOptions = {},
): SalaryCalculationResult {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("טווח תאריכים לא תקין");
  }

  let adjustedEnd = end;
  if (adjustedEnd <= start) {
    adjustedEnd = addDays(adjustedEnd, 1);
  }

  const baseRate = options.baseRate ?? DEFAULT_BASE_RATE;
  const elapsedHoursOffset = options.elapsedHoursOffset ?? 0;
  const treatAsHoliday = options.treatAsHoliday ?? false;
  const manualHolidays = options.manualHolidays ?? [];

  if (options.dayType === "off") {
    return getFlatDayResult(start, adjustedEnd, baseRate, "יום חופש 100%", true);
  }

  if (options.dayType === "sick") {
    return getFlatDayResult(
      start,
      adjustedEnd,
      baseRate,
      options.isPaidSickDay ? "מחלה 100%" : "מחלה - יום ראשון ללא תשלום",
      options.isPaidSickDay ?? false,
    );
  }

  const breakdown: SalaryBreakdownItem[] = [];
  let cursor = new Date(start);

  while (cursor < adjustedEnd) {
    const boundary = nextBoundary(cursor, start, elapsedHoursOffset);
    const segmentEnd = boundary < adjustedEnd ? boundary : adjustedEnd;
    const elapsedHours = elapsedHoursOffset + minutesBetween(start, cursor) / 60;
    const durationHours = minutesBetween(cursor, segmentEnd) / 60;
    const { label, multiplier: baseMultiplier, category: baseCategory } = getBaseLabelAndMultiplier(cursor, manualHolidays, treatAsHoliday);
    const overtimeMultiplier = getOvertimeMultiplier(elapsedHours);
    const appliedMultiplier = Math.max(baseMultiplier, overtimeMultiplier);
    const rate = baseRate * appliedMultiplier;
    const amount = rate * durationHours;
    const type = getAppliedLabel(label, baseMultiplier, overtimeMultiplier);
    const overtimeCategory = getOvertimeCategory(overtimeMultiplier);

    pushBreakdown(breakdown, {
      hours: Number(durationHours.toFixed(2)),
      rate: Number(rate.toFixed(2)),
      amount: Number(amount.toFixed(2)),
      type,
      base_category: baseCategory,
      overtime_category: overtimeCategory,
    });

    cursor = segmentEnd;
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return {
    total: Number(total.toFixed(2)),
    breakdown: breakdown.map((item) => ({
      ...item,
      hours: Number(item.hours.toFixed(2)),
      amount: Number(item.amount.toFixed(2)),
    })),
  };
}
