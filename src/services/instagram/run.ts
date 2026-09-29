/**
 * Orchestrates a real sync for the connected account: token refresh →
 * MetaInstagramSource → runSync → PostgresSyncStore.
 */
import { getAccessToken, getActiveAccount, setConnectionStatus, updateAccessToken, updateFollowersCount } from "@/lib/db/accounts";
import { getSql } from "@/lib/db/client";
import { serverEnv } from "@/lib/env";
import {
  ACCOUNT_INSIGHTS_MAX_LOOKBACK_DAYS,
  TOKEN_MIN_AGE_FOR_REFRESH_MS,
  TOKEN_REFRESH_WHEN_EXPIRING_WITHIN_MS,
} from "@/lib/meta/config";
import { GraphApiError, GraphClient } from "@/lib/meta/graph-client";
import { refreshLongLivedToken } from "@/lib/meta/oauth";
import { getProfile, MetaInstagramSource } from "@/lib/meta/source";
import { PostgresSyncStore } from "./postgres-store";
import { runSync, type SyncRunRecord } from "./sync";

export class SyncPreconditionError extends Error {}

/** Refresh when the token is ≥ 24 h old and expires within 10 days. */
export function shouldRefreshToken(expiresAt: Date | null, updatedAt: Date | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const oldEnough = !updatedAt || now - updatedAt.getTime() >= TOKEN_MIN_AGE_FOR_REFRESH_MS;
  return oldEnough && expiresAt.getTime() - now <= TOKEN_REFRESH_WHEN_EXPIRING_WITHIN_MS && expiresAt.getTime() > now;
}

export async function syncConnectedAccount(opts: { full?: boolean } = {}): Promise<SyncRunRecord> {
  const env = serverEnv();
  if (env.DATA_SOURCE !== "supabase") throw new SyncPreconditionError("DATA_SOURCE must be 'supabase' to sync real data.");
  if (!env.APP_ENCRYPTION_KEY) throw new SyncPreconditionError("APP_ENCRYPTION_KEY is not set.");
  const sql = getSql();
  const account = await getActiveAccount(sql);
  if (!account || account.connectionStatus === "not_connected") throw new SyncPreconditionError("No Instagram account connected.");
  let token = await getAccessToken(sql, env.APP_ENCRYPTION_KEY, account.id);
  if (!token) throw new SyncPreconditionError("No access token stored; reconnect Instagram.");

  if (shouldRefreshToken(account.tokenExpiresAt, account.tokenUpdatedAt)) {
    try {
      const fresh = await refreshLongLivedToken(token);
      await updateAccessToken(sql, env.APP_ENCRYPTION_KEY, account.id, fresh.accessToken, fresh.expiresAt);
      token = fresh.accessToken;
    } catch (e) {
      // Non-fatal: the current token is still valid for a while.
      console.error("token refresh failed", e instanceof Error ? e.message : e);
    }
  }

  const client = new GraphClient(token, env.META_GRAPH_API_VERSION);
  try {
    const profile = await getProfile(client);
    await updateFollowersCount(sql, account.id, profile.followers_count ?? null);
    const firstSync = !account.lastSyncAt;
    const source = new MetaInstagramSource(client, profile.user_id ?? profile.id, env.ACCOUNT_TIMEZONE);
    return await runSync(source, new PostgresSyncStore(sql), {
      accountId: account.id,
      now: new Date().toISOString(),
      // Meta keeps account insights ~90 days: backfill all of it once, then
      // re-read the last week (data can be delayed up to 48 h).
      accountLookbackDays: firstSync || opts.full ? ACCOUNT_INSIGHTS_MAX_LOOKBACK_DAYS : 7,
      refreshPostsNewerThanDays: 30,
      full: opts.full,
    });
  } catch (e) {
    if (e instanceof GraphApiError && e.isAuthError) {
      await setConnectionStatus(sql, account.id, "token_expired", "Instagram token invalid or expired — reconnect.");
    }
    throw e;
  }
}
