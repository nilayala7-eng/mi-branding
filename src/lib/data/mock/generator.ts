/**
 * Deterministic MOCK data generator (Phase 1 only).
 *
 * Produces plausible-looking data so the UI and analytics can be built before
 * Instagram is connected. Numbers here are FAKE. Any "pattern" visible in mock
 * data is an artefact of this generator and says nothing about the real
 * account. The UI shows a persistent "Datos de demostración" banner.
 */
import { addDays, eachDay } from "@/lib/domain/periods";
import type {
  AccountDailyMetrics,
  ContentTag,
  ISODate,
  MediaType,
  Post,
  TaxonomyDimensionKey,
  TaxonomyValue,
} from "@/lib/domain/types";
import { TAXONOMY_SEED } from "../taxonomy-seed";

/** mulberry32 — small, fast, deterministic PRNG. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    /** Log-normal-ish multiplier around 1. */
    spread: (sigma: number) => Math.exp((next() + next() + next() - 1.5) * sigma),
  };
}

export const MOCK_ACCOUNT_ID = "mock-account";

export function mockTaxonomy(): TaxonomyValue[] {
  return TAXONOMY_SEED.map((v) => ({
    id: `${v.dimension}:${v.slug}`,
    dimension: v.dimension,
    slug: v.slug,
    label: v.label,
    parentId: v.parent ? `topic:${v.parent}` : null,
    description: v.description ?? null,
    active: true,
  }));
}

const CAPTION_OPENERS: Record<string, string[]> = {
  "falta-de-tiempo": ["No tienes una hora para entrenar. Ni falta que hace.", "30 minutos, 3 días. Así empiezo con clientes que no tienen tiempo."],
  cansancio: ["Llegas del trabajo reventado. ¿Entrenas o no?", "El cansancio mental no es lo mismo que el físico."],
  consistencia: ["No te falta motivación. Te falta un plan que quepa en tu semana.", "¿Un día flojo? Pasa. Mañana seguimos."],
  fuerza: ["Tres ejercicios que haría si solo pudiera hacer tres.", "La fuerza es el seguro de vida que nadie te vende."],
  cardio: ["El cardio no es el enemigo de tus músculos.", "Caminar cuenta. Y mucho más de lo que crees."],
  nutricion: ["Comer fuera cada día y aun así perder grasa.", "Tres comidas sencillas que hago cada semana."],
  "perdida-de-grasa": ["No necesitas contar cada caloría.", "Por qué la báscula te engaña los lunes."],
  habitos: ["Un hábito pequeño gana a un plan perfecto.", "Lo que hago los domingos para que la semana funcione."],
  sueno: ["Duermes 6 horas y quieres rendir como si durmieras 8.", "El entrenamiento que más ignoras: dormir."],
  estres: ["Entrenar para bajar el estrés, no para sumar más.", "Cuando el trabajo aprieta, esto es lo mínimo que hago."],
  "entrenamiento-eficiente": ["Superseries: el truco para entrenar en la mitad de tiempo.", "Deja de descansar 4 minutos entre series."],
};

const CTA_TEXT: Record<string, string> = {
  "comenta-palabra": "Comenta CARDIO y te paso la rutina.",
  guarda: "Guárdalo para cuando lo necesites.",
  comparte: "Compártelo con quien siempre dice que no tiene tiempo.",
  sigueme: "Sígueme para más entrenos que caben en tu semana.",
  dm: "¿Empezamos juntos? Escríbeme.",
  "link-bio": "Plan completo en el link de la bio.",
  "sin-cta": "",
};

function tag(dimension: TaxonomyDimensionKey, slug: string, labels: Map<string, string>, rng: ReturnType<typeof createRng>): ContentTag {
  const claude = rng.chance(0.6);
  return {
    dimension,
    valueId: `${dimension}:${slug}`,
    slug,
    label: labels.get(`${dimension}:${slug}`) ?? slug,
    source: claude ? "claude" : "manual",
    confidence: claude ? Math.round((0.6 + rng.next() * 0.35) * 100) / 100 : 1,
  };
}

export interface MockDataset {
  accountDays: AccountDailyMetrics[];
  posts: Post[];
  taxonomy: TaxonomyValue[];
}

/**
 * @param today   account-local anchor date; data covers `historyDays` ending there
 * @param seed    PRNG seed; same inputs → identical dataset
 */
