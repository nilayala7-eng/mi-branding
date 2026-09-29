/**
 * Strategy service — turns metrics into structured, falsifiable insights.
 *
 * Rules enforced here (mirrors the analyst rules in src/lib/ai/analyst-rules.ts):
 *  - Groups with fewer than MIN_SAMPLE posts are never reported as patterns.
 *  - Medians, not means, so a single viral post cannot create a "pattern".
 *  - Every insight separates data / interpretation / hypothesis / recommendation.
 *  - Observational data → wording is correlational; confidence is capped.
 *  - Views alone never drive a recommendation; shares/saves/follows per 1k
 *    reach are the primary quality signals.
 */
import type { DataRepository } from "@/lib/data/repository";
import { presetRange, type DateRange } from "@/lib/domain/periods";
import type { Confidence, ExperimentMetric, StrategyInsight, TaxonomyDimensionKey } from "@/lib/domain/types";
import { comparePeriods, getContentByDimension, type GroupStats } from "@/services/analytics";

export const MIN_SAMPLE = 5;
export const LIFT_THRESHOLD = 0.25;
export const CHANGE_THRESHOLD = 0.15;

const DIMENSIONS: TaxonomyDimensionKey[] = ["topic", "hook", "cta", "format"];
const DIMENSION_LABEL: Record<TaxonomyDimensionKey, string> = {
  topic: "tema",
  subtopic: "subtema",
  hook: "hook",
  cta: "CTA",
  format: "formato",
  visual_style: "estilo visual",
  audio: "audio",
};

type RateKey = "medianSharesPer1k" | "medianSavesPer1k" | "medianFollowsPer1k";
const RATE_METRICS: { key: RateKey; label: string; experimentMetric: ExperimentMetric; digits: number }[] = [
  { key: "medianSharesPer1k", label: "shares por 1.000 cuentas alcanzadas", experimentMetric: "shares_per_1k_reach", digits: 1 },
  { key: "medianSavesPer1k", label: "guardados por 1.000 cuentas alcanzadas", experimentMetric: "saves_per_1k_reach", digits: 1 },
  { key: "medianFollowsPer1k", label: "follows por 1.000 cuentas alcanzadas", experimentMetric: "follows_per_1k_reach", digits: 2 },
];

const fmt = (n: number | null, digits = 1) =>
  n === null ? "n/d" : n.toLocaleString("es-ES", { maximumFractionDigits: digits });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;

export function lift(group: number | null, baseline: number | null): number | null {
  if (group === null || baseline === null || baseline === 0) return null;
  return group / baseline - 1;
}

/** Observational patterns are capped at "medium" — only experiments reach "high". */
export function patternConfidence(n: number): Confidence {
  if (n < MIN_SAMPLE) return "insufficient";
  if (n < 12) return "low";
  return "medium";
}

export interface SuggestedExperiment {
  name: string;
  hypothesis: string;
  metric: ExperimentMetric;
  baseline: number | null;
  baselineDescription: string;
  test: string;
  sourceInsightId: string;
}

export interface PatternResult {
  range: DateRange;
  insights: StrategyInsight[];
  suggestedExperiments: SuggestedExperiment[];
  skippedSmallGroups: number;
  untaggedPosts: number;
  totalPosts: number;
}

function commonCaveats(isMock: boolean): string[] {
  const c = ["Datos observacionales: indica correlación, no causalidad (tema, hook y momento de publicación se mezclan)."];
  if (isMock) c.unshift("DATOS DE DEMOSTRACIÓN — este patrón lo ha creado el generador mock, no tu cuenta.");
  return c;
}

