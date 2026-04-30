import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { SalaryCalculationResult, ShiftRecord } from "../types";

type ExportRow = { shift: ShiftRecord; salary: SalaryCalculationResult };
type ExportSummaryItem = { label: string; hours: number };
type ExportSummary = {
  total: number;
  hours: number;
  workHours: number;
  leaveHours: number;
  rateSummary: ExportSummaryItem[];
};

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatMoney(amount: number) {
  return `ILS ${amount.toFixed(2)}`;
}

function formatWeekday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

function formatMonthLabel(month: Date) {
  return month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatMonthFilePart(month: Date) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
}

function getRowHours(salary: SalaryCalculationResult) {
  return salary.breakdown.reduce((sum, item) => sum + item.hours, 0);
}

function isHolidaySalary(salary: SalaryCalculationResult) {
  return salary.breakdown.some((item) => item.base_category === "holiday_150" || item.base_category === "holiday_200");
}

function getExcelNoteLabel(shift: ShiftRecord, salary: SalaryCalculationResult) {
  if (shift.day_type === "sick") {
    return "מחלה";
  }

  if (shift.day_type === "off") {
    return "חופש";
  }

  if (isHolidaySalary(salary)) {
    return "Holiday";
  }

  return "";
}

function getPdfNoteLabel(shift: ShiftRecord, salary: SalaryCalculationResult) {
  if (shift.day_type === "sick") {
    return "Sick";
  }

  if (shift.day_type === "off") {
    return "Leave";
  }

  if (isHolidaySalary(salary)) {
    return "Holiday";
  }

  return "";
}

function buildDayMaps(
  rows: ExportRow[],
  getNoteLabel: (shift: ShiftRecord, salary: SalaryCalculationResult) => string,
) {
  const dayHoursMap: Record<string, number> = {};
  const noteMap: Record<string, string> = {};

  rows.forEach(({ shift, salary }) => {
    dayHoursMap[shift.shift_date] = Number(((dayHoursMap[shift.shift_date] ?? 0) + getRowHours(salary)).toFixed(2));

    const noteLabel = getNoteLabel(shift, salary);
    if (!noteLabel) {
      return;
    }

    if (shift.day_type === "sick" || shift.day_type === "off") {
      noteMap[shift.shift_date] = noteLabel;
      return;
    }

    if (!noteMap[shift.shift_date]) {
      noteMap[shift.shift_date] = noteLabel;
    }
  });

  return { dayHoursMap, noteMap };
}

export function exportShiftsToExcel(rows: ExportRow[], month: Date, summary: ExportSummary) {
  const { dayHoursMap, noteMap } = buildDayMaps(rows, getExcelNoteLabel);
  const monthLabel = formatMonthLabel(month);
  const monthFilePart = formatMonthFilePart(month);

  const summarySheet = XLSX.utils.json_to_sheet([
    { Field: "Report month", Value: monthLabel },
    { Field: "Monthly total", Value: summary.total.toFixed(2) },
    { Field: "Monthly hours", Value: summary.hours.toFixed(2) },
    { Field: "Work hours", Value: summary.workHours.toFixed(2) },
    { Field: "Sick/Leave hours", Value: summary.leaveHours.toFixed(2) },
    ...summary.rateSummary.map((item) => ({ Field: item.label, Value: item.hours.toFixed(2) })),
  ]);

  const dataSheet = XLSX.utils.json_to_sheet(
    rows.map(({ shift, salary }) => ({
      Date: shift.shift_date,
      Weekday: formatWeekday(shift.shift_date),
      Start: formatTime(shift.start_time),
      End: formatTime(shift.end_time),
      DayHours: dayHoursMap[shift.shift_date].toFixed(2),
      Note: noteMap[shift.shift_date] ?? "",
      Amount: salary.total,
      Breakdown: salary.breakdown.map((item) => `${item.type}: ${item.hours.toFixed(2)} hours`).join(" | "),
    })),
  );

  summarySheet["!cols"] = [{ wch: 22 }, { wch: 18 }];
  dataSheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 48 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Salary");
  XLSX.writeFile(workbook, `salary-report-${monthFilePart}.xlsx`);
}

export function exportShiftsToPdf(rows: ExportRow[], month: Date, summary: ExportSummary) {
  const doc = new jsPDF({ orientation: "landscape" });
  const { dayHoursMap, noteMap } = buildDayMaps(rows, getPdfNoteLabel);
  const monthLabel = formatMonthLabel(month);
  const monthFilePart = formatMonthFilePart(month);

  doc.setFontSize(16);
  doc.text("Salary report", 14, 16);

  doc.setFontSize(11);
  doc.text(`Report month: ${monthLabel}`, 14, 24);
  doc.text(`Monthly total: ${formatMoney(summary.total)}`, 14, 31);
  doc.text(`Monthly hours: ${summary.hours.toFixed(2)}`, 14, 38);
  doc.text(`Work hours: ${summary.workHours.toFixed(2)}`, 14, 45);
  doc.text(`Sick/Leave hours: ${summary.leaveHours.toFixed(2)}`, 14, 52);

  if (summary.rateSummary.length) {
    summary.rateSummary.forEach((item, index) => {
      doc.text(`${item.label}: ${item.hours.toFixed(2)}h`, 14, 59 + index * 7);
    });
  }

  autoTable(doc, {
    startY: 59 + Math.max(1, summary.rateSummary.length) * 7 + 6,
    head: [["Date", "Weekday", "Start", "End", "Day hours", "Note", "Amount"]],
    body: rows.map(({ shift, salary }) => [
      shift.shift_date,
      formatWeekday(shift.shift_date),
      formatTime(shift.start_time),
      formatTime(shift.end_time),
      dayHoursMap[shift.shift_date].toFixed(2),
      noteMap[shift.shift_date] ?? "",
      formatMoney(salary.total),
    ]),
    foot: [["", "", "", "", "", "Total", formatMoney(summary.total)]],
    showHead: "firstPage",
    showFoot: "lastPage",
    headStyles: {
      fillColor: [19, 60, 85],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [237, 243, 247],
      textColor: [18, 33, 44],
      fontStyle: "bold",
    },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [247, 249, 251],
    },
  });

  doc.save(`salary-report-${monthFilePart}.pdf`);
}
