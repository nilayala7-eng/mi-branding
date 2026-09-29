import Link from "next/link";
import { Suspense } from "react";
import clsx from "clsx";
import { PeriodPicker } from "@/components/period-picker";
import { InsightCard } from "@/components/insight-card";
import { Card, CardHeader, ConfidenceBadge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { TAXONOMY_DIMENSIONS } from "@/lib/data/taxonomy-seed";
import type { StrategyInsight, TaxonomyDimensionKey } from "@/lib/domain/types";
import { fmtCompact, fmtDate, fmtNumber, fmtRate } from "@/lib/format";
import { param, rangeFromSearchParams } from "@/lib/page-params";
import { getContentByDimension } from "@/services/analytics";
import { generateStrategy, lift, MIN_SAMPLE } from "@/services/strategy";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Section({
  n,
  title,
  description,
  items,
  empty,
}: {
  n: number;
  title: string;
  description: string;
  items: StrategyInsight[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader eyebrow={`0${n}`} title={title} description={description} />
      <div className="grid gap-3 p-5 lg:grid-cols-2">
        {items.length ? items.map((i) => <InsightCard key={i.id} insight={i} />) : <div className="lg:col-span-2"><EmptyState title={empty} /></div>}
      </div>
    </Card>
  );
}

export default async function StrategyPage({ searchParams }: Props) {
  const repo = getRepository();
  const account = await repo.getAccount();
  const sp = await searchParams;
  const { preset, range } = rangeFromSearchParams({ period: "90d", ...sp }, account.today);
  const dimParam = param(sp, "dim");
  const dim = (TAXONOMY_DIMENSIONS.find((d) => d.key === dimParam)?.key ?? "topic") as TaxonomyDimensionKey;

  const [s, breakdown] = await Promise.all([generateStrategy(repo, range), getContentByDimension(repo, dim, range)]);
  const by = (k: StrategyInsight["kind"]) => s.insights.filter((i) => i.kind === k);
  const hypotheses = s.insights.filter((i) => i.hypothesis && i.confidence !== "insufficient");
  const qs = (next: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") u.set(k, v);
    for (const [k, v] of Object.entries(next)) u.set(k, v);
    return `?${u.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Where to go next"
        subtitle={
          <>
            {fmtDate(range.from)} → {fmtDate(range.to)} · {s.totalPosts} publicaciones analizadas · grupos con n &lt; {MIN_SAMPLE} excluidos (
            {s.skippedSmallGroups}). Dato, interpretación, hipótesis y recomendación siempre separados.
          </>
        }
        actions={
          <Suspense>
            <PeriodPicker preset={preset} range={range} />
          </Suspense>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Rendimiento por categoría"
            description="Medianas por grupo frente a la mediana de la cuenta. La columna de confianza depende solo del tamaño de muestra."
            right={
              <div className="flex flex-wrap justify-end gap-1">
                {TAXONOMY_DIMENSIONS.filter((d) => d.key !== "subtopic").map((d) => (
                  <Link
                    key={d.key}
                    href={qs({ dim: d.key })}
                    scroll={false}
                    className={clsx(
                      "rounded-md px-2 py-1 text-xs",
                      d.key === dim ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink",
                    )}
                  >
                    {d.label}
                  </Link>
                ))}
              </div>
            }
          />
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="text-left text-[11px] text-ink-muted">
                <tr>
                  <th className="pb-2 font-normal">Grupo</th>
                  <th className="pb-2 font-normal">Muestra</th>
                  <th className="pb-2 text-right font-normal">Views (med.)</th>
                  <th className="pb-2 text-right font-normal">Shares/1k</th>
                  <th className="pb-2 text-right font-normal">Saves/1k</th>
                  <th className="pb-2 text-right font-normal">Follows/1k</th>
                  <th className="pb-2 text-right font-normal">Eng. rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="text-ink-soft">
                  <td className="py-2">Cuenta (todas)</td>
                  <td className="py-2">n={breakdown.baseline.n}</td>
                  <td className="py-2 text-right tabular-nums">{fmtCompact(breakdown.baseline.medianViews)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNumber(breakdown.baseline.medianSharesPer1k, 1)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNumber(breakdown.baseline.medianSavesPer1k, 1)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNumber(breakdown.baseline.medianFollowsPer1k, 2)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtRate(breakdown.baseline.medianEngagementRate, 1)}</td>
                </tr>
                {breakdown.groups.map((g) => {
                  const small = g.n < MIN_SAMPLE;
                  const cell = (v: number | null, base: number | null, digits: number) => {
                    const l = small ? null : lift(v, base);
                    return (
                      <td className={clsx("py-2 text-right tabular-nums", small && "text-ink-muted")}>
                        {fmtNumber(v, digits)}
                        {l !== null && Math.abs(l) >= 0.25 && (
                          <span className={clsx("ml-1 text-[10px]", l > 0 ? "text-good" : "text-critical")}>
                            {l > 0 ? "▲" : "▼"}
                            {Math.round(Math.abs(l) * 100)}%
                          </span>
                        )}
                      </td>
                    );
                  };
                  return (
                    <tr key={g.slug}>
                      <td className={clsx("py-2", small ? "text-ink-muted" : "text-ink")}>{g.label}</td>
                      <td className="py-2">
                        <ConfidenceBadge confidence={g.confidence} n={g.n} />
                      </td>
                      <td className={clsx("py-2 text-right tabular-nums", small && "text-ink-muted")}>{fmtCompact(g.medianViews)}</td>
                      {cell(g.medianSharesPer1k, breakdown.baseline.medianSharesPer1k, 1)}
                      {cell(g.medianSavesPer1k, breakdown.baseline.medianSavesPer1k, 1)}
                      {cell(g.medianFollowsPer1k, breakdown.baseline.medianFollowsPer1k, 2)}
                      <td className={clsx("py-2 text-right tabular-nums", small && "text-ink-muted")}>{fmtRate(g.medianEngagementRate, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {breakdown.untaggedPosts > 0 && (
              <p className="mt-3 text-xs text-ink-muted">{breakdown.untaggedPosts} publicaciones sin esta etiqueta no se incluyen en los grupos.</p>
            )}
          </div>
        </Card>

        <Section n={1} title="Patrones positivos" description="Grupos que superan la mediana de la cuenta en shares, saves o follows por 1k reach." items={by("positive")} empty="Ningún grupo supera los umbrales" />
        <Section n={2} title="Patrones negativos" description="Grupos claramente por debajo de la mediana." items={by("negative")} empty="Ningún grupo queda claramente por debajo" />
        <Section n={3} title="Cambios recientes" description="Últimos 30 días frente a los 30 anteriores, a nivel de cuenta." items={by("change")} empty="Sin cambios superiores al 15 %" />
        <Section n={4} title="Oportunidades" description="Huecos de datos y contenido que atrae alcance pero no convierte." items={by("opportunity")} empty="Sin oportunidades detectadas" />

        <Card>
          <CardHeader eyebrow="05" title="Hipótesis" description="Explicaciones posibles, no hechos. Cada una necesita un experimento para confirmarse." />
          <ul className="space-y-2 p-5">
            {hypotheses.length === 0 && <EmptyState title="Sin hipótesis con muestra suficiente" />}
            {hypotheses.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="flex-1 text-[13px] italic text-ink-soft">{h.hypothesis}</span>
                <ConfidenceBadge confidence={h.confidence} n={h.data.sampleSize} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            eyebrow="06"
            title="Experimentos recomendados"
            description="Diseñados a partir de los patrones positivos. Baseline = mediana de la cuenta en el periodo."
            right={
              <Link href="/experiments" className="text-xs text-ink-soft hover:text-ink">
                Ir a Experiments
              </Link>
            }
          />
          <div className="grid gap-3 p-5 lg:grid-cols-2">
            {s.suggestedExperiments.length === 0 && (
              <div className="lg:col-span-2">
                <EmptyState title="Sin experimentos sugeridos para este periodo" />
              </div>
            )}
            {s.suggestedExperiments.map((e) => (
              <div key={e.sourceInsightId} className="rounded-xl border border-border bg-surface-2/50 p-4 text-[13px]">
                <div className="font-medium text-ink">{e.name}</div>
                <dl className="mt-2 space-y-1.5">
                  <div><dt className="inline text-ink-muted">Hipótesis: </dt><dd className="inline italic text-ink-soft">{e.hypothesis}</dd></div>
                  <div><dt className="inline text-ink-muted">Métrica: </dt><dd className="inline text-ink-soft">{e.metric}</dd></div>
                  <div><dt className="inline text-ink-muted">Baseline: </dt><dd className="inline tabular-nums text-ink-soft">{fmtNumber(e.baseline, 2)} — {e.baselineDescription}</dd></div>
                  <div><dt className="inline text-ink-muted">Test: </dt><dd className="inline text-ink-soft">{e.test}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
