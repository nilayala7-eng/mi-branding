/**
 * Live Instagram stats for Claude — no web app, no database.
 * Reads IG_ACCESS_TOKEN (Instagram API with Instagram Login, your own account)
 * from the environment and prints compact text that Claude interprets.
 *
 *   npm run ig -- cuenta              profile + token check
 *   npm run ig -- resumen [días=30]   account totals vs previous period
 *   npm run ig -- top [días=30] [métrica=valor]
 *        métricas: valor (compartidos+guardados /1k alcance), views, reach,
 *                  shares, saves, likes, comments, follows
 *   npm run ig -- posts [n=12]        latest posts with metrics
 */
import { GraphApiError, GraphClient } from "../src/lib/meta/graph-client";
import { getProfile, MetaInstagramSource } from "../src/lib/meta/source";
import { ACCOUNT_INSIGHTS_MAX_LOOKBACK_DAYS } from "../src/lib/meta/config";
import { addDays } from "../src/lib/domain/periods";
import { localDate } from "../src/lib/metrics/filters";
import { median } from "../src/lib/metrics/calculations";
import type { SnapshotMetrics, SourceAccountDay, SourceMedia } from "../src/services/instagram/sync";

const TZ = process.env.ACCOUNT_TIMEZONE || "Europe/Madrid";
const VERSION = process.env.META_GRAPH_API_VERSION || "v26.0";

type Row = { media: SourceMedia; m: SnapshotMetrics };
const SORTS: Record<string, (m: SnapshotMetrics) => number | null> = {
  valor: (m) => per1k(sumOrNull(m.shares, m.saves), m.reach),
  views: (m) => m.views ?? null,
  reach: (m) => m.reach ?? null,
  shares: (m) => m.shares ?? null,
  saves: (m) => m.saves ?? null,
  likes: (m) => m.likes ?? null,
  comments: (m) => m.comments ?? null,
  follows: (m) => m.follows ?? null,
};

