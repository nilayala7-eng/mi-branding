import { describe, expect, it } from "vitest";
import { mockTaxonomy } from "@/lib/data/mock/generator";
import type { TaxonomyValue } from "@/lib/domain/types";
import { tag } from "@/test/fixtures";
import { keywordsFor, mergeTags, normalize, RuleBasedClassifier } from ".";

const taxonomy = mockTaxonomy();

describe("normalize", () => {
  it("lowercases and strips accents and punctuation", () => {
    expect(normalize("¡Nutrición y SUEÑO!")).toBe("nutricion y sueno");
  });
});

describe("RuleBasedClassifier", () => {
  const c = new RuleBasedClassifier();

  it("picks topics from the taxonomy passed in", async () => {
    const tags = await c.classify({ caption: "Hoy va de cardio: caminar cuenta.", mediaType: "REEL" }, taxonomy);
    expect(tags.find((t) => t.dimension === "topic")?.slug).toBe("cardio");
    expect(tags.every((t) => t.source === "rule" && t.confidence < 1)).toBe(true);
  });

  it("matches accent-insensitively", async () => {
    const tags = await c.classify({ caption: "Tips de NUTRICION para comer fuera", mediaType: "REEL" }, taxonomy);
    expect(tags.find((t) => t.dimension === "topic")?.slug).toBe("nutricion");
  });

  it("returns nothing rather than guessing", async () => {
    expect(await c.classify({ caption: "Buenos días 🙌", mediaType: "IMAGE" }, taxonomy)).toEqual([]);
  });

  it("new categories work without code changes (taxonomy is data)", async () => {
    const custom: TaxonomyValue[] = [
      ...taxonomy,
      { id: "topic:movilidad", dimension: "topic", slug: "movilidad", label: "Movilidad", parentId: null, description: "keywords: estiramientos, cadera", active: true },
    ];
    const tags = await c.classify({ caption: "3 estiramientos de cadera para la oficina", mediaType: "REEL" }, custom);
    expect(tags.find((t) => t.dimension === "topic")?.slug).toBe("movilidad");
  });

  it("ignores inactive values", async () => {
    const inactive = taxonomy.map((v) => (v.slug === "cardio" ? { ...v, active: false } : v));
    const tags = await c.classify({ caption: "cardio", mediaType: "REEL" }, inactive);
    expect(tags.find((t) => t.slug === "cardio")).toBeUndefined();
  });

  it("keywordsFor reads optional keywords from description", () => {
    const v = { id: "x", dimension: "topic", slug: "a-b", label: "Label", parentId: null, description: "keywords: uno, dos", active: true } as TaxonomyValue;
    expect(keywordsFor(v)).toEqual(["label", "a b", "uno", "dos"]);
  });
});

describe("mergeTags", () => {
  it("manual tags always win", () => {
    const manual = tag("topic", "fuerza");
    const merged = mergeTags([manual], [{ ...tag("topic", "cardio"), source: "claude", confidence: 0.99 }]);
    expect(merged).toEqual([manual]);
  });
  it("replaces automatic tags only with more confident ones", () => {
    const weak = { ...tag("hook", "mito"), source: "rule" as const, confidence: 0.5 };
    const strong = { ...tag("hook", "pregunta"), source: "claude" as const, confidence: 0.8 };
    expect(mergeTags([weak], [strong])[0].slug).toBe("pregunta");
    expect(mergeTags([strong], [weak])[0].slug).toBe("pregunta");
  });
  it("keeps one tag per dimension", () => {
    expect(mergeTags([tag("topic", "a")], [tag("hook", "b")])).toHaveLength(2);
  });
});