export function generateMockDataset(today: ISODate, seed = 42, historyDays = 400): MockDataset {
  const rng = createRng(seed);
  const taxonomy = mockTaxonomy();
  const labels = new Map(taxonomy.map((t) => [t.id, t.label]));
  const bySlug = (d: TaxonomyDimensionKey) => TAXONOMY_SEED.filter((v) => v.dimension === d);

  const topics = bySlug("topic").map((v) => v.slug);
  const hooks = bySlug("hook").map((v) => v.slug);
  const ctas = bySlug("cta").map((v) => v.slug);
  const videoFormats = ["talking-head", "talking-head-broll", "voiceover-broll", "texto-en-pantalla", "tutorial-ejercicio"];
  const visuals = bySlug("visual_style").map((v) => v.slug);

  // Hidden per-slug effects so the analytics have something to find in demo mode.
  const effect = new Map<string, number>();
  for (const v of TAXONOMY_SEED) effect.set(`${v.dimension}:${v.slug}`, rng.spread(0.35));

  const from = addDays(today, -(historyDays - 1));
  const days = eachDay({ from, to: today });

  // --- posts ---------------------------------------------------------------
  const posts: Post[] = [];
  let postIndex = 0;
  for (const day of days) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const pPost = dow === 1 || dow === 3 || dow === 5 ? 0.75 : 0.12;
    if (!rng.chance(pPost)) continue;

    const mediaType: MediaType = rng.chance(0.72) ? "REEL" : rng.chance(0.8) ? "CAROUSEL" : "IMAGE";
    const topic = rng.pick(topics);
    const hook = rng.pick(hooks);
    const cta = rng.pick(ctas);
    const format = mediaType === "REEL" ? rng.pick(videoFormats) : mediaType === "CAROUSEL" ? "carrusel-educativo" : "texto-en-pantalla";
    const visual = mediaType === "REEL" ? rng.pick(visuals.filter((v) => v !== "diseno-grafico")) : "diseno-grafico";
    const audio = mediaType === "REEL" ? (rng.chance(0.7) ? "voz-original" : rng.pick(["trending", "musica-libre"])) : "sin-audio";
    const subtopic = TAXONOMY_SEED.find((v) => v.dimension === "subtopic" && v.parent === topic && rng.chance(0.7));

    const hour = rng.pick([7, 8, 13, 14, 18, 19, 20, 21]);
    const minute = rng.int(0, 59);
    // Europe/Madrid is UTC+1/+2; store UTC. Approximate with -1h for mock purposes.
    const publishedAt = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
    publishedAt.setUTCHours(publishedAt.getUTCHours() - 1);

    const e = (d: TaxonomyDimensionKey, s: string) => effect.get(`${d}:${s}`) ?? 1;
    const growth = 1 + (days.indexOf(day) / days.length) * 0.6; // account grows over time
    const typeBase = mediaType === "REEL" ? 3200 : mediaType === "CAROUSEL" ? 1400 : 700;
    const quality = e("topic", topic) * e("hook", hook) * e("format", format) * rng.spread(0.9);
    const reach = Math.round(typeBase * growth * quality);
    const views = Math.round(reach * (mediaType === "REEL" ? 1.35 + rng.next() * 0.5 : 1.8 + rng.next()));
    const likes = Math.round(reach * 0.045 * rng.spread(0.3));
    const comments = Math.round(reach * (cta === "comenta-palabra" ? 0.012 : 0.003) * rng.spread(0.5));
    const shares = Math.round(reach * 0.006 * e("topic", topic) * e("cta", cta) * rng.spread(0.6));
    const saves = Math.round(reach * (mediaType === "CAROUSEL" ? 0.02 : 0.008) * e("subtopic", subtopic?.slug ?? "") * rng.spread(0.5));
    const follows = Math.round(reach * 0.0025 * e("hook", hook) * e("cta", cta) * rng.spread(0.7));

    const tags: ContentTag[] = [
      tag("topic", topic, labels, rng),
      tag("hook", hook, labels, rng),
      tag("cta", cta, labels, rng),
      tag("format", format, labels, rng),
      tag("visual_style", visual, labels, rng),
      tag("audio", audio, labels, rng),
    ];
    if (subtopic) tags.push(tag("subtopic", subtopic.slug, labels, rng));
    // ~10% of posts still untagged to exercise the "pending classification" path
    const finalTags = rng.chance(0.1) ? [] : tags;

    const opener = rng.pick(CAPTION_OPENERS[topic] ?? ["Vamos poco a poco."]);
    const caption = [opener, "Te lo explico fácil 👇", CTA_TEXT[cta]].filter(Boolean).join("\n\n");

    postIndex++;
    posts.push({
      id: `mock-post-${postIndex}`,
      accountId: MOCK_ACCOUNT_ID,
      igMediaId: `1790000000${String(postIndex).padStart(6, "0")}`,
      mediaType,
      caption,
      permalink: null,
      thumbnailUrl: null,
      publishedAt: publishedAt.toISOString(),
      durationSec: mediaType === "REEL" ? rng.int(12, 75) : null,
      metrics: {
        views,
        reach,
        likes,
        comments,
        shares,
        saves,
        follows,
        profileVisits: Math.round(reach * 0.02 * rng.spread(0.4)),
        avgWatchTimeSec: mediaType === "REEL" ? Math.round((4 + rng.next() * 9) * 10) / 10 : null,
      },
      metricsUpdatedAt: `${today}T06:00:00.000Z`,
      tags: finalTags,
    });
  }

  // --- account days ----------------------------------------------------------
  const postsByDay = new Map<string, Post[]>();
  for (const p of posts) {
    const d = p.publishedAt.slice(0, 10);
    postsByDay.set(d, [...(postsByDay.get(d) ?? []), p]);
  }

  let followers = 4200;
  let carry = 0; // post reach decays over following days
  const accountDays: AccountDailyMetrics[] = days.map((date, i) => {
    const todays = postsByDay.get(date) ?? [];
    const fresh = todays.reduce((s, p) => s + (p.metrics.reach ?? 0), 0);
    carry = carry * 0.55 + fresh * 0.6;
    const base = 350 * (1 + (i / days.length) * 0.6);
    const reach = Math.round(base * rng.spread(0.25) + carry);
    const gained = Math.max(0, Math.round(reach * 0.0028 * rng.spread(0.5)));
    const lost = Math.max(0, Math.round(gained * (0.25 + rng.next() * 0.3)));
    followers += gained - lost;
    return {
      date,
      followers,
      followsGained: gained,
      unfollows: lost,
      reach,
      views: Math.round(reach * (1.5 + rng.next() * 0.4)),
      likes: Math.round(reach * 0.04 * rng.spread(0.2)),
      comments: Math.round(reach * 0.004 * rng.spread(0.4)),
      shares: Math.round(reach * 0.005 * rng.spread(0.4)),
      saves: Math.round(reach * 0.007 * rng.spread(0.4)),
      profileVisits: Math.round(reach * 0.018 * rng.spread(0.3)),
    };
  });

  return { accountDays, posts, taxonomy };
}
