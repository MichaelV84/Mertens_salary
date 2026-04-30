import { useEffect, useState } from "react";
import { fetchSettings, saveSettings } from "../services/api";
import { useAuth } from "../services/auth-context";
import type { UserSettings } from "../types";

export function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    base_rate: 60,
    default_off_hours: 9,
    default_sick_hours: 9,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    fetchSettings(user.id).then(setSettings);
  }, [user]);

  async function handleSave() {
    if (!user) {
      return;
    }

    await saveSettings({ ...settings, user_id: user.id });
  }

  return (
    <div className="stack">
      <section className="card form-grid">
        <h2>הגדרות</h2>
        <div className="field">
          <label>תעריף בסיס (₪ לשעה)</label>
          <input
            type="number"
            value={settings.base_rate}
            onChange={(event) => setSettings((current) => ({ ...current, base_rate: Number(event.target.value) }))}
          />
        </div>
        <div className="field">
          <label>שעות מחלה ברירת מחדל</label>
          <input
            type="number"
            value={settings.default_sick_hours}
            onChange={(event) =>
              setSettings((current) => ({ ...current, default_sick_hours: Number(event.target.value) }))
            }
          />
        </div>
        <div className="field">
          <label>שעות יום חופש ברירת מחדל</label>
          <input
            type="number"
            value={settings.default_off_hours}
            onChange={(event) =>
              setSettings((current) => ({ ...current, default_off_hours: Number(event.target.value) }))
            }
          />
        </div>
        <button onClick={() => void handleSave()}>שמירת הגדרות</button>
      </section>
    </div>
  );
}
