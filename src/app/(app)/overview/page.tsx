import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { PeriodPicker } from "@/components/period-picker";
import { TrendChart, TrendLegend } from "@/components/charts/trend-chart";
import { InsightCard } from "@/components/insight-card";
import { PostThumb } from "@/components/post-thumb";
import { Card, CardHeader, Delta, EmptyState, PageHeader } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { fmtCompact, fmtDate, fmtNumber, fmtRate } from "@/lib/format";
import { alignSeries } from "@/lib/metrics/series";
import { rangeFromSearchParams } from "@/lib/page-params";
import { comparePeriods, getAccountMetrics, getTopPosts } from "@/services/analytics";
import { generateStrategy } from "@/services/strategy";
import type { AccountTotals } from "@/lib/metrics/calculations";
import type { ComparableMetric } from "@/services/analytics";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const KPIS: { key: ComparableMetric; label: string; hint?: string; rate?: boolean; goodWhen?: "up" | "down" }[] = [
  { key: "reach", label: "Reach", hint: "Suma de reach diario" },
  { key: "views", label: "Views" },
  { key: "followersEnd", label: "Followers", hint: "Al final del periodo" },
  { key: "followsGained", label: "Follows gained" },
  { key: "engagementRate", label: "Engagement", hint: "Interacciones / reach", rate: true },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
];

function kpiValue(t: AccountTotals, key: ComparableMetric, rate?: boolean) {
  const v = t[key];
  return rate ? fmtRate(v) : fmtCompact(v);
}

export default async function OverviewPage({ searchParams }: Props) {
  const repo = getRepository();
  const account = await repo.getAccount();
  const { preset, range } = rangeFromSearchParams(await searchParams, account.today);

  const [cmp, current, strategy, top] = await Promise.all([
    comparePeriods(repo, range),
    getAccountMetrics(repo, range),
    generateStrategy(repo, range),
    getTopPosts(repo, range, "sharesPer1k", 5),
  ]);
  const previous = await getAccountMetrics(repo, cmp.previous.range);
  const fmtShort = (d: string) => fmtDate(d, { day: "numeric", month: "short" });
  const toPoints = (metric: "reach" | "followers") =>
    alignSeries(current.series, previous.series, metric).map((p) => ({
      label: fmtShort(p.date),
      previousLabel: p.previousDate ? fmtShort(p.previousDate) : undefined,
      current: p.current,
      previous: p.previous,
    }));
  const patterns = strategy.insights.filter((i) => i.kind === "positive" || i.kind === "negative").slice(0, 4);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          <>
            {fmtDate(range.from)} → {fmtDate(range.to)} · comparado con {fmtDate(cmp.previous.range.from)} →{" "}
            {fmtDate(cmp.previous.range.to)} · {cmp.current.postCount} publicaciones ({cmp.previous.postCount} antes)
          </>
        }
        actions={
          <Suspense>
            <PeriodPicker preset={preset} range={range} />
          </Suspense>
        }
      />

      {/* 1 — What is happening */}
      <section aria-label="Métricas clave" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {KPIS.map((k, i) => (
          <Card key={k.key} as="div" className={i === 0 ? "p-4 xl:col-span-1" : "p-4"}>
            <div className="text-xs text-ink-soft">{k.label}</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums tracking-tight">
              {kpiValue(cmp.current.totals, k.key, k.rate)}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <Delta value={cmp.change[k.key]} goodWhen={k.goodWhen} />
              <span className="truncate text-[11px] text-ink-muted" title="Periodo anterior">
                {kpiValue(cmp.previous.totals, k.key, k.rate)}
              </span>
            </div>
            {k.hint && <div className="mt-1 text-[10px] text-ink-muted">{k.hint}</div>}
          </Card>
        ))}
        <Card as="div" className="flex flex-col justify-center p-4 text-[11px] text-ink-muted">
          {cmp.caveats.length > 0 ? (
            <ul className="space-y-1">
              {cmp.caveats.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          ) : (
            "Periodos comparables: misma duración y datos completos."
          )}
        </Card>
      </section>

      {/* 3 — What to do next (kept high: it is the point of the dashboard) */}
      <Card className="mt-6 border-accent/25">
        <CardHeader
          eyebrow="What to do next"
          title="Qué haría ahora"
          description="Derivado de los patrones del periodo. Cada recomendación enlaza con sus datos y su nivel de confianza."
          right={
            <Link href="/strategy" className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
              Estrategia completa <ArrowRight size={13} />
            </Link>
          }
        />
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {strategy.whatToDoNext.length > 0 ? (
            strategy.whatToDoNext.map((i) => <InsightCard key={i.id} insight={i} compact />)
          ) : (
            <div className="md:col-span-3">
              <EmptyState title="Aún no hay evidencia suficiente para recomendar cambios">
                Se necesitan al menos 5 publicaciones clasificadas por grupo. Prueba un periodo más largo.
              </EmptyState>
            </div>
          )}
        </div>
      </Card>

      {/* 1b — trends */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Reach" description="Suma diaria de cuentas alcanzadas" right={<TrendLegend />} />
          <div className="px-3 pb-4 pt-2">
            <TrendChart data={toPoints("reach")} ariaLabel="Reach: periodo actual frente al anterior" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Followers" description="Seguidores al cierre de cada día" right={<TrendLegend />} />
          <div className="px-3 pb-4 pt-2">
            <TrendChart data={toPoints("followers")} ariaLabel="Seguidores: periodo actual frente al anterior" />
          </div>
        </Card>
      </div>

      {/* 2 — Why */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Top content"
            description="Por shares cada 1.000 cuentas alcanzadas (reach ≥ 300)"
            right={
              <Link href="/content?sort=sharesPer1k" className="text-xs text-ink-soft hover:text-ink">
                Ver todo
              </Link>
            }
          />
          <ul className="divide-y divide-border px-5 pb-2 pt-3">
            {top.length === 0 && <EmptyState title="Sin publicaciones en el periodo" />}
            {top.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <PostThumb url={p.thumbnailUrl} type={p.mediaType} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink">{p.caption.split("\n")[0]}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    {fmtDate(p.publishedAt, { day: "numeric", month: "short" })} · {p.mediaType} ·{" "}
                    {fmtCompact(p.metrics.views)} views
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums">{fmtNumber(p.rates.sharesPer1k, 1)}</div>
                  <div className="text-[10px] text-ink-muted">shares/1k</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader
            title="Patrones detectados"
            description={`Grupos con n ≥ 5 y diferencia ≥ 25 % sobre la mediana. ${strategy.skippedSmallGroups} grupos descartados por muestra pequeña.`}
          />
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {patterns.length > 0 ? (
              patterns.map((i) => <InsightCard key={i.id} insight={i} compact />)
            ) : (
              <div className="md:col-span-2">
                <EmptyState title="Ningún patrón supera los umbrales en este periodo" />
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