export async function detectPatterns(repo: DataRepository, range: DateRange): Promise<PatternResult> {
  const account = await repo.getAccount();
  const insights: StrategyInsight[] = [];
  const experiments: SuggestedExperiment[] = [];
  let skipped = 0;
  let untagged = 0;
  let total = 0;

  for (const dimension of DIMENSIONS) {
    const breakdown = await getContentByDimension(repo, dimension, range);
    total = breakdown.totalPosts;
    if (dimension === "topic") untagged = breakdown.untaggedPosts;
    const base = breakdown.baseline;

    for (const g of breakdown.groups) {
      if (g.n < MIN_SAMPLE) {
        skipped++;
        continue;
      }
      for (const m of RATE_METRICS) {
        const l = lift(g[m.key], base[m.key]);
        if (l === null || Math.abs(l) < LIFT_THRESHOLD) continue;
        const positive = l > 0;
        const id = `${dimension}:${g.slug}:${m.key}`;
        const dimLabel = DIMENSION_LABEL[dimension];
        insights.push({
          id,
          kind: positive ? "positive" : "negative",
          title: `${dimLabel[0].toUpperCase()}${dimLabel.slice(1)} "${g.label}": ${pct(l)} ${m.label}`,
          data: {
            statement: `Las ${g.n} publicaciones con ${dimLabel} "${g.label}" tienen una mediana de ${fmt(g[m.key], m.digits)} ${m.label}, frente a ${fmt(base[m.key], m.digits)} del total de ${breakdown.totalPosts} publicaciones del periodo.`,
            evidence: [
              { label: "Publicaciones en el grupo", value: String(g.n) },
              { label: `Mediana grupo (${m.label})`, value: fmt(g[m.key], m.digits) },
              { label: "Mediana cuenta", value: fmt(base[m.key], m.digits) },
              { label: "Diferencia relativa", value: pct(l) },
              { label: "Mediana de views del grupo", value: fmt(g.medianViews, 0) },
            ],
            sampleSize: g.n,
            period: range,
          },
          interpretation: positive
            ? `El contenido etiquetado como "${g.label}" se asocia con más ${m.label} que la media de la cuenta.`
            : `El contenido etiquetado como "${g.label}" se asocia con menos ${m.label} que la media de la cuenta.`,
          hypothesis: positive
            ? `Puede que "${g.label}" como ${dimLabel} provoque más ${m.label.split(" por ")[0]} en tu audiencia, pero también podría deberse a otros factores que coinciden en esas publicaciones.`
            : `Puede que "${g.label}" como ${dimLabel} no conecte con tu audiencia para este objetivo, o que se haya combinado con otros elementos más débiles.`,
          recommendation: positive
            ? `Diseñar un experimento controlado: repetir "${g.label}" manteniendo fijos los demás elementos y medir ${m.label}.`
            : `No eliminarlo todavía: revisar las publicaciones del grupo y probar una variante antes de decidir.`,
          confidence: patternConfidence(g.n),
          caveats: [
            ...commonCaveats(account.isMock),
            ...(g.n < 12 ? [`Muestra pequeña (n=${g.n}); tratar como pista, no como conclusión.`] : []),
          ],
        });
        if (positive) {
          experiments.push({
            name: `${dimLabel[0].toUpperCase()}${dimLabel.slice(1)}: ${g.label}`,
            hypothesis: `Las publicaciones con ${dimLabel} "${g.label}" generan más ${m.label} que la mediana de la cuenta.`,
            metric: m.experimentMetric,
            baseline: base[m.key],
            baselineDescription: `Mediana de la cuenta ${range.from} → ${range.to} (n=${breakdown.totalPosts}).`,
            test: `Publicar al menos 6 piezas con ${dimLabel} "${g.label}" en 3–4 semanas, manteniendo formato y horario habituales.`,
            sourceInsightId: id,
          });
        }
      }

      // Views up but follows down → "reach without conversion" opportunity.
      const viewsLift = lift(g.medianViews, base.medianViews);
      const followsLift = lift(g.medianFollowsPer1k, base.medianFollowsPer1k);
      if (viewsLift !== null && followsLift !== null && viewsLift >= 0.2 && followsLift <= -0.2) {
        insights.push(viewsWithoutFollows(dimension, g, base, viewsLift, followsLift, range, account.isMock));
      }
    }
  }

  // Recent changes: last 30 days vs the previous 30.
  const recent = presetRange("30d", account.today);
  const cmp = await comparePeriods(repo, recent);
  const changeMetrics: { key: keyof typeof cmp.change; label: string }[] = [
    { key: "reach", label: "Reach (suma diaria)" },
    { key: "views", label: "Views" },
    { key: "shares", label: "Shares" },
    { key: "saves", label: "Guardados" },
    { key: "followsGained", label: "Follows" },
    { key: "engagementRate", label: "Engagement rate" },
  ];
  for (const cm of changeMetrics) {
    const c = cmp.change[cm.key];
    if (c === null || Math.abs(c) < CHANGE_THRESHOLD) continue;
    const cur = cmp.current.totals[cm.key];
    const prev = cmp.previous.totals[cm.key];
    const isRate = cm.key === "engagementRate";
    insights.push({
      id: `change:${cm.key}`,
      kind: "change",
      title: `${cm.label}: ${pct(c)} vs 30 días anteriores`,
      data: {
        statement: `${cm.label} pasó de ${isRate ? fmt((prev as number) * 100, 2) + "%" : fmt(prev, 0)} a ${isRate ? fmt((cur as number) * 100, 2) + "%" : fmt(cur, 0)} (${cmp.previous.postCount} → ${cmp.current.postCount} publicaciones).`,
        evidence: [
          { label: "Periodo actual", value: `${recent.from} → ${recent.to}` },
          { label: "Periodo anterior", value: `${cmp.previous.range.from} → ${cmp.previous.range.to}` },
          { label: "Cambio", value: pct(c) },
        ],
        sampleSize: cmp.current.postCount,
        period: recent,
      },
      interpretation: "Cambio a nivel de cuenta; aún no está atribuido a ningún tipo de contenido.",
      hypothesis: null,
      recommendation: "Revisar qué publicaciones concentran el cambio antes de sacar conclusiones.",
      confidence: "low",
      caveats: [...commonCaveats(account.isMock), ...cmp.caveats],
    });
  }

  if (untagged > 0) {
    insights.push({
      id: "opportunity:untagged",
      kind: "opportunity",
      title: untagged === 1 ? "1 publicación sin clasificar" : `${untagged} publicaciones sin clasificar`,
      data: {
        statement: `${untagged} de ${total} publicaciones del periodo no tienen tema asignado y quedan fuera del análisis de patrones.`,
        evidence: [
          { label: "Sin clasificar", value: String(untagged) },
          { label: "Total periodo", value: String(total) },
        ],
        sampleSize: total,
        period: range,
      },
      interpretation: "Cuantas más publicaciones clasificadas, más fiables serán los patrones.",
      hypothesis: null,
      recommendation: "Clasificarlas (manualmente o con Claude) desde Content.",
      confidence: "high",
      caveats: account.isMock ? commonCaveats(true).slice(0, 1) : [],
    });
  }

  return {
    range,
    insights,
    suggestedExperiments: experiments,
    skippedSmallGroups: skipped,
    untaggedPosts: untagged,
    totalPosts: total,
  };
}

