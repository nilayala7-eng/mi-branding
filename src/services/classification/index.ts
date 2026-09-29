/**
 * Content classification.
 *
 * `ContentClassifier` is the extension point: the rule-based classifier below
 * is the Phase-1 baseline; a Claude-backed classifier (Phase 3) implements the
 * same interface. Classifiers only ever choose from the taxonomy passed in, so
 * categories can be added/renamed in the DB without code changes.
 */
import type { ContentTag, Post, TaxonomyDimensionKey, TaxonomyValue } from "@/lib/domain/types";

export interface ContentClassifier {
  readonly name: string;
  classify(post: Pick<Post, "caption" | "mediaType">, taxonomy: TaxonomyValue[]): Promise<ContentTag[]>;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keywords for a value: its label + slug words + optional "keywords:" line in description. */
export function keywordsFor(value: TaxonomyValue): string[] {
  const fromDescription =
    value.description?.match(/keywords:\s*(.+)$/im)?.[1].split(",").map((k) => normalize(k)).filter(Boolean) ?? [];
  return [...new Set([normalize(value.label), normalize(value.slug.replace(/-/g, " ")), ...fromDescription])].filter(
    (k) => k.length >= 3,
  );
}

const RULE_DIMENSIONS: TaxonomyDimensionKey[] = ["topic", "subtopic", "cta"];

/**
 * Transparent keyword matcher. Low confidence by design (0.5): it is a
 * starting point for human review, not ground truth.
 */
export class RuleBasedClassifier implements ContentClassifier {
  readonly name = "rule-based-v1";

  async classify(post: Pick<Post, "caption" | "mediaType">, taxonomy: TaxonomyValue[]): Promise<ContentTag[]> {
    const text = ` ${normalize(post.caption)} `;
    const tags: ContentTag[] = [];
    for (const dimension of RULE_DIMENSIONS) {
      const candidates = taxonomy.filter((v) => v.dimension === dimension && v.active);
      let best: { value: TaxonomyValue; hits: number } | null = null;
      for (const value of candidates) {
        const hits = keywordsFor(value).filter((k) => text.includes(` ${k} `) || text.includes(` ${k}`)).length;
        if (hits > 0 && (!best || hits > best.hits)) best = { value, hits };
      }
      if (best) {
        tags.push({
          dimension,
          valueId: best.value.id,
          slug: best.value.slug,
          label: best.value.label,
          source: "rule",
          confidence: 0.5,
        });
      }
    }
    return tags;
  }
}

/**
 * Merge new tags into existing ones. Manual tags always win; otherwise a new
 * tag replaces an existing one on the same dimension only if it is more
 * confident. Single-valued per dimension (DECISIONS.md D-011).
 */
export function mergeTags(existing: ContentTag[], incoming: ContentTag[]): ContentTag[] {
  const byDim = new Map<TaxonomyDimensionKey, ContentTag>();
  for (const t of existing) byDim.set(t.dimension, t);
  for (const t of incoming) {
    const cur = byDim.get(t.dimension);
    if (!cur) byDim.set(t.dimension, t);
    else if (cur.source !== "manual" && (t.source === "manual" || t.confidence > cur.confidence)) byDim.set(t.dimension, t);
  }
  return [...byDim.values()];
}
