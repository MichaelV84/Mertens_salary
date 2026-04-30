interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  return (
    <input
      dir="ltr"
      inputMode="numeric"
      pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
      placeholder="00:00"
      title="00:00-23:59"
      value={value.slice(0, 5)}
      onChange={(event) => onChange(formatTimeInput(event.target.value))}
    />
  );
}
