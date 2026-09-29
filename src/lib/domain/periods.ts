import type { ISODate } from "./types";

export type PeriodPreset = "7d" | "30d" | "90d" | "6m" | "1y" | "custom";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 año" },
  { value: "custom", label: "Custom" },
];

/** Inclusive calendar range. */
export interface DateRange {
  from: ISODate;
  to: ISODate;
}

const DAY_MS = 86_400_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toUTCDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function fromUTCDate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTCDate(new Date(toUTCDate(date).getTime() + days * DAY_MS));
}

/** Number of days in an inclusive range. */
export function rangeLength(range: DateRange): number {
  return Math.round((toUTCDate(range.to).getTime() - toUTCDate(range.from).getTime()) / DAY_MS) + 1;
}

export function eachDay(range: DateRange): ISODate[] {
  const days: ISODate[] = [];
  const n = rangeLength(range);
  for (let i = 0; i < n; i++) days.push(addDays(range.from, i));
  return days;
}

export function inRange(date: ISODate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

const PRESET_DAYS: Record<Exclude<PeriodPreset, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
};

/** Range ending on `today` (inclusive) for a preset. */
export function presetRange(preset: Exclude<PeriodPreset, "custom">, today: ISODate): DateRange {
  const days = PRESET_DAYS[preset];
  return { from: addDays(today, -(days - 1)), to: today };
}

/**
 * The equivalent previous period: same number of days, immediately before
 * `range`. This is the only comparison the analytics layer allows by default,
 * so that "this period vs last" is always like-for-like.
 */
export function previousPeriod(range: DateRange): DateRange {
  const len = rangeLength(range);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export function assertValidRange(range: DateRange): void {
  if (!isISODate(range.from) || !isISODate(range.to)) {
    throw new RangeError(`Invalid date range: ${range.from} → ${range.to}`);
  }
  if (range.from > range.to) {
    throw new RangeError(`Range start ${range.from} is after end ${range.to}`);
  }
}

/** Resolve a preset or custom range from untrusted query params. */
export function resolveRange(
  input: { preset?: string | null; from?: string | null; to?: string | null },
  today: ISODate,
): { preset: PeriodPreset; range: DateRange } {
  const preset = (PERIOD_PRESETS.find((p) => p.value === input.preset)?.value ?? "30d") as PeriodPreset;
  if (preset === "custom") {
    if (input.from && input.to && isISODate(input.from) && isISODate(input.to) && input.from <= input.to) {
      return { preset, range: { from: input.from, to: input.to } };
    }
    return { preset: "30d", range: presetRange("30d", today) };
  }
  return { preset, range: presetRange(preset, today) };
}
