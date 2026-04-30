export type DayType = "work" | "sick" | "off";
export type HolidayType = "eve" | "full" | "yom_kippur_eve" | "yom_kippur_full";

export interface ManualHoliday {
  id?: string;
  date: string;
  type: HolidayType;
}

export interface SalaryBreakdownItem {
  hours: number;
  rate: number;
  amount: number;
  type: string;
  base_category?: "regular" | "evening" | "night" | "holiday_150" | "holiday_200";
  overtime_category?: "none" | "125" | "150";
}

export interface SalaryCalculationResult {
  total: number;
  breakdown: SalaryBreakdownItem[];
}

export interface SalaryCalculationOptions {
  baseRate?: number;
  dayType?: DayType;
  elapsedHoursOffset?: number;
  isPaidSickDay?: boolean;
  manualHolidays?: ManualHoliday[];
  treatAsHoliday?: boolean;
  now?: Date;
}

export interface ShiftInput {
  id?: string;
  user_id?: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  day_type: DayType;
  is_manual_holiday?: boolean;
  notes?: string | null;
}

export interface ShiftRecord extends ShiftInput {
  id: string;
  created_at?: string;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  base_rate: number;
  default_sick_hours: number;
  default_off_hours: number;
}

export interface HolidayRecord {
  id: string;
  user_id: string;
  holiday_date: string;
  holiday_type: HolidayType;
  label?: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  blocked: boolean;
  is_admin?: boolean;
  created_at: string;
}
