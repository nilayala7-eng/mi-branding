/**
 * Instagram API with Instagram Login — endpoints and permissions.
 * Verified against developers.facebook.com/documentation/instagram-platform
 * on 2026-09-29 (Business Login for Instagram; IG Media/User Insights refs).
 */
export const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
export const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token"; // POST, form data
export const IG_GRAPH_HOST = "https://graph.instagram.com";
export const IG_LONG_LIVED_URL = `${IG_GRAPH_HOST}/access_token`; // GET grant_type=ig_exchange_token
export const IG_REFRESH_URL = `${IG_GRAPH_HOST}/refresh_access_token`; // GET grant_type=ig_refresh_token

/** Read-only analytics needs exactly these two. */
export const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"] as const;

/** Long-lived tokens can be refreshed once they are ≥ 24 h old; they last 60 days. */
export const TOKEN_MIN_AGE_FOR_REFRESH_MS = 24 * 3600 * 1000;
export const TOKEN_REFRESH_WHEN_EXPIRING_WITHIN_MS = 10 * 24 * 3600 * 1000;

/** Account-level insights are stored by Meta for up to 90 days. */
export const ACCOUNT_INSIGHTS_MAX_LOOKBACK_DAYS = 90;

/** httpOnly cookie binding the OAuth flow to the browser that started it. */
export const OAUTH_STATE_COOKIE = "ig_oauth_state";
