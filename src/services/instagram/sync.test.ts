import { describe, expect, it } from "vitest";
import { makeDay } from "@/test/fixtures";
import { InMemorySyncStore } from "./memory-store";
import { redact, runSync, type InstagramSource, type SourceMedia } from "./sync";

const NOW = "2026-09-29T06:00:00.000Z";
const OPTS = { accountId: "acc", now: NOW, accountLookbackDays: 3, refreshPostsNewerThanDays: 30 };

const media = (id: string, publishedAt = "2026-09-20T10:00:00.000Z"): SourceMedia => ({
  igMediaId: id,
  mediaType: "REEL",
  caption: `caption ${id}`,
  permalink: null,
  thumbnailUrl: null,
  publishedAt,
  durationSec: null,
});

function fakeSource(items: SourceMedia[], overrides: Partial<InstagramSource> = {}): InstagramSource & { insightCalls: string[] } {
  const insightCalls: string[] = [];
  return {
    insightCalls,
    async listMedia() {
      return items;
    },
    async getMediaInsights(m) {
      insightCalls.push(m.igMediaId);
      return { views: 100, reach: 80 };
    },
    async getAccountDays({ from, to }) {
      return [makeDay(from), makeDay(to)];
    },
    ...overrides,
  };
}

describe("runSync — idempotency", () => {
  it("first run creates posts, snapshots and account days", async () => {
    const store = new InMemorySyncStore();
    const r = await runSync(fakeSource([media("1"), media("2")]), store, OPTS);
    expect(r.status).toBe("success");
    expect(r.postsCreated).toBe(2);
    expect(store.posts.size).toBe(2);
    expect(store.snapshots.size).toBe(2);
    expect(store.accountDays.size).toBe(2);
  });

  it("re-running the same sync never duplicates posts, snapshots or days", async () => {
    const store = new InMemorySyncStore();
    const src = fakeSource([media("1"), media("2")]);
    await runSync(src, store, OPTS);
    const second = await runSync(src, store, OPTS);
    expect(second.postsCreated).toBe(0);
    expect(second.postsUpdated).toBe(2);
    expect(store.posts.size).toBe(2);
    expect(store.snapshots.size).toBe(2); // same (post, day) key → updated in place
    expect(store.accountDays.size).toBe(2);
  });

  it("a sync on a later day adds a new snapshot (history), not a duplicate post", async () => {
    const store = new InMemorySyncStore();
    const src = fakeSource([media("1")]);
    await runSync(src, store, OPTS);
    await runSync(src, store, { ...OPTS, now: "2026-09-30T06:00:00.000Z" });
    expect(store.posts.size).toBe(1);
    expect(store.snapshots.size).toBe(2);
  });

  it("de-duplicates media repeated by the source (pagination overlap)", async () => {
    const store = new InMemorySyncStore();
    const r = await runSync(fakeSource([media("1"), media("1"), media("2")]), store, OPTS);
    expect(r.postsCreated).toBe(2);
    expect(store.posts.size).toBe(2);
  });

  it("updates edited captions on re-sync", async () => {
    const store = new InMemorySyncStore();
    await runSync(fakeSource([media("1")]), store, OPTS);
    await runSync(fakeSource([{ ...media("1"), caption: "edited" }]), store, OPTS);
    expect([...store.posts.values()][0].media.caption).toBe("edited");
  });
});

describe("runSync — refresh policy", () => {
  it("does not re-fetch insights for old known posts unless full sync", async () => {
    const store = new InMemorySyncStore();
    const old = media("old", "2025-01-01T10:00:00.000Z");
    await runSync(fakeSource([old]), store, OPTS); // first time: backfilled
    const src = fakeSource([old]);
    await runSync(src, store, { ...OPTS, now: "2026-09-30T06:00:00.000Z" });
    expect(src.insightCalls).toEqual([]);
    const full = fakeSource([old]);
    await runSync(full, store, { ...OPTS, now: "2026-10-01T06:00:00.000Z", full: true });
    expect(full.insightCalls).toEqual(["old"]);
  });
});

describe("runSync — errors & locking", () => {
  it("per-post insight errors produce a partial run and are recorded", async () => {
    const store = new InMemorySyncStore();
    const src = fakeSource([media("1"), media("2")], {
      async getMediaInsights(m) {
        if (m.igMediaId === "2") throw new Error("metric not supported");
        return { views: 1 };
      },
    });
    const r = await runSync(src, store, OPTS);
    expect(r.status).toBe("partial");
    expect(r.errors).toEqual([{ scope: "media_insights", ref: "2", message: "metric not supported" }]);
    expect(store.posts.size).toBe(2);
    expect(store.runs.get(r.id)?.status).toBe("partial");
  });

  it("a failed media listing marks the run failed and still releases the lock", async () => {
    const store = new InMemorySyncStore();
    const r = await runSync(fakeSource([], { listMedia: async () => { throw new Error("token expired"); } }), store, OPTS);
    expect(r.status).toBe("failed");
    const again = await runSync(fakeSource([media("1")]), store, OPTS);
    expect(again.status).toBe("success");
  });

  it("skips when another sync holds the lock", async () => {
    const store = new InMemorySyncStore();
    await store.acquireLock("acc");
    const r = await runSync(fakeSource([media("1")]), store, OPTS);
    expect(r.status).toBe("skipped");
    expect(store.posts.size).toBe(0);
  });

  it("never stores access tokens in error messages", async () => {
    const store = new InMemorySyncStore();
    const r = await runSync(
      fakeSource([], { listMedia: async () => { throw new Error("GET https://x/me?access_token=IGQVJabcdefghijklmnopqrstuvwxyz0123456789 failed"); } }),
      store,
      OPTS,
    );
    expect(r.errors[0].message).not.toMatch(/IGQVJ/);
    expect(r.errors[0].message).toContain("[REDACTED]");
  });
});

describe("redact", () => {
  it("masks token query params and bare tokens", () => {
    expect(redact("access_token=abc123&x=1")).toBe("access_token=[REDACTED]&x=1");
    expect(redact("token EAAB1234567890abcdefghijklmnopqrstuv")).toBe("token [REDACTED_TOKEN]");
  });
});
