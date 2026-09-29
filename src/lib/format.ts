const LOCALE = "es-ES";

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 10_000) return fmtNumber(n);
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** 0.0523 → "5,23 %" */
export function fmtRate(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${(n * 100).toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

/** Relative change 0.12 → "+12 %" */
export function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const v = Math.round(n * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %`;
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }, timeZone = "Europe/Madrid"): string {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return d.toLocaleDateString(LOCALE, { ...opts, timeZone });
}

export function fmtTime(iso: string, timeZone = "Europe/Madrid"): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", timeZone });
}

export function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
}
