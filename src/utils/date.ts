export function combineDateAndTime(date: string, time: string) {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(":");
  return new Date(`${date}T${hours}:${minutes}:${seconds}`);
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function minutesBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / 60000;
}
