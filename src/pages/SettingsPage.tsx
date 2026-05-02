import { useEffect, useState } from "react";
import { fetchSettings, saveSettings } from "../services/api";
import { useAuth } from "../services/auth-context";
import { formatSupabaseError } from "../services/errors";
import type { UserSettings } from "../types";

const defaultSettings: UserSettings = {
  base_rate: 60,
  default_off_hours: 9,
  default_sick_hours: 9,
};

const labels = {
  title: "הגדרות",
  baseRate: "תעריף בסיס (₪ לשעה)",
  sickHours: "שעות מחלה ברירת מחדל",
  offHours: "שעות יום חופש ברירת מחדל",
  save: "שמירת הגדרות",
  saveSuccess: "ההגדרות נשמרו",
  loadError: "אי אפשר לטעון את ההגדרות",
  saveError: "אי אפשר לשמור את ההגדרות",
} as const;

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isActive = true;
    setMessage("");

    fetchSettings(user.id)
      .then((loadedSettings) => {
        if (!isActive) {
          return;
        }

        setSettings(loadedSettings);
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }

        setMessage(formatSupabaseError(loadError, labels.loadError));
      });

    return () => {
      isActive = false;
    };
  }, [user]);

  async function handleSave() {
    if (!user) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await saveSettings({ ...settings, user_id: user.id });
      setMessage(labels.saveSuccess);
    } catch (saveError) {
      setMessage(formatSupabaseError(saveError, labels.saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <section className="card form-grid">
        <h2>{labels.title}</h2>
        <div className="field">
          <label>{labels.baseRate}</label>
          <input
            type="number"
            value={settings.base_rate}
            onChange={(event) => setSettings((current) => ({ ...current, base_rate: Number(event.target.value) }))}
          />
        </div>
        <div className="field">
          <label>{labels.sickHours}</label>
          <input
            type="number"
            value={settings.default_sick_hours}
            onChange={(event) =>
              setSettings((current) => ({ ...current, default_sick_hours: Number(event.target.value) }))
            }
          />
        </div>
        <div className="field">
          <label>{labels.offHours}</label>
          <input
            type="number"
            value={settings.default_off_hours}
            onChange={(event) =>
              setSettings((current) => ({ ...current, default_off_hours: Number(event.target.value) }))
            }
          />
        </div>
        {message ? <p className={message === labels.saveSuccess ? "muted" : "error-text"}>{message}</p> : null}
        <button disabled={saving} onClick={() => void handleSave()}>
          {labels.save}
        </button>
      </section>
    </div>
  );
}
