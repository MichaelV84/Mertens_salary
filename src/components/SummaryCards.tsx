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

const labels = {
  logout: "\u05d9\u05e6\u05d9\u05d0\u05d4",
  workingDays: "\u05e1\u05d4\u05f4\u05db \u05d9\u05de\u05d9 \u05e2\u05d1\u05d5\u05d3\u05d4",
  monthlyTotal: "\u05e1\u05d4\u05f4\u05db \u05dc\u05d7\u05d5\u05d3\u05e9",
  totalHours: "\u05e1\u05d4\u05f4\u05db \u05e9\u05e2\u05d5\u05ea",
  workHours: "\u05e9\u05e2\u05d5\u05ea \u05e2\u05d1\u05d5\u05d3\u05d4",
  leaveHours: "\u05e9\u05e2\u05d5\u05ea \u05de\u05d7\u05dc\u05d4/\u05d7\u05d5\u05e4\u05e9",
} as const;

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
          <button type="button" className="summary-logout" onClick={() => void signOut()}>
            {labels.logout}
          </button>
          <span className="summary-email" dir="ltr" title={user?.email}>
            {user?.email}
          </span>
        </div>

        <div className="summary-pair-grid">
          <div className="summary-metric summary-metric-card">
            <span className="muted">{labels.workingDays}</span>
            <strong dir="ltr">{workingDays}</strong>
          </div>
          <div className="summary-metric summary-metric-card">
            <span className="muted">{labels.monthlyTotal}</span>
            <strong dir="ltr">₪{total.toFixed(2)}</strong>
          </div>
        </div>

        <div className="summary-triple-grid">
          <div className="summary-metric summary-metric-card">
            <span className="muted">{labels.totalHours}</span>
            <strong dir="ltr">{hours.toFixed(2)}</strong>
          </div>
          <div className="summary-metric summary-metric-card">
            <span className="muted">{labels.workHours}</span>
            <strong dir="ltr">{workHours.toFixed(2)}</strong>
          </div>
          <div className="summary-metric summary-metric-card">
            <span className="muted">{labels.leaveHours}</span>
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
