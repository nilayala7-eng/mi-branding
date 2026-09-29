import { describe, expect, it } from "vitest";
import { shouldRefreshToken } from "@/services/instagram/run";
import { GraphApiError, GraphClient, parseGraphResponse, type FetchLike } from "./graph-client";
import {
  mapMedia,
  mapMediaType,
  mediaMetricsFor,
  readFollowBreakdown,
  readInsightValues,
  toPostMetrics,
  zonedMidnightUtc,
} from "./mapping";
import { buildAuthorizeUrl, cleanAuthCode, exchangeCodeForToken, exchangeForLongLivedToken, refreshLongLivedToken } from "./oauth";
import { MetaInstagramSource } from "./source";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Routes fake responses by URL substring; records every call. */
function fakeFetch(routes: [RegExp, (url: string, init?: RequestInit) => Response][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = routes.find(([re]) => re.test(url));
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return r[1](url, init);
  };
  return { fn, calls };
}

describe("OAuth (Business Login for Instagram)", () => {
  it("builds the authorize URL with the documented params and minimal scopes", () => {
    const u = new URL(buildAuthorizeUrl({ appId: "123", redirectUri: "https://x.app/api/instagram/callback", state: "s.t" }));
    expect(u.origin + u.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: "123",
      redirect_uri: "https://x.app/api/instagram/callback",
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_manage_insights",
      state: "s.t",
    });
  });

  it("strips the #_ suffix from the code", () => {
    expect(cleanAuthCode("AQBx#_")).toBe("AQBx");
  });

  it("exchanges the code (documented data[] shape) via POST form", async () => {
    const f = fakeFetch([[/api\.instagram\.com\/oauth\/access_token/, () => json({ data: [{ access_token: "SHORT", user_id: "17", permissions: "instagram_business_basic,instagram_business_manage_insights" }] })]]);
    const t = await exchangeCodeForToken({ appId: "1", appSecret: "sec", redirectUri: "https://r", code: "C#_" }, f.fn);
    expect(t).toEqual({ accessToken: "SHORT", userId: "17", permissions: ["instagram_business_basic", "instagram_business_manage_insights"] });
    const body = f.calls[0].init!.body as FormData;
    expect(f.calls[0].init!.method).toBe("POST");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("C");
  });

  it("also accepts the flat response shape", async () => {
    const f = fakeFetch([[/oauth\/access_token/, () => json({ access_token: "S", user_id: 17, permissions: ["instagram_business_basic"] })]]);
    expect((await exchangeCodeForToken({ appId: "1", appSecret: "s", redirectUri: "r", code: "c" }, f.fn)).userId).toBe("17");
  });

  it("gets and refreshes long-lived tokens with the documented grant types", async () => {
    const f = fakeFetch([[/graph\.instagram\.com\/(access_token|refresh_access_token)/, () => json({ access_token: "LONG", token_type: "bearer", expires_in: 5184000 })]]);
    const long = await exchangeForLongLivedToken({ appSecret: "sec", shortLivedToken: "SHORT" }, f.fn, 0);
    expect(long.expiresAt.getTime()).toBe(5184000 * 1000);
    expect(new URL(f.calls[0].url).searchParams.get("grant_type")).toBe("ig_exchange_token");
    await refreshLongLivedToken("LONG", f.fn, 0);
    expect(new URL(f.calls[1].url).searchParams.get("grant_type")).toBe("ig_refresh_token");
  });

  it("surfaces Graph errors as GraphApiError without leaking tokens", async () => {
    const res = json({ error: { message: "Invalid token access_token=IGsecret123", type: "OAuthException", code: 190 } }, 400);
    const err = (await parseGraphResponse(res).catch((e: unknown) => e)) as GraphApiError;
    expect(err).toBeInstanceOf(GraphApiError);
    expect(err.isAuthError).toBe(true);
    expect(err.message).not.toContain("IGsecret123");
  });
});

