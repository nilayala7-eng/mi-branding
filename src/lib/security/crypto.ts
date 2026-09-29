/**
 * Server-only crypto helpers:
 *  - AES-256-GCM encryption for access tokens at rest.
 *  - HMAC-signed, expiring OAuth `state` values (CSRF protection).
 * Uses node:crypto only; no custom primitives.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 32;

function key(secret: string, purpose: "enc" | "state"): Buffer {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`APP_ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters.`);
  }
  // Domain-separated keys so the same secret is never used for two purposes.
  return createHash("sha256").update(`ayala-os:${purpose}:`).update(secret).digest();
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s, "base64url");

/** Returns `v1.<iv>.<tag>.<ciphertext>` (base64url parts). */
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, "enc"), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", b64url(iv), b64url(cipher.getAuthTag()), b64url(ct)].join(".");
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised encrypted payload format.");
  const decipher = createDecipheriv("aes-256-gcm", key(secret, "enc"), fromB64url(iv));
  decipher.setAuthTag(fromB64url(tag));
  return Buffer.concat([decipher.update(fromB64url(ct)), decipher.final()]).toString("utf8");
}

export interface OAuthStatePayload {
  nonce: string;
  iat: number; // seconds
  returnTo: string;
}

export function createOAuthState(secret: string, returnTo = "/settings", now = Date.now()): string {
  const payload: OAuthStatePayload = { nonce: b64url(randomBytes(16)), iat: Math.floor(now / 1000), returnTo };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac("sha256", key(secret, "state")).update(body).digest());
  return `${body}.${sig}`;
}

export type StateVerification =
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyOAuthState(
  state: string,
  secret: string,
  { now = Date.now(), maxAgeSec = 600 }: { now?: number; maxAgeSec?: number } = {},
): StateVerification {
  const [body, sig] = state.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed" };
  const expected = createHmac("sha256", key(secret, "state")).update(body).digest();
  const given = fromB64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.iat !== "number" || Math.floor(now / 1000) - payload.iat > maxAgeSec) {
    return { ok: false, reason: "expired" };
  }
  // Only allow same-origin relative redirects.
  if (typeof payload.returnTo !== "string" || !payload.returnTo.startsWith("/") || payload.returnTo.startsWith("//")) {
    payload.returnTo = "/settings";
  }
  return { ok: true, payload };
}
