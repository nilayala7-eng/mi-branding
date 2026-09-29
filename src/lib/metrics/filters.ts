/**
 * Pure post filtering/sorting. The mock repository uses it directly; the
 * Supabase repository implements the same semantics in SQL and is tested
 * against these functions.
 */
import type { PostFilter, PostSortKey } from "@/lib/data/repository";
import { inRange } from "@/lib/domain/periods";
import type { Post } from "@/lib/domain/types";
import { postRates } from "./calculations";

/** Account-local calendar day of a UTC timestamp. */
export function localDate(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function sortValue(post: Post, key: PostSortKey): number | string | null {
  switch (key) {
    case "publishedAt":
      return post.publishedAt;
    case "engagementRate":
      return postRates(post.metrics).engagementRate;
    case "sharesPer1k":
      return postRates(post.metrics).sharesPer1k;
    case "savesPer1k":
      return postRates(post.metrics).savesPer1k;
    case "followsPer1k":
      return postRates(post.metrics).followsPer1k;
    default:
      return post.metrics[key];
  }
}

export function filterPosts(posts: Post[], filter: PostFilter = {}, timeZone = "Europe/Madrid"): Post[] {
  const search = filter.search?.trim().toLowerCase();
  let out = posts.filter((p) => {
    if (filter.range && !inRange(localDate(p.publishedAt, timeZone), filter.range)) return false;
    if (filter.mediaTypes?.length && !filter.mediaTypes.includes(p.mediaType)) return false;
    if (search && !p.caption.toLowerCase().includes(search)) return false;
    if (filter.tag) {
      const { dimension, slug } = filter.tag;
      if (!p.tags.some((t) => t.dimension === dimension && t.slug === slug)) return false;
    }
    return true;
  });

  const key = filter.sort ?? "publishedAt";
  const dir = (filter.order ?? "desc") === "desc" ? -1 : 1;
  out = [...out].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    // Unknown values always sink to the bottom regardless of direction.
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  if (filter.limit !== undefined) out = out.slice(0, Math.max(0, filter.limit));
  return out;
}
