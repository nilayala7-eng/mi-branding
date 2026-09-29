/** Instagram account + token persistence. Tokens are encrypted before storage. */
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import type { ConnectionStatus } from "@/lib/data/repository";
import type { Sql } from "./client";

export interface StoredAccount {
  id: string;
  igUserId: string;
  username: string;
  displayName: string | null;
  connectionStatus: ConnectionStatus;
  tokenExpiresAt: Date | null;
  tokenUpdatedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  followersCount: number | null;
}

type Row = {
  id: string;
  ig_user_id: string;
  username: string;
  display_name: string | null;
  connection_status: ConnectionStatus;
  token_expires_at: Date | null;
  updated_at: Date | null;
  last_sync_at: Date | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  followers_count: number | null;
};

const map = (r: Row): StoredAccount => ({
  id: r.id,
  igUserId: r.ig_user_id,
  username: r.username,
  displayName: r.display_name,
  connectionStatus: r.connection_status,
  tokenExpiresAt: r.token_expires_at,
  tokenUpdatedAt: r.updated_at,
  lastSyncAt: r.last_sync_at,
  lastSyncStatus: r.last_sync_status,
  lastSyncError: r.last_sync_error,
  followersCount: r.followers_count,
});

/** The single active account (most recently connected). */
export async function getActiveAccount(sql: Sql): Promise<StoredAccount | null> {
  const rows = await sql<Row[]>`
    select id, ig_user_id, username, display_name, connection_status, token_expires_at, updated_at,
           last_sync_at, last_sync_status, last_sync_error, followers_count
    from instagram_accounts order by (connection_status = 'connected') desc, updated_at desc limit 1`;
  return rows[0] ? map(rows[0]) : null;
}

export async function saveConnectedAccount(
  sql: Sql,
  secret: string,
  a: {
    igUserId: string;
    username: string;
    displayName: string | null;
    accountType: string | null;
    profilePictureUrl: string | null;
    followersCount: number | null;
    mediaCount: number | null;
    accessToken: string;
    tokenExpiresAt: Date;
    scopes: string[];
  },
): Promise<string> {
  const enc = encryptSecret(a.accessToken, secret);
  // Single-user app: reuse the one user row, create it on first connection.
  const existing = await sql<{ id: string }[]>`select id from users order by created_at limit 1`;
  const userId = existing[0]?.id ?? (await sql<{ id: string }[]>`insert into users default values returning id`)[0].id;
  const [row] = await sql<{ id: string }[]>`
    insert into instagram_accounts (user_id, ig_user_id, username, display_name, account_type, profile_picture_url,
      followers_count, media_count, access_token_encrypted, token_expires_at, granted_scopes, connection_status, last_sync_error)
    values (${userId}, ${a.igUserId}, ${a.username}, ${a.displayName}, ${a.accountType}, ${a.profilePictureUrl},
      ${a.followersCount}, ${a.mediaCount}, ${enc}, ${a.tokenExpiresAt}, ${a.scopes}, 'connected', null)
    on conflict (ig_user_id) do update set
      username = excluded.username, display_name = excluded.display_name, account_type = excluded.account_type,
      profile_picture_url = excluded.profile_picture_url, followers_count = excluded.followers_count,
      media_count = excluded.media_count, access_token_encrypted = excluded.access_token_encrypted,
      token_expires_at = excluded.token_expires_at, granted_scopes = excluded.granted_scopes,
      connection_status = 'connected', last_sync_error = null
    returning id`;
  return row.id;
}

export async function getAccessToken(sql: Sql, secret: string, accountId: string): Promise<string | null> {
  const [r] = await sql<{ access_token_encrypted: string | null }[]>`
    select access_token_encrypted from instagram_accounts where id = ${accountId}`;
  return r?.access_token_encrypted ? decryptSecret(r.access_token_encrypted, secret) : null;
}

export async function updateAccessToken(sql: Sql, secret: string, accountId: string, token: string, expiresAt: Date) {
  await sql`update instagram_accounts set access_token_encrypted = ${encryptSecret(token, secret)},
    token_expires_at = ${expiresAt}, connection_status = 'connected' where id = ${accountId}`;
}

export async function setConnectionStatus(sql: Sql, accountId: string, status: ConnectionStatus, error: string | null = null) {
  await sql`update instagram_accounts set connection_status = ${status}, last_sync_error = ${error} where id = ${accountId}`;
}

export async function disconnectAccount(sql: Sql, accountId: string) {
  await sql`update instagram_accounts set access_token_encrypted = null, token_expires_at = null,
    connection_status = 'not_connected' where id = ${accountId}`;
}

export async function updateFollowersCount(sql: Sql, accountId: string, followers: number | null) {
  if (followers === null) return;
  await sql`update instagram_accounts set followers_count = ${followers} where id = ${accountId}`;
}