function sumOrNull(...xs: (number | null | undefined)[]): number | null {
  const known = xs.filter((x): x is number => x != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}
function per1k(n: number | null, reach: number | null | undefined): number | null {
  return n == null || !reach ? null : Math.round((n / reach) * 10000) / 10;
}
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-ES"));
function pct(cur: number | null, prev: number | null): string {
  if (cur == null || prev == null || prev === 0) return "";
  const d = Math.round(((cur - prev) / prev) * 100);
  return ` (${d >= 0 ? "+" : ""}${d}% vs periodo anterior: ${fmt(prev)})`;
}
const today = () => localDate(new Date().toISOString(), TZ);
const int = (s: string | undefined, def: number) => {
  const n = Number.parseInt(s ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : def;
};

async function setup() {
  const token = process.env.IG_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("Falta IG_ACCESS_TOKEN en el entorno (ver INSTAGRAM.md).");
    process.exit(2);
  }
  const client = new GraphClient(token, VERSION);
  const profile = await getProfile(client);
  const source = new MetaInstagramSource(client, profile.user_id ?? profile.id, TZ);
  return { client, profile, source };
}

async function postsSince(source: MetaInstagramSource, from: string | null, limit: number): Promise<Row[]> {
  const media = (await source.listMedia()).filter((m) => m.mediaType !== "STORY");
  const picked = media
    .filter((m) => from == null || localDate(m.publishedAt, TZ) >= from)
    .slice(0, limit);
  const rows: Row[] = [];
  for (const m of picked) rows.push({ media: m, m: await source.getMediaInsights(m) });
  return rows;
}

function printPost({ media, m }: Row, i: number) {
  const caption = media.caption.replace(/\s+/g, " ").slice(0, 70);
  const watch = m.extra?.ig_reels_avg_watch_time;
  console.log(
    `${i + 1}. ${localDate(media.publishedAt, TZ)} · ${media.mediaType} · "${caption}${media.caption.length > 70 ? "…" : ""}"\n` +
      `   views ${fmt(m.views)} · alcance ${fmt(m.reach)} · likes ${fmt(m.likes)} · coment. ${fmt(m.comments)} · ` +
      `compartidos ${fmt(m.shares)} · guardados ${fmt(m.saves)} · follows ${fmt(m.follows)}\n` +
      `   por 1k alcance: compartidos ${fmt(per1k(m.shares ?? null, m.reach))} · guardados ${fmt(per1k(m.saves ?? null, m.reach))}` +
      (watch != null ? ` · ig_reels_avg_watch_time (bruto) ${fmt(watch)}` : "") +
      (media.permalink ? `\n   ${media.permalink}` : ""),
  );
}

function sumDays(days: SourceAccountDay[], k: keyof SourceAccountDay) {
  return sumOrNull(...days.map((d) => d[k] as number | null));
}

async function main() {
  const [cmd = "resumen", a1, a2] = process.argv.slice(2);
  const { profile, source } = await setup();
  console.log(`@${profile.username} · seguidores ${fmt(profile.followers_count)} · publicaciones ${fmt(profile.media_count)} · zona ${TZ}`);

  if (cmd === "cuenta") {
    console.log(`Tipo de cuenta: ${profile.account_type ?? "—"} · token OK`);
    return;
  }

  if (cmd === "posts") {
    const rows = await postsSince(source, null, int(a1, 12));
    rows.forEach(printPost);
    return;
  }

  if (cmd === "top") {
    const days = int(a1, 30);
    const key = (a2 ?? "valor").toLowerCase();
    const by = SORTS[key];
    if (!by) throw new Error(`Métrica desconocida: ${key}. Usa: ${Object.keys(SORTS).join(", ")}`);
    const from = addDays(today(), -days);
    const rows = await postsSince(source, from, 200);
    rows.sort((x, y) => (by(y.m) ?? -Infinity) - (by(x.m) ?? -Infinity));
    console.log(`Publicaciones desde ${from}: ${rows.length} · orden: ${key}${key === "valor" ? " (compartidos+guardados por 1k alcance)" : ""}`);
    if (rows.length < 5) console.log("Aviso: menos de 5 publicaciones → muestra insuficiente para hablar de patrones.");
    rows.forEach(printPost);
    return;
  }

  if (cmd === "resumen") {
    // Last complete day is yesterday; Meta can lag up to 48 h.
    const days = int(a1, 30);
    const to = addDays(today(), -1);
    const from = addDays(to, -(days - 1));
    const withPrev = days * 2 <= ACCOUNT_INSIGHTS_MAX_LOOKBACK_DAYS;
    const cur = await source.getAccountDays({ from, to });
    const prev = withPrev ? await source.getAccountDays({ from: addDays(from, -days), to: addDays(from, -1) }) : [];
    console.log(`Periodo ${from} → ${to} (${days} días)${withPrev ? "" : " · sin comparación: Meta solo da 90 días de datos de cuenta"}`);
    const line = (label: string, k: keyof SourceAccountDay) =>
      console.log(`- ${label}: ${fmt(sumDays(cur, k))}${withPrev ? pct(sumDays(cur, k), sumDays(prev, k)) : ""}`);
    line("Alcance (suma de alcance diario, no cuentas únicas)", "reach");
    line("Visualizaciones", "views");
    line("Seguidores ganados", "followsGained");
    line("Dejaron de seguir", "unfollows");
    line("Likes", "likes");
    line("Comentarios", "comments");
    line("Compartidos", "shares");
    line("Guardados", "saves");

    const rows = await postsSince(source, from, 200);
    const med = (f: (m: SnapshotMetrics) => number | null) =>
      median(rows.map((r) => f(r.m)).filter((x): x is number => x != null));
    console.log(`Publicaciones en el periodo: ${rows.length}` + (rows.length ? "" : " (nada que comparar)"));
    if (rows.length) {
      console.log(
        `Mediana por publicación: views ${fmt(med(SORTS.views))} · alcance ${fmt(med(SORTS.reach))} · ` +
          `compartidos+guardados por 1k alcance ${fmt(med(SORTS.valor))}`,
      );
      rows.sort((x, y) => (SORTS.valor(y.m) ?? -Infinity) - (SORTS.valor(x.m) ?? -Infinity));
      console.log("Mejores por valor (compartidos+guardados /1k alcance):");
      rows.slice(0, 3).forEach(printPost);
      if (rows.length > 3) {
        console.log("Peores por valor:");
        rows.slice(-3).forEach((r, i) => printPost(r, rows.length - 3 + i));
      }
    }
    return;
  }

  throw new Error(`Comando desconocido: ${cmd}. Usa: cuenta, resumen, top, posts`);
}

main().catch((e) => {
  if (e instanceof GraphApiError && e.isAuthError) {
    console.error("El token de Instagram no es válido o ha caducado: genera uno nuevo (INSTAGRAM.md).");
  } else {
    console.error(e instanceof Error ? e.message : String(e));
  }
  process.exit(1);
});