function viewsWithoutFollows(
  dimension: TaxonomyDimensionKey,
  g: GroupStats,
  base: Omit<GroupStats, "slug" | "label">,
  viewsLift: number,
  followsLift: number,
  range: DateRange,
  isMock: boolean,
): StrategyInsight {
  const dimLabel = DIMENSION_LABEL[dimension];
  return {
    id: `opportunity:${dimension}:${g.slug}:views-no-follows`,
    kind: "opportunity",
    title: `"${g.label}" atrae views pero convierte poco en follows`,
    data: {
      statement: `Mediana de views ${pct(viewsLift)} sobre la cuenta, pero follows por 1.000 alcanzadas ${pct(followsLift)} (n=${g.n}).`,
      evidence: [
        { label: "Mediana views grupo", value: fmt(g.medianViews, 0) },
        { label: "Mediana views cuenta", value: fmt(base.medianViews, 0) },
        { label: "Follows/1k grupo", value: fmt(g.medianFollowsPer1k, 2) },
        { label: "Follows/1k cuenta", value: fmt(base.medianFollowsPer1k, 2) },
      ],
      sampleSize: g.n,
      period: range,
    },
    interpretation: `Este ${dimLabel} llega a más gente, pero esa gente sigue la cuenta en menor proporción.`,
    hypothesis: "Puede que atraiga a una audiencia fuera de tu público objetivo, o que el CTA/perfil no dé motivos para seguir.",
    recommendation: "Probar el mismo tema con un cierre que conecte con tu propuesta (hombres ocupados 30–50) y un CTA de seguimiento.",
    confidence: patternConfidence(g.n),
    caveats: commonCaveats(isMock),
  };
}

const CONFIDENCE_RANK: Record<Confidence, number> = { insufficient: 0, low: 1, medium: 2, high: 3 };

export interface StrategySummary extends PatternResult {
  whatToDoNext: StrategyInsight[];
}

/**
 * Deterministic strategy summary. Claude can later enrich it (see
 * src/lib/ai), but the numbers and structure always come from here.
 */
export async function generateStrategy(repo: DataRepository, range: DateRange): Promise<StrategySummary> {
  const result = await detectPatterns(repo, range);
  const actionable = result.insights
    .filter((i) => i.recommendation && i.confidence !== "insufficient")
    .sort((a, b) => {
      const kindOrder = (k: StrategyInsight["kind"]) => (k === "positive" ? 0 : k === "opportunity" ? 1 : k === "negative" ? 2 : 3);
      return (
        CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] ||
        kindOrder(a.kind) - kindOrder(b.kind) ||
        b.data.sampleSize - a.data.sampleSize
      );
    });
  return { ...result, whatToDoNext: actionable.slice(0, 3) };
}
