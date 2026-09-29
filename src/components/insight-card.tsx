import clsx from "clsx";
import type { StrategyInsight } from "@/lib/domain/types";
import { ConfidenceBadge } from "./ui/primitives";

const KIND: Record<StrategyInsight["kind"], { label: string; dot: string }> = {
  positive: { label: "Patrón positivo", dot: "bg-good" },
  negative: { label: "Patrón negativo", dot: "bg-critical" },
  change: { label: "Cambio reciente", dot: "bg-[#3987e5]" },
  opportunity: { label: "Oportunidad", dot: "bg-coral" },
};

function Block({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "muted" }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{label}</div>
      <div className={clsx("text-[13px] leading-relaxed", tone === "muted" ? "text-ink-soft" : "text-ink")}>{children}</div>
    </div>
  );
}

/**
 * Renders an insight with DATA / INTERPRETATION / HYPOTHESIS / RECOMMENDATION
 * kept visually separate — a hypothesis is never styled like a fact.
 */
export function InsightCard({ insight, compact = false }: { insight: StrategyInsight; compact?: boolean }) {
  const k = KIND[insight.kind];
  return (
    <article className="rounded-xl border border-border bg-surface-2/50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <span className={clsx("h-1.5 w-1.5 rounded-full", k.dot)} />
          {k.label}
        </span>
        <span className="ml-auto">
          <ConfidenceBadge confidence={insight.confidence} n={insight.data.sampleSize} />
        </span>
      </div>
      <h3 className="mb-3 text-sm font-medium text-ink">{insight.title}</h3>
      <div className="space-y-3">
        <Block label="Dato">
          {insight.data.statement}
          {!compact && insight.data.evidence.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {insight.data.evidence.map((e) => (
                <div key={e.label} className="flex flex-col">
                  <dt className="text-ink-muted">{e.label}</dt>
                  <dd className="tabular-nums text-ink-soft">{e.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Block>
        {!compact && <Block label="Interpretación" tone="muted">{insight.interpretation}</Block>}
        {insight.hypothesis && !compact && (
          <Block label="Hipótesis" tone="muted">
            <span className="italic">{insight.hypothesis}</span>
          </Block>
        )}
        {insight.recommendation && <Block label="Recomendación">{insight.recommendation}</Block>}
      </div>
      {!compact && insight.caveats.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-t border-border pt-2 text-[11px] text-ink-muted">
          {insight.caveats.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
