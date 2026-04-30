interface MonthSelectorProps {
  value: Date;
  onChange: (date: Date) => void;
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function formatMonthValue(value: Date) {
  const safeValue = isValidDate(value) ? value : new Date();
  return `${safeValue.getFullYear()}-${String(safeValue.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div className="card month-selector">
      <div className="field">
        <label>חודש</label>
        <input
          type="month"
          value={formatMonthValue(value)}
          onChange={(event) => {
            if (!event.target.value) {
              onChange(new Date());
              return;
            }

            const [year, month] = event.target.value.split("-").map(Number);
            if (!year || !month) {
              return;
            }

            onChange(new Date(year, month - 1, 1));
          }}
        />
      </div>
    </div>
  );
}
