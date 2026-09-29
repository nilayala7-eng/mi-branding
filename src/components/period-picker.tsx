"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { PERIOD_PRESETS, type DateRange, type PeriodPreset } from "@/lib/domain/periods";

/**
 * Period selector. State lives in the URL (?period=30d or
 * ?period=custom&from=…&to=…) so every view is linkable and server-rendered.
 */
export function PeriodPicker({ preset, range }: { preset: PeriodPreset; range: DateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [custom, setCustom] = useState(range);
  const [showCustom, setShowCustom] = useState(preset === "custom");

  function go(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", pending && "opacity-70")}>
      <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Periodo">
        {PERIOD_PRESETS.map((p) => {
          const active = p.value === "custom" ? showCustom || preset === "custom" : preset === p.value && !showCustom;
          return (
            <button
              key={p.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (p.value === "custom") setShowCustom(true);
                else {
                  setShowCustom(false);
                  go({ period: p.value, from: null, to: null });
                }
              }}
              className={clsx(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                active ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {showCustom && (
        <form
          className="flex items-center gap-1.5 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.from && custom.to && custom.from <= custom.to) go({ period: "custom", from: custom.from, to: custom.to });
          }}
        >
          <input
            type="date"
            aria-label="Desde"
            value={custom.from}
            max={custom.to}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
          />
          <span className="text-ink-muted">→</span>
          <input
            type="date"
            aria-label="Hasta"
            value={custom.to}
            min={custom.from}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
          />
          <button type="submit" className="rounded-md bg-accent px-2.5 py-1.5 font-medium text-bg hover:bg-accent/90">
            Aplicar
          </button>
        </form>
      )}
    </div>
  );
}
