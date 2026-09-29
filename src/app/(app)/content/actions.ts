"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { TAXONOMY_DIMENSIONS } from "@/lib/data/taxonomy-seed";

/**
 * Saves manual tags for one post. Only dimensions whose selection changed are
 * written, so untouched automatic tags keep their provenance.
 */
export async function saveTagsAction(form: FormData): Promise<void> {
  const repo = getRepository();
  const postId = String(form.get("postId") ?? "");
  const post = await repo.getPost(postId);
  if (!post) return;
  const taxonomy = await repo.getTaxonomy();
  for (const { key } of TAXONOMY_DIMENSIONS) {
    const selected = String(form.get(`dim:${key}`) ?? "");
    const current = post.tags.find((t) => t.dimension === key);
    if (selected === (current?.valueId ?? "")) continue;
    if (!selected) await repo.removeTag(postId, key);
    else if (taxonomy.some((v) => v.id === selected && v.dimension === key && v.active)) await repo.setManualTag(postId, selected);
  }
  revalidatePath("/content");
}
