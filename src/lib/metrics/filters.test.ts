import { describe, expect, it } from "vitest";
import { makePost, tag } from "@/test/fixtures";
import { filterPosts, localDate } from "./filters";

const posts = [
  makePost({ id: "a", publishedAt: "2026-01-05T10:00:00Z", caption: "Cardio en casa", mediaType: "REEL", metrics: { views: 500, reach: 1000, shares: 10 }, tags: [tag("topic", "cardio")] }),
  makePost({ id: "b", publishedAt: "2026-01-10T10:00:00Z", caption: "Fuerza básica", mediaType: "CAROUSEL", metrics: { views: 3000, reach: 2000, shares: 4 }, tags: [tag("topic", "fuerza")] }),
  makePost({ id: "c", publishedAt: "2026-01-20T10:00:00Z", caption: "CARDIO rápido", mediaType: "REEL", metrics: { views: null, reach: null, shares: null } }),
];

describe("filterPosts", () => {
  it("filters by inclusive date range", () => {
    expect(filterPosts(posts, { range: { from: "2026-01-05", to: "2026-01-10" } }, "UTC").map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
  it("filters by media type", () => {
    expect(filterPosts(posts, { mediaTypes: ["CAROUSEL"] }, "UTC").map((p) => p.id)).toEqual(["b"]);
  });
  it("searches captions case-insensitively", () => {
    expect(filterPosts(posts, { search: "cardio" }, "UTC").map((p) => p.id).sort()).toEqual(["a", "c"]);
  });
  it("filters by taxonomy tag slug", () => {
    expect(filterPosts(posts, { tag: { dimension: "topic", slug: "cardio" } }, "UTC").map((p) => p.id)).toEqual(["a"]);
  });
  it("sorts by a raw metric desc, unknown values last", () => {
    expect(filterPosts(posts, { sort: "views", order: "desc" }, "UTC").map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
  it("sorts by a derived rate (shares per 1k reach)", () => {
    // a: 10/1000 = 10/1k, b: 4/2000 = 2/1k
    expect(filterPosts(posts, { sort: "sharesPer1k", order: "desc" }, "UTC").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("unknown values stay last even ascending", () => {
    expect(filterPosts(posts, { sort: "views", order: "asc" }, "UTC").map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
  it("defaults to newest first and applies limit", () => {
    expect(filterPosts(posts, { limit: 2 }, "UTC").map((p) => p.id)).toEqual(["c", "b"]);
  });
});

describe("localDate", () => {
  it("uses the account time zone, not UTC, for the calendar day", () => {
    // 23:30 UTC on Jan 31 is already Feb 1 in Madrid (UTC+1).
    expect(localDate("2026-01-31T23:30:00Z", "Europe/Madrid")).toBe("2026-02-01");
    expect(localDate("2026-01-31T23:30:00Z", "UTC")).toBe("2026-01-31");
  });
});
