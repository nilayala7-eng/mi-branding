/**
 * Initial taxonomy SEED. This is starting data, not logic: in production it is
 * inserted once into `taxonomy_values` (see supabase/seed.sql) and from then on
 * edited from Settings. No service may branch on a specific slug.
 *
 * Presence in this list does NOT mean the topic works — the app must discover
 * that from the data.
 */
import type { TaxonomyDimensionKey } from "@/lib/domain/types";

export interface TaxonomySeedValue {
  dimension: TaxonomyDimensionKey;
  slug: string;
  label: string;
  parent?: string; // slug of parent (subtopic → topic)
  description?: string;
}

export const TAXONOMY_DIMENSIONS: { key: TaxonomyDimensionKey; label: string; description: string }[] = [
  { key: "topic", label: "Topic", description: "Tema principal del contenido" },
  { key: "subtopic", label: "Subtopic", description: "Ángulo concreto dentro del tema" },
  { key: "hook", label: "Hook", description: "Mecanismo de apertura (primeros 1–3 s)" },
  { key: "cta", label: "CTA", description: "Llamada a la acción" },
  { key: "format", label: "Format", description: "Formato de producción" },
  { key: "visual_style", label: "Visual style", description: "Contexto visual" },
  { key: "audio", label: "Audio", description: "Tipo de audio" },
];

export const TAXONOMY_SEED: TaxonomySeedValue[] = [
  // Topics
  { dimension: "topic", slug: "falta-de-tiempo", label: "Falta de tiempo" },
  { dimension: "topic", slug: "cansancio", label: "Cansancio" },
  { dimension: "topic", slug: "consistencia", label: "Consistencia" },
  { dimension: "topic", slug: "fuerza", label: "Fuerza" },
  { dimension: "topic", slug: "cardio", label: "Cardio" },
  { dimension: "topic", slug: "nutricion", label: "Nutrición" },
  { dimension: "topic", slug: "perdida-de-grasa", label: "Pérdida de grasa" },
  { dimension: "topic", slug: "habitos", label: "Hábitos" },
  { dimension: "topic", slug: "sueno", label: "Sueño" },
  { dimension: "topic", slug: "estres", label: "Estrés" },
  { dimension: "topic", slug: "entrenamiento-eficiente", label: "Entrenamiento eficiente" },
  // Subtopics
  { dimension: "subtopic", slug: "cansancio-post-trabajo", label: "Cansancio después del trabajo", parent: "cansancio" },
  { dimension: "subtopic", slug: "entrenos-cortos", label: "Entrenos de 30 min o menos", parent: "falta-de-tiempo" },
  { dimension: "subtopic", slug: "viajes-trabajo", label: "Entrenar viajando por trabajo", parent: "falta-de-tiempo" },
  { dimension: "subtopic", slug: "volver-a-empezar", label: "Volver a empezar", parent: "consistencia" },
  { dimension: "subtopic", slug: "comer-fuera", label: "Comer fuera / menú del día", parent: "nutricion" },
  { dimension: "subtopic", slug: "proteina-facil", label: "Proteína fácil", parent: "nutricion" },
  { dimension: "subtopic", slug: "fuerza-basica", label: "Básicos de fuerza", parent: "fuerza" },
  // Hooks
  { dimension: "hook", slug: "problem-solution", label: "Problem / solution" },
  { dimension: "hook", slug: "pregunta", label: "Pregunta directa" },
  { dimension: "hook", slug: "mito", label: "Mito / creencia falsa" },
  { dimension: "hook", slug: "error-comun", label: "Error común" },
  { dimension: "hook", slug: "historia-personal", label: "Historia personal / cliente" },
  { dimension: "hook", slug: "lista", label: "Lista (X cosas…)" },
  { dimension: "hook", slug: "contraintuitivo", label: "Afirmación contraintuitiva" },
  // CTAs
  { dimension: "cta", slug: "comenta-palabra", label: "Comenta palabra clave", description: 'Ej.: "Comenta CARDIO"' },
  { dimension: "cta", slug: "guarda", label: "Guárdalo" },
  { dimension: "cta", slug: "comparte", label: "Compártelo" },
  { dimension: "cta", slug: "sigueme", label: "Sígueme" },
  { dimension: "cta", slug: "dm", label: "Escríbeme por DM" },
  { dimension: "cta", slug: "link-bio", label: "Link en bio" },
  { dimension: "cta", slug: "sin-cta", label: "Sin CTA" },
  // Formats
  { dimension: "format", slug: "talking-head", label: "Talking head" },
  { dimension: "format", slug: "talking-head-broll", label: "Talking head + B-roll" },
  { dimension: "format", slug: "voiceover-broll", label: "Voice-over + B-roll" },
  { dimension: "format", slug: "texto-en-pantalla", label: "Texto en pantalla" },
  { dimension: "format", slug: "tutorial-ejercicio", label: "Tutorial de ejercicio" },
  { dimension: "format", slug: "carrusel-educativo", label: "Carrusel educativo" },
  // Visual style
  { dimension: "visual_style", slug: "gym", label: "Gimnasio" },
  { dimension: "visual_style", slug: "casa", label: "Casa" },
  { dimension: "visual_style", slug: "exterior", label: "Exterior" },
  { dimension: "visual_style", slug: "oficina", label: "Oficina / trabajo" },
  { dimension: "visual_style", slug: "diseno-grafico", label: "Diseño gráfico" },
  // Audio
  { dimension: "audio", slug: "voz-original", label: "Voz original" },
  { dimension: "audio", slug: "trending", label: "Audio en tendencia" },
  { dimension: "audio", slug: "musica-libre", label: "Música de librería" },
  { dimension: "audio", slug: "sin-audio", label: "Sin audio" },
];
