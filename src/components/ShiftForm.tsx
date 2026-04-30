import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { DayType, ShiftInput, ShiftRecord, UserSettings } from "../types";
import { formatDate } from "../utils/date";
import { TimeInput } from "./TimeInput";

interface ShiftFormProps {
  initial?: ShiftRecord | null;
  settings: UserSettings;
  onSubmit: (shift: ShiftInput) => Promise<void>;
  onCancel?: () => void;
}

const initialState: ShiftInput = {
  shift_date: formatDate(new Date()),
  start_time: "07:30",
  end_time: "16:00",
  day_type: "work",
};

function addHoursToTime(time: string, hours: number) {
  const [hour = "0", minute = "0"] = time.split(":");
  const totalMinutes = Number(hour) * 60 + Number(minute) + hours * 60;
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
}

export function ShiftForm({ initial, settings, onSubmit, onCancel }: ShiftFormProps) {
  const [form, setForm] = useState<ShiftInput>(initial ?? initialState);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initial ?? initialState);
  }, [initial]);

  function updateDayType(dayType: DayType) {
    if (dayType === "sick") {
      setForm((current) => ({
        ...current,
        day_type: dayType,
        start_time: "07:30",
        end_time: addHoursToTime("07:30", settings.default_sick_hours),
      }));
      return;
    }

    if (dayType === "off") {
      setForm((current) => ({
        ...current,
        day_type: dayType,
        start_time: "07:30",
        end_time: addHoursToTime("07:30", settings.default_off_hours),
      }));
      return;
    }

    setForm((current) => ({ ...current, day_type: dayType }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!form.shift_date || !form.start_time || !form.end_time) {
      setError("מלא את כל שדות החובה");
      return;
    }

    if (
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(form.start_time) ||
      !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(form.end_time)
    ) {
      setError("הזן שעה בפורמט 00:00 עד 23:59");
      return;
    }

    try {
      await onSubmit(form);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "אי אפשר לשמור את המשמרת");
      return;
    }

    if (!initial) {
      setForm(initialState);
    }
  }

  return (
    <form className="card form-grid edit-form" onSubmit={handleSubmit}>
      <h2>{initial ? "עריכת משמרת" : "הוספת משמרת"}</h2>
      <div className="field">
        <label>תאריך</label>
        <input
          type="date"
          value={form.shift_date}
          onChange={(event) => setForm((current) => ({ ...current, shift_date: event.target.value }))}
        />
      </div>
      <div className="field">
        <label>התחלה</label>
        <TimeInput
          value={form.start_time}
          onChange={(value) => setForm((current) => ({ ...current, start_time: value }))}
        />
      </div>
      <div className="field">
        <label>סיום</label>
        <TimeInput
          value={form.end_time}
          onChange={(value) => setForm((current) => ({ ...current, end_time: value }))}
        />
      </div>
      <div className="field">
        <label>סוג יום</label>
        <select value={form.day_type} onChange={(event) => updateDayType(event.target.value as DayType)}>
          <option value="work">עבודה</option>
          <option value="sick">מחלה</option>
          <option value="off">יום חופש</option>
        </select>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="actions">
        <button type="submit">{initial ? "שמירת משמרת" : "הוספת משמרת"}</button>
        {onCancel ? (
          <button type="button" className="ghost-button" onClick={onCancel}>
            ביטול
          </button>
        ) : null}
      </div>
    </form>
  );
}
