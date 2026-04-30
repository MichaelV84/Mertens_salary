import type { AppUser, HolidayRecord, HolidayType, ShiftInput, ShiftRecord, UserSettings } from "../types";
import { supabase } from "./supabase";

export async function fetchCurrentUserProfile(userId: string) {
  if (!supabase) {
    return null as AppUser | null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as AppUser | null;
}

export async function fetchShifts(userId: string, monthStart: string, monthEnd: string) {
  if (!supabase) {
    return [] as ShiftRecord[];
  }

  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .gte("shift_date", monthStart)
    .lte("shift_date", monthEnd)
    .order("shift_date")
    .order("start_time");

  if (error) {
    throw error;
  }

  return (data ?? []) as ShiftRecord[];
}

export async function upsertShift(userId: string, shift: ShiftInput) {
  if (!supabase) {
    return;
  }

  const payload = { ...shift, user_id: userId };
  const { error } = await supabase.from("shifts").upsert(payload);
  if (error) {
    throw error;
  }
}

export async function deleteShift(id: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function fetchSettings(userId: string) {
  if (!supabase) {
    return {
      base_rate: 60,
      default_off_hours: 9,
      default_sick_hours: 9,
      user_id: userId,
    } satisfies UserSettings;
  }

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? {
    base_rate: 60,
    default_off_hours: 9,
    default_sick_hours: 9,
    user_id: userId,
  }) as UserSettings;
}

export async function saveSettings(settings: UserSettings) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("settings").upsert(settings);
  if (error) {
    throw error;
  }
}

export async function fetchHolidays(userId: string) {
  if (!supabase) {
    return [] as HolidayRecord[];
  }

  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .eq("user_id", userId)
    .order("holiday_date");

  if (error) {
    throw error;
  }

  return (data ?? []) as HolidayRecord[];
}

export async function upsertHoliday(userId: string, holiday_date: string, holiday_type: HolidayType, label = "") {
  if (!supabase) {
    return;
  }

  const { data: existingHoliday, error: fetchError } = await supabase
    .from("holidays")
    .select("id")
    .eq("user_id", userId)
    .eq("holiday_date", holiday_date)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existingHoliday?.id) {
    const { error } = await supabase
      .from("holidays")
      .update({ holiday_type, label })
      .eq("id", existingHoliday.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("holidays")
    .insert({ user_id: userId, holiday_date, holiday_type, label });

  if (error) {
    throw error;
  }
}

export async function removeHoliday(id: string) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function fetchUsers() {
  if (!supabase) {
    return [] as AppUser[];
  }

  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  if (error) {
    throw error;
  }

  return (data ?? []) as AppUser[];
}

export async function updateUserBlocked(id: string, blocked: boolean) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("users").update({ blocked }).eq("id", id);
  if (error) {
    throw error;
  }
}
