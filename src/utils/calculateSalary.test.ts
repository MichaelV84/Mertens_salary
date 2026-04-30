import { describe, expect, it } from "vitest";
import { calculateSalary } from "./calculateSalary";
import { combineDateAndTime } from "./date";

describe("calculateSalary", () => {
  it("calculates regular daytime shift", () => {
    const result = calculateSalary(
      new Date("2026-01-12T08:00:00"),
      new Date("2026-01-12T16:00:00"),
      { baseRate: 60 },
    );

    expect(result.total).toBe(480);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(60);
  });

  it("splits shift across day and evening rates", () => {
    const result = calculateSalary(
      new Date("2026-01-12T15:00:00"),
      new Date("2026-01-12T18:00:00"),
      { baseRate: 60 },
    );

    expect(result.breakdown).toHaveLength(2);
    expect(result.total).toBe(204);
  });

  it("applies overtime inside a regular shift", () => {
    const result = calculateSalary(
      new Date("2026-01-12T07:30:00"),
      new Date("2026-01-12T19:30:00"),
      { baseRate: 60 },
    );

    expect(result.breakdown.some((item) => item.rate === 90)).toBe(true);
    expect(result.total).toBe(786);
  });

  it("does not add overtime during shabbat", () => {
    const result = calculateSalary(
      new Date("2026-01-16T16:30:00"),
      new Date("2026-01-17T23:30:00"),
      { baseRate: 60 },
    );

    expect(result.breakdown.every((item) => item.rate === 90)).toBe(true);
    expect(result.total).toBe(2790);
  });

  it("supports shifts crossing midnight", () => {
    const result = calculateSalary(
      new Date("2026-01-12T22:00:00"),
      new Date("2026-01-13T06:00:00"),
      { baseRate: 60 },
    );

    expect(result.breakdown).toHaveLength(2);
    expect(result.total).toBe(612);
  });

  it("does not add overtime during a manual full holiday", () => {
    const result = calculateSalary(
      new Date("2026-01-14T08:00:00"),
      new Date("2026-01-14T20:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-14", type: "full" }] },
    );

    expect(result.breakdown.every((item) => item.rate === 90)).toBe(true);
    expect(result.total).toBe(1080);
  });

  it("treats manual holiday eve like Friday evening and keeps regular hours before 16:00", () => {
    const result = calculateSalary(
      new Date("2026-01-14T15:00:00"),
      new Date("2026-01-14T18:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-14", type: "eve" }] },
    );

    expect(result.breakdown.map((item) => item.rate)).toEqual([60, 90]);
    expect(result.total).toBe(240);
  });

  it("treats the day after manual holiday eve like a full holiday", () => {
    const result = calculateSalary(
      new Date("2026-01-15T08:00:00"),
      new Date("2026-01-15T20:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-14", type: "eve" }] },
    );

    expect(result.breakdown.every((item) => item.rate === 90)).toBe(true);
    expect(result.total).toBe(1080);
  });

  it("treats manual full holiday like Saturday through the next morning", () => {
    const result = calculateSalary(
      new Date("2026-01-15T23:00:00"),
      new Date("2026-01-16T08:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-15", type: "full" }] },
    );

    expect(result.breakdown.map((item) => item.rate)).toEqual([90, 60]);
    expect(result.total).toBe(795);
  });

  it("treats yom kippur eve like Friday timing but pays 200% after 16:00", () => {
    const result = calculateSalary(
      new Date("2026-01-14T15:00:00"),
      new Date("2026-01-14T18:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-14", type: "yom_kippur_eve" }] },
    );

    expect(result.breakdown.map((item) => item.rate)).toEqual([60, 120]);
    expect(result.total).toBe(300);
  });

  it("treats the day after yom kippur eve like a full 200% holiday", () => {
    const result = calculateSalary(
      new Date("2026-01-15T08:00:00"),
      new Date("2026-01-15T20:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-14", type: "yom_kippur_eve" }] },
    );

    expect(result.breakdown.every((item) => item.rate === 120)).toBe(true);
    expect(result.total).toBe(1440);
  });

  it("treats yom kippur full like Saturday timing through the next morning at 200%", () => {
    const result = calculateSalary(
      new Date("2026-01-15T23:00:00"),
      new Date("2026-01-16T08:00:00"),
      { baseRate: 60, manualHolidays: [{ date: "2026-01-15", type: "yom_kippur_full" }] },
    );

    expect(result.breakdown.map((item) => item.rate)).toEqual([120, 60]);
    expect(result.total).toBe(1050);
  });

  it("does not continue overtime from a previous separate shift", () => {
    const nightShift = calculateSalary(
      new Date("2026-01-12T22:00:00"),
      new Date("2026-01-13T06:00:00"),
      { baseRate: 60 },
    );
    const nextShift = calculateSalary(
      new Date("2026-01-13T07:30:00"),
      new Date("2026-01-13T16:30:00"),
      { baseRate: 60 },
    );

    expect(nightShift.total).toBe(612);
    expect(nextShift.breakdown.every((item) => item.rate < 90)).toBe(true);
  });

  it("parses Supabase time values with seconds", () => {
    const result = calculateSalary(
      combineDateAndTime("2026-01-12", "07:30:00"),
      combineDateAndTime("2026-01-12", "16:00:00"),
      { baseRate: 60 },
    );

    expect(result.total).toBe(510);
  });

  it("continues overtime across shifts on the same regular work day", () => {
    const firstShift = calculateSalary(
      new Date("2026-01-12T07:00:00"),
      new Date("2026-01-12T18:00:00"),
      { baseRate: 60 },
    );
    const secondShift = calculateSalary(
      new Date("2026-01-12T18:00:00"),
      new Date("2026-01-12T20:00:00"),
      { baseRate: 60, elapsedHoursOffset: 11 },
    );

    expect(firstShift.breakdown.some((item) => item.rate === 75)).toBe(true);
    expect(secondShift.breakdown.every((item) => item.rate === 90)).toBe(true);
  });

  it("uses the higher bonus instead of stacking night rate with first overtime", () => {
    const result = calculateSalary(
      new Date("2026-01-13T00:00:00"),
      new Date("2026-01-13T01:00:00"),
      { baseRate: 60, elapsedHoursOffset: 9 },
    );

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(78);
  });

  it("shows only the applied overtime label when overtime is higher than evening bonus", () => {
    const result = calculateSalary(
      new Date("2026-01-12T18:00:00"),
      new Date("2026-01-12T19:00:00"),
      { baseRate: 60, elapsedHoursOffset: 9 },
    );

    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(75);
    expect(result.breakdown[0].type).toContain("125%");
    expect(result.breakdown[0].type).not.toContain("120%");
  });

  it("pays vacation day as flat base hours", () => {
    const result = calculateSalary(
      new Date("2026-01-12T07:30:00"),
      new Date("2026-01-12T16:30:00"),
      { baseRate: 60, dayType: "off" },
    );

    expect(result.total).toBe(540);
    expect(result.breakdown).toEqual([
      {
        hours: 9,
        rate: 60,
        amount: 540,
        type: "יום חופש 100%",
      },
    ]);
  });

  it("pays sick day as flat base hours", () => {
    const sickDay = calculateSalary(
      new Date("2026-01-12T07:30:00"),
      new Date("2026-01-12T16:30:00"),
      { baseRate: 60, dayType: "sick", isPaidSickDay: true },
    );

    expect(sickDay.total).toBe(540);
    expect(sickDay.breakdown).toEqual([
      {
        hours: 9,
        rate: 60,
        amount: 540,
        type: "מחלה 100%",
      },
    ]);
  });
});
