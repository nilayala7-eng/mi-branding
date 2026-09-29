/**
 * Meta / Instagram API facts and their verification status.
 *
 * Verified on 2026-09-29 against the official docs
 * (developers.facebook.com/documentation/instagram-platform: Overview,
 * Business Login for Instagram, IG Media Insights, IG Account Insights,
 * IG Media, IG User Media, Insights guide, Get Started).
 * "pending" = our interpretation, to be confirmed with the first real sync.
 */
export type VerificationLevel = "verified" | "sdk" | "search" | "pending" | "unverified";

export interface MetaFact {
  id: string;
  topic: "auth" | "permissions" | "account" | "media" | "insights" | "limits";
  claim: string;
  level: VerificationLevel;
  source: string;
}

const DOCS = "developers.facebook.com/documentation/instagram-platform";

export const META_FACTS: MetaFact[] = [
  { id: "product", topic: "auth", level: "verified", source: `${DOCS}/overview`,
    claim: "Using 'Instagram API with Instagram Login' (Business Login for Instagram). No Facebook Page required. Host graph.instagram.com. Current API version v26.0." },
  { id: "account-type", topic: "account", level: "verified", source: `${DOCS}/overview`,
    claim: "Only Instagram professional accounts (Business or Creator)." },
  { id: "access-level", topic: "permissions", level: "verified", source: `${DOCS}/instagram-api-with-instagram-login/business-login`,
    claim: "Standard Access is enough for accounts you own/manage and add to the app; Advanced Access (App Review) only for third-party accounts." },
  { id: "scopes", topic: "permissions", level: "verified", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "Scopes: instagram_business_basic + instagram_business_manage_insights." },
  { id: "oauth-endpoints", topic: "auth", level: "verified", source: `${DOCS}/instagram-api-with-instagram-login/business-login`,
    claim: "Authorize www.instagram.com/oauth/authorize → POST api.instagram.com/oauth/access_token (code valid 1 h, single use, strip '#_') → GET graph.instagram.com/access_token?grant_type=ig_exchange_token (60 days) → GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token (token ≥ 24 h old, not expired)." },
  { id: "media-fields", topic: "media", level: "verified", source: `${DOCS}/reference/instagram-media`,
    claim: "media_type is IMAGE, VIDEO or CAROUSEL_ALBUM. media_product_type, shares_count, saved_count are Facebook-Login only. thumbnail_url only on VIDEO. Duration is not exposed." },
  { id: "media-list", topic: "media", level: "verified", source: `${DOCS}/instagram-graph-api/reference/ig-user/media`,
    claim: "/media returns at most the 10K most recent media; Stories are not included (separate /stories edge)." },
  { id: "media-metrics", topic: "insights", level: "verified", source: `${DOCS}/reference/instagram-media/insights`,
    claim: "Reels: views, reach, likes, comments, saved, shares, total_interactions, ig_reels_avg_watch_time, reels_skip_rate. Feed: same (no reels_*) plus follows and profile_visits. follows/profile_visits are NOT available for Reels. Period is always lifetime." },
  { id: "media-limits", topic: "limits", level: "verified", source: `${DOCS}/reference/instagram-media/insights`,
    claim: "Media metrics kept up to 2 years; data delayed up to 48 h; no insights for album children; organic interactions only; unsupported metric fails the whole request." },
  { id: "impressions", topic: "insights", level: "verified", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "impressions deprecated (media after 2024-07-02; account level from 2025-04-21). views replaces it." },
  { id: "account-metrics", topic: "insights", level: "verified", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "Account metrics (period=day, metric_type=total_value): reach, views, likes, comments, shares, saves, total_interactions, accounts_engaged, replies, reposts, profile_links_taps, follows_and_unfollows (breakdown follow_type). No account-level profile views." },
  { id: "account-retention", topic: "limits", level: "verified", source: `${DOCS}/insights`,
    claim: "Account (user) metrics are stored for up to 90 days → Ayala OS must keep its own history from the connection date." },
  { id: "followers-history", topic: "limits", level: "verified", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "No daily follower-count history in the current metric table; followers are captured once per sync from the profile." },
  { id: "min-followers", topic: "limits", level: "verified", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "follows_and_unfollows and demographics are not returned under 100 followers; demographics show top 45 only." },
  { id: "stories", topic: "media", level: "verified", source: `${DOCS}/reference/instagram-media/insights`,
    claim: "Story metrics only for 24 h; story insights webhook is Facebook-Login only → stories are out of scope for now." },
  { id: "rate-limits", topic: "limits", level: "verified", source: `${DOCS}/overview`,
    claim: "Business Use Case rate limit: calls per 24 h = 4800 × number of impressions — ample for one daily sync." },
  { id: "follow-type-mapping", topic: "insights", level: "pending", source: `${DOCS}/api-reference/instagram-user/insights`,
    claim: "follows_and_unfollows breakdown FOLLOWER → new follows, NON_FOLLOWER → unfollows. Raw values stored in extra; compare with the Instagram app after the first sync." },
  { id: "video-is-reel", topic: "media", level: "pending", source: `${DOCS}/reference/instagram-media`,
    claim: "VIDEO media are treated as Reels (media_product_type unavailable with Instagram Login)." },
  { id: "avg-watch-time-unit", topic: "insights", level: "pending", source: `${DOCS}/reference/instagram-media/insights`,
    claim: "Unit of ig_reels_avg_watch_time is not documented; stored raw, not displayed until confirmed." },
];

/** Integration is enabled when every fact it depends on is verified; "pending" items are data-interpretation checks. */
export function metaReadyForIntegration(): boolean {
  return META_FACTS.every((f) => f.level === "verified" || f.level === "pending");
}
