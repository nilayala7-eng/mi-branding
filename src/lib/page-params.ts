import { resolveRange } from "@/lib/domain/periods";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/** Resolve ?period / ?from / ?to (untrusted) into a valid range. */
export function rangeFromSearchParams(sp: SearchParams, today: string) {
  return resolveRange({ preset: first(sp.period), from: first(sp.from), to: first(sp.to) }, today);
}

export function param(sp: SearchParams, key: string): string | null {
  return first(sp[key]);
}
