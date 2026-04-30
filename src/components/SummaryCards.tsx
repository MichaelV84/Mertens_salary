import { useAuth } from "../services/auth-context";

interface RateSummaryItem {
  label: string;
  hours: number;
}

interface SummaryCardsProps {
  total: number;
  hours: number;
  workHours: number;
  leaveHours: number;
  workingDays: number;
  rateSummary: RateSummaryItem[];
}

export function SummaryCards({
  total,
  hours,
  workHours,
  leaveHours,
  workingDays,
  rateSummary,
}: SummaryCardsProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="summary-grid">
      <div className="card accent-card summary-card">
        <div className="summary-account-row">
          <button className="summary-logout" onClick={() => void signOut()}>
            יציאה
          </button>
          <span className="summary-email">{user?.email}</span>
        </div>

        <div className="summary-pair-grid">
          <div className="summary-metric">
            <span className="muted">סה״כ ימי עבודה</span>
            <strong dir="ltr">{workingDays}</strong>
          </div>
          <div className="summary-metric">
            <span className="muted">סה״כ לחודש</span>
            <strong dir="ltr">₪{total.toFixed(2)}</strong>
          </div>
        </div>

        <div className="summary-triple-grid">
          <div className="summary-metric">
            <span className="muted">סה״כ שעות</span>
            <strong dir="ltr">{hours.toFixed(2)}</strong>
          </div>
          <div className="summary-metric">
            <span className="muted">שעות עבודה</span>
            <strong dir="ltr">{workHours.toFixed(2)}</strong>
          </div>
          <div className="summary-metric">
            <span className="muted">שעות מחלה/חופש</span>
            <strong dir="ltr">{leaveHours.toFixed(2)}</strong>
          </div>
        </div>

        <div className="summary-rates">
          {rateSummary.map((item) => (
            <span key={item.label} className="summary-rate-chip" dir="ltr">
              {item.label} - {item.hours.toFixed(2)}h
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
