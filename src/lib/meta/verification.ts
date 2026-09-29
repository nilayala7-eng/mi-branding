/**
 * Meta / Instagram API facts and their verification status.
 *
 * Phase 0 could NOT read developers.facebook.com (blocked by the cloud
 * environment's network policy). Facts are therefore graded:
 *  - "sdk":        confirmed in Meta's official `facebook-nodejs-business-sdk`
 *                  v24.0.1 (npm, Nov 2025) — names exist, semantics unverified.
 *  - "search":     seen in official-docs search snippets only.
 *  - "unverified": from prior knowledge; MUST be checked before coding against it.
 *
 * No code path calls Meta until every fact it depends on is "verified".
 * Update this file (and META_SETUP.md) after reading the live docs.
 */
export type VerificationLevel = "verified" | "sdk" | "search" | "unverified";

export interface MetaFact {
  id: string;
  topic: "auth" | "permissions" | "account" | "media" | "insights" | "limits";
  claim: string;
  level: VerificationLevel;
  source: string;
}

export const META_FACTS: MetaFact[] = [
  {
    id: "product",
    topic: "auth",
    claim:
      'Two configurations exist: "Instagram API with Instagram Login" (no Facebook Page needed) and "Instagram API with Facebook Login" (requires a linked Page).',
    level: "search",
    source: "developers.facebook.com/docs/instagram-platform (search snippet)",
  },
  {
    id: "account-type",
    topic: "account",
    claim: "Only Instagram professional accounts (Business or Creator) are supported; personal accounts are not.",
    level: "search",
    source: "IG Media Insights reference (search snippet)",
  },
  {
    id: "scopes",
    topic: "permissions",
    claim:
      "Instagram Login scopes use the instagram_business_* names (instagram_business_basic, instagram_business_manage_insights, …); old business_* scope values were deprecated on 2025-01-27.",
    level: "search",
    source: "Business Login for Instagram (search snippet)",
  },
  {
    id: "insights-with-ig-login",
    topic: "permissions",
    claim: "Media and user Insights APIs are available to apps using Instagram API with Instagram Login.",
    level: "search",
    source: "Meta dev blog 2025-12-03 'Instagram API Updates…' (search snippet)",
  },
  {
    id: "token-lifetime",
    topic: "auth",
    claim: "Short-lived user token → exchangeable for a long-lived token valid 60 days (refreshable).",
    level: "search",
    source: "Business Login for Instagram (search snippet)",
  },
  {
    id: "ig-only-token-objects",
    topic: "auth",
    claim: "Access-token exchange and refresh objects exist for the Instagram-only API.",
    level: "sdk",
    source: "SDK objects IGAccessTokenForIGOnlyAPI, IGRefreshAccessTokenForIGOnlyAPI",
  },
  {
    id: "graph-version",
    topic: "limits",
    claim: "Graph API v24.0 existed in Nov 2025. The current version in Sep 2026 is unknown — configurable via META_GRAPH_API_VERSION.",
    level: "sdk",
    source: "facebook-nodejs-business-sdk 24.0.1 src/api.js",
  },
  {
    id: "media-fields",
    topic: "media",
    claim:
      "IG media fields include id, caption, media_type, media_product_type, media_url, permalink, thumbnail_url, timestamp, like_count, comments_count, shortcode.",
    level: "sdk",
    source: "SDK IGMediaForIGOnlyAPI.Fields",
  },
  {
    id: "user-fields",
    topic: "account",
    claim: "IG user fields include user_id, username, name, account_type, followers_count, follows_count, media_count, profile_picture_url.",
    level: "sdk",
    source: "SDK IGUserForIGOnlyAPI.Fields",
  },
  {
    id: "insight-metric-names",
    topic: "insights",
    claim:
      "Insight metric names include views, reach, likes, comments, shares, saved, follows, total_interactions, profile_visits, profile_activity, navigation, replies, ig_reels_avg_watch_time, ig_reels_video_view_total_time. Which metric applies to which media type / account level is NOT confirmed.",
    level: "sdk",
    source: "SDK InstagramInsightsResult.Metric",
  },
  {
    id: "insight-params",
    topic: "insights",
    claim:
      "Insights accept period (day, week, days_28, lifetime, total_over_range), metric_type (time_series, total_value), breakdown (follow_type, media_product_type…?), timeframe (last_14/30/90_days, this_week, this_month, prev_month).",
    level: "sdk",
    source: "SDK InstagramInsightsResult.Period/MetricType/Breakdown/Timeframe",
  },
  {
    id: "impressions-deprecated",
    topic: "insights",
    claim: "impressions is deprecated for media created after 2024-07-02 (errors from 2025-04-21); views replaces it.",
    level: "search",
    source: "IG User Insights / v22.0 changelog (search snippet)",
  },
  {
    id: "retention-90d",
    topic: "limits",
    claim: "User (account-level) insights are only available for roughly the last 90 days → history must be stored by us going forward.",
    level: "search",
    source: "IG User Insights (search snippet)",
  },
  {
    id: "min-followers",
    topic: "limits",
    claim: "Some metrics are unavailable for accounts with fewer than 100 followers.",
    level: "search",
    source: "IG Insights reference (search snippet)",
  },
  {
    id: "follower-demographics",
    topic: "insights",
    claim: "Follower demographics / online_followers availability and thresholds.",
    level: "unverified",
    source: "—",
  },
  {
    id: "rate-limits",
    topic: "limits",
    claim: "Rate limit formula and headers for the Instagram Platform (BUC).",
    level: "unverified",
    source: "—",
  },
  {
    id: "oauth-endpoints",
    topic: "auth",
    claim: "Exact authorize / token / long-lived exchange / refresh URLs for Instagram Login.",
    level: "unverified",
    source: "—",
  },
  {
    id: "stories",
    topic: "media",
    claim: "Story insights are only retrievable while the story is live (~24h) → needs a frequent job or webhook.",
    level: "unverified",
    source: "—",
  },
];

export function metaReadyForIntegration(): boolean {
  return META_FACTS.every((f) => f.level === "verified");
}