describe("token refresh policy", () => {
  const day = 86_400_000;
  it("refreshes only tokens ≥ 24 h old that expire within 10 days", () => {
    const now = 100 * day;
    expect(shouldRefreshToken(new Date(now + 5 * day), new Date(now - 2 * day), now)).toBe(true);
    expect(shouldRefreshToken(new Date(now + 5 * day), new Date(now - 3600_000), now)).toBe(false); // too young
    expect(shouldRefreshToken(new Date(now + 40 * day), new Date(now - 2 * day), now)).toBe(false); // not expiring
    expect(shouldRefreshToken(new Date(now - day), new Date(now - 70 * day), now)).toBe(false); // already expired
  });
});

describe("mapping", () => {
  it("maps media types (VIDEO → REEL)", () => {
    expect(mapMediaType("VIDEO")).toBe("REEL");
    expect(mapMediaType("CAROUSEL_ALBUM")).toBe("CAROUSEL");
    expect(mapMediaType("IMAGE")).toBe("IMAGE");
  });

  it("never requests follows/profile_visits for Reels (not supported by the API)", () => {
    expect(mediaMetricsFor("REEL")).not.toContain("follows");
    expect(mediaMetricsFor("REEL")).not.toContain("profile_visits");
    expect(mediaMetricsFor("IMAGE")).toEqual(expect.arrayContaining(["follows", "profile_visits", "views", "saved"]));
    expect(mediaMetricsFor("CAROUSEL")).not.toContain("impressions");
  });

  it("maps a media object; thumbnail from media_url only for images", () => {
    const img = mapMedia({ id: "1", media_type: "IMAGE", media_url: "https://cdn/i.jpg", timestamp: "2026-09-01T10:00:00+0000", like_count: 5 });
    expect(img).toMatchObject({ igMediaId: "1", mediaType: "IMAGE", thumbnailUrl: "https://cdn/i.jpg", caption: "", durationSec: null, likeCount: 5 });
    expect(img.publishedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(mapMedia({ id: "2", media_type: "VIDEO", media_url: "https://cdn/v.mp4", timestamp: "2026-09-01T10:00:00+0000" }).thumbnailUrl).toBeNull();
  });

  it("reads lifetime and total_value insight shapes; missing stays null", () => {
    const v = readInsightValues({ data: [{ name: "reach", values: [{ value: 120 }] }, { name: "views", total_value: { value: 300 } }, { name: "saved", values: [] }] });
    expect(v).toEqual({ reach: 120, views: 300, saved: null });
    const m = toPostMetrics({ ...v, ig_reels_avg_watch_time: 4200 }, { likeCount: 9, commentsCount: null });
    expect(m).toMatchObject({ reach: 120, views: 300, saves: null, likes: 9, follows: null, avgWatchTimeSec: null });
    expect(m.extra).toEqual({ ig_reels_avg_watch_time: 4200 });
  });

  it("reads the follow_type breakdown and keeps raw values", () => {
    const f = readFollowBreakdown({
      data: [{ name: "follows_and_unfollows", total_value: { breakdowns: [{ dimension_keys: ["follow_type"], results: [{ dimension_values: ["FOLLOWER"], value: 12 }, { dimension_values: ["NON_FOLLOWER"], value: 3 }] }] } }],
    });
    expect(f).toEqual({ follows: 12, unfollows: 3, raw: { FOLLOWER: 12, NON_FOLLOWER: 3 } });
    expect(readFollowBreakdown({})).toEqual({ follows: null, unfollows: null, raw: {} });
  });

  it("computes local midnight in Madrid across DST", () => {
    expect(zonedMidnightUtc("2026-01-15", "Europe/Madrid").toISOString()).toBe("2026-01-14T23:00:00.000Z"); // CET
    expect(zonedMidnightUtc("2026-07-15", "Europe/Madrid").toISOString()).toBe("2026-07-14T22:00:00.000Z"); // CEST
  });
});

describe("MetaInstagramSource", () => {
  it("paginates media and sends the token in a header, not the URL", async () => {
    const f = fakeFetch([
      [/\/media\?.*after=/, () => json({ data: [{ id: "2", media_type: "IMAGE", timestamp: "2026-09-02T00:00:00+0000" }] })],
      [/\/99\/media/, () => json({ data: [{ id: "1", media_type: "VIDEO", timestamp: "2026-09-01T00:00:00+0000" }], paging: { next: "https://graph.instagram.com/v26.0/99/media?after=X" } })],
    ]);
    const src = new MetaInstagramSource(new GraphClient("TOKEN", "v26.0", f.fn), "99", "Europe/Madrid");
    expect((await src.listMedia()).map((m) => m.igMediaId)).toEqual(["1", "2"]);
    expect(f.calls.every((c) => !c.url.includes("TOKEN"))).toBe(true);
    expect((f.calls[0].init!.headers as Record<string, string>).Authorization).toBe("Bearer TOKEN");
  });

  it("does not follow paging links to other hosts", async () => {
    const f = fakeFetch([[/\/99\/media/, () => json({ data: [], paging: { next: "https://evil.example/steal" } })]]);
    const src = new MetaInstagramSource(new GraphClient("T", "v26.0", f.fn), "99", "UTC");
    await src.listMedia();
    expect(f.calls).toHaveLength(1);
  });

  it("falls back to minimal metrics when the full set is rejected", async () => {
    let first = true;
    const f = fakeFetch([
      [/\/insights/, () => {
        if (first) {
          first = false;
          return json({ error: { message: "(#100) metric not supported", code: 100 } }, 400);
        }
        return json({ data: [{ name: "reach", values: [{ value: 50 }] }] });
      }],
    ]);
    const src = new MetaInstagramSource(new GraphClient("T", "v26.0", f.fn), "99", "UTC");
    const m = await src.getMediaInsights({ igMediaId: "5", mediaType: "IMAGE", caption: "", permalink: null, thumbnailUrl: null, publishedAt: "", durationSec: null });
    expect(m.reach).toBe(50);
    expect(new URL(f.calls[1].url).searchParams.get("metric")).toBe("reach,likes,comments,saved,shares");
  });

  it("does not retry on auth errors", async () => {
    const f = fakeFetch([[/\/insights/, () => json({ error: { message: "expired", code: 190, type: "OAuthException" } }, 400)]]);
    const src = new MetaInstagramSource(new GraphClient("T", "v26.0", f.fn), "99", "UTC");
    await expect(src.getMediaInsights({ igMediaId: "5", mediaType: "REEL", caption: "", permalink: null, thumbnailUrl: null, publishedAt: "", durationSec: null })).rejects.toThrow(GraphApiError);
    expect(f.calls).toHaveLength(1);
  });

  it("builds account days with local-day since/until; followers only for the last day", async () => {
    const f = fakeFetch([
      [/\/me\?/, () => json({ id: "99", username: "ayala.fit_", followers_count: 5000 })],
      [/follows_and_unfollows/, () => json({ error: { message: "not enough followers", code: 100 } }, 400)],
      [/\/insights/, () => json({ data: [{ name: "reach", total_value: { value: 700 } }, { name: "views", total_value: { value: 1500 } }] })],
    ]);
    const src = new MetaInstagramSource(new GraphClient("T", "v26.0", f.fn), "99", "Europe/Madrid");
    const days = await src.getAccountDays({ from: "2026-09-27", to: "2026-09-28" });
    expect(days.map((d) => [d.date, d.reach, d.views, d.followers, d.followsGained])).toEqual([
      ["2026-09-27", 700, 1500, null, null],
      ["2026-09-28", 700, 1500, 5000, null],
    ]);
    const call = new URL(f.calls.find((c) => c.url.includes("metric=reach"))!.url);
    expect(call.searchParams.get("metric_type")).toBe("total_value");
    expect(call.searchParams.get("since")).toBe(String(Date.parse("2026-09-26T22:00:00Z") / 1000));
  });
});
