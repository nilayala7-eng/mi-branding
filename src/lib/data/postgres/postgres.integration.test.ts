/**
 * Integration tests against a real Postgres. Run with
 *   TEST_DATABASE_URL=postgres://… npm test
 * The database is WIPED (schema public is recreated from the migration).
 * Without TEST_DATABASE_URL these tests are reported as skipped.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { createSql, type Sql } from "@/lib/db/client";
import { getAccessToken, getActiveAccount, saveConnectedAccount } from "@/lib/db/accounts";
import { PostgresSyncStore } from "@/services/instagram/postgres-store";
import { runSync, type InstagramSource, type SourceMedia } from "@/services/instagram/sync";
import { comparePeriods, getContentByDimension } from "@/services/analytics";
import { PostgresRepository } from "./postgres-repository";
import { EXPECTED_TABLES } from "../../../../scripts/expected-schema";

const URL_ = process.env.TEST_DATABASE_URL;
const SECRET = "k".repeat(40);
const file = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));

const media = (id: string, type: SourceMedia["mediaType"] = "REEL", caption = `post ${id}`): SourceMedia => ({
  igMediaId: id,
  mediaType: type,
  caption,
  permalink: `https://instagram.com/p/${id}`,
  thumbnailUrl: null,
  publishedAt: "2026-09-20T10:00:00.000Z",
  durationSec: null,
});

function source(items: SourceMedia[], reach = 1000): InstagramSource {
  return {
    listMedia: async () => items,
    getMediaInsights: async (m) => ({ views: 2000, reach, likes: 40, comments: 4, shares: 8, saves: 6, follows: m.mediaType === "REEL" ? null : 3, extra: { total_interactions: 58 } }),
    getAccountDays: async ({ to }) => [
      { date: "2026-09-27", followers: null, followsGained: 5, unfollows: 1, reach: 800, views: 1500, likes: 30, comments: 3, shares: 4, saves: 5, profileVisits: null },
      { date: to, followers: 5000, followsGained: 7, unfollows: 2, reach: 900, views: 1600, likes: 32, comments: 2, shares: 6, saves: 4, profileVisits: null },
    ],
  };
}

describe.skipIf(!URL_)("Postgres (integration)", () => {
  let sql: Sql;
  let accountId: string;
  const opts = () => ({ accountId, now: "2026-09-28T06:00:00.000Z", accountLookbackDays: 2, refreshPostsNewerThanDays: 30 });

  beforeAll(async () => {
    sql = createSql(URL_!, { max: 2 });
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;
    await sql.file(file("supabase/migrations/20260929000001_initial_schema.sql"));
    await sql.file(file("supabase/seed.sql"));
    accountId = await saveConnectedAccount(sql, SECRET, {
      igUserId: "17841", username: "ayala.fit_", displayName: "Ayala", accountType: "BUSINESS", profilePictureUrl: null,
      followersCount: 5000, mediaCount: 3, accessToken: "IGAA-secret-token", tokenExpiresAt: new Date("2026-11-27"), scopes: ["instagram_business_basic"],
    });
  });
  afterAll(async () => sql?.end());

  it("stores the token encrypted and reads it back", async () => {
    const [row] = await sql`select access_token_encrypted from instagram_accounts where id = ${accountId}`;
    expect(row.access_token_encrypted).not.toContain("IGAA");
    expect(await getAccessToken(sql, SECRET, accountId)).toBe("IGAA-secret-token");
  });

  it("reconnecting the same Instagram user updates, not duplicates", async () => {
    const again = await saveConnectedAccount(sql, SECRET, {
      igUserId: "17841", username: "ayala.fit_", displayName: "Ayala", accountType: "BUSINESS", profilePictureUrl: null,
      followersCount: 5001, mediaCount: 3, accessToken: "IGAA-new", tokenExpiresAt: new Date("2026-12-01"), scopes: [],
    });
    expect(again).toBe(accountId);
    expect((await sql`select count(*)::int as n from instagram_accounts`)[0].n).toBe(1);
    expect((await sql`select count(*)::int as n from users`)[0].n).toBe(1);
  });

  it("sync is idempotent in Postgres (unique keys + upserts)", async () => {
    const store = new PostgresSyncStore(sql);
    const src = source([media("a"), media("b", "IMAGE"), media("a")]);
    const first = await runSync(src, store, opts());
    const second = await runSync(src, store, opts());
    expect(first.status).toBe("success");
    expect(first.postsCreated).toBe(2);
    expect(second.postsCreated).toBe(0);
    const counts = await sql`select (select count(*)::int from posts) as posts, (select count(*)::int from post_insights) as snaps,
      (select count(*)::int from account_insights) as days, (select count(*)::int from sync_runs where status = 'success') as runs`;
    expect(counts[0]).toEqual({ posts: 2, snaps: 2, days: 2, runs: 2 });
    const acc = await getActiveAccount(sql);
    expect(acc?.lastSyncStatus).toBe("success");
  });

  it("the sync lock prevents concurrent runs and is released afterwards", async () => {
    const store = new PostgresSyncStore(sql);
    expect(await store.acquireLock(accountId)).toBe(true);
    expect((await runSync(source([]), store, opts())).status).toBe("skipped");
    await store.releaseLock(accountId);
    expect(await store.acquireLock(accountId)).toBe(true);
    await store.releaseLock(accountId);
  });

  it("a later sync without followers keeps the stored follower count", async () => {
    const store = new PostgresSyncStore(sql);
    await store.upsertAccountDays(accountId, [{ date: "2026-09-28", followers: null, followsGained: 9, unfollows: null, reach: null, views: null, likes: null, comments: null, shares: null, saves: null, profileVisits: null }]);
    const [d] = await sql`select followers, follows_gained, reach from account_insights where date = '2026-09-28'`;
    expect(d).toEqual({ followers: 5000, follows_gained: 9, reach: "900" });
  });

  it("the repository returns posts with latest metrics, nulls preserved", async () => {
    const repo = new PostgresRepository(sql, "Europe/Madrid");
    const posts = await repo.getPosts({ sort: "views" });
    expect(posts).toHaveLength(2);
    const reel = posts.find((p) => p.mediaType === "REEL")!;
    expect(reel.metrics).toMatchObject({ views: 2000, reach: 1000, follows: null });
    expect(await repo.getPost("not-a-uuid")).toBeNull();
  });

  it("manual tags feed the analytics services", async () => {
    const repo = new PostgresRepository(sql, "Europe/Madrid");
    const [v] = await sql`select id from taxonomy_values where dimension = 'topic' and slug = 'cardio'`;
    const posts = await repo.getPosts();
    for (const p of posts) await repo.setManualTag(p.id, v.id);
    const b = await getContentByDimension(repo, "topic", { from: "2026-09-01", to: "2026-09-30" });
    expect(b.groups).toEqual([expect.objectContaining({ slug: "cardio", n: 2, confidence: "insufficient" })]);
    await repo.removeTag(posts[0].id, "topic");
    expect((await repo.getPost(posts[0].id))!.tags).toHaveLength(0);
  });

  it("account days and period comparison work on stored data", async () => {
    const repo = new PostgresRepository(sql, "Europe/Madrid");
    const c = await comparePeriods(repo, { from: "2026-09-28", to: "2026-09-28" });
    expect(c.current.totals.reach).toBe(900);
    expect(c.previous.totals.reach).toBe(800);
  });

  it("experiments round-trip", async () => {
    const repo = new PostgresRepository(sql, "Europe/Madrid");
    const e = await repo.createExperiment({ name: "Hooks", hypothesis: "Hooks de tiempo → más shares", metric: "shares_per_1k_reach", baseline: 4.5, baselineDescription: "90d", test: "6 reels", startDate: "2026-10-01", endDate: "2026-10-21" });
    const u = await repo.updateExperiment(e.id, { status: "running" });
    expect(u).toMatchObject({ status: "running", baseline: 4.5, startDate: "2026-10-01" });
    expect(await repo.listExperiments()).toHaveLength(1);
  });

  // Keep last: these run setup.sql over the populated database.
  const check = async () =>
    (await sql.file(file("supabase/check.sql"))) as unknown as { tabla: string; estado: string; filas: string | null }[];
  // setup.sql has its own begin/commit → needs a dedicated connection.
  const runSetup = async () => {
    const conn = await sql.reserve();
    try {
      await conn.file(file("supabase/setup.sql"));
    } finally {
      await conn`rollback`.catch(() => {}); // clears an aborted transaction; no-op after commit
      conn.release();
    }
  };

  it("check.sql matches the migration and flags foreign tables", async () => {
    await sql`create table public.other_app (id int)`;
    const rows = await check();
    expect(rows.filter((r) => r.estado !== "OK").map((r) => [r.tabla, r.estado])).toEqual([["other_app", "AJENA"]]);
    expect(rows).toHaveLength(Object.keys(EXPECTED_TABLES).length + 2); // + view + other_app
  });

  it("setup.sql re-runs over existing tables without touching data", async () => {
    const before = await check();
    const token = await getAccessToken(sql, SECRET, accountId);
    await runSetup();
    await runSetup();
    expect(await check()).toEqual(before);
    expect(await getAccessToken(sql, SECRET, accountId)).toBe(token);
  });

  it("setup.sql stops without changes when a same-named table is not ours", async () => {
    await sql`alter table public.users rename column timezone to tz`;
    await sql`drop table public.experiment_results`;
    await expect(runSetup()).rejects.toThrow(/public\.users: faltan columnas timezone/);
    const rows = await check();
    expect(rows.find((r) => r.tabla === "experiment_results")?.estado).toBe("FALTA");
  });
});
