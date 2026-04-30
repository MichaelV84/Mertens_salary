import type { HolidayType, ManualHoliday } from "../types";
import { formatDate } from "./date";

function getPreviousDate(date: string) {
  const previousDate = new Date(`${date}T00:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  return formatDate(previousDate);
}

export function getEffectiveHolidayType(date: string, manualHolidays: ManualHoliday[]): HolidayType | null {
  const exactHoliday = manualHolidays.find((holiday) => holiday.date === date);
  if (exactHoliday) {
    return exactHoliday.type;
  }

  const previousDayHoliday = manualHolidays.find((holiday) => holiday.date === getPreviousDate(date));
  if (previousDayHoliday?.type === "eve") {
    return "full";
  }

  if (previousDayHoliday?.type === "yom_kippur_eve") {
    return "yom_kippur_full";
  }

  return null;
}
