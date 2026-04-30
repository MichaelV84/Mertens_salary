import type { SalaryCalculationResult, ShiftRecord } from "../types";

interface ShiftListProps {
  items: Array<{ shift: ShiftRecord; salary: SalaryCalculationResult }>;
  onEdit: (shift: ShiftRecord) => void;
  onDelete: (id: string) => Promise<void>;
}

function getDayTypeLabel(dayType: ShiftRecord["day_type"]) {
  if (dayType === "sick") {
    return "מחלה";
  }

  if (dayType === "off") {
    return "יום חופש";
  }

  return "עבודה";
}

export function ShiftList({ items, onEdit, onDelete }: ShiftListProps) {
  if (!items.length) {
    return <div className="card">אין משמרות בחודש הזה עדיין.</div>;
  }

  return (
    <div className="stack">
      {items.map(({ shift, salary }) => (
        <article key={shift.id} className="card shift-card">
          <div className="row space-between">
            <div>
              <strong>{shift.shift_date}</strong>
              <p className="muted">
                {shift.start_time} - {shift.end_time} | {getDayTypeLabel(shift.day_type)}
              </p>
            </div>
            <strong>₪{salary.total.toFixed(2)}</strong>
          </div>
          <div className="breakdown-list">
            {salary.breakdown.map((item, index) => (
              <div className="breakdown-row" key={`${shift.id}-${index}`}>
                <span>{item.type}</span>
                <span>
                  {item.hours.toFixed(2)} שעות x ₪{item.rate.toFixed(2)} = ₪{item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="ghost-button" onClick={() => onEdit(shift)}>
              עריכה
            </button>
            <button className="ghost-button danger" onClick={() => void onDelete(shift.id)}>
              מחיקה
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
