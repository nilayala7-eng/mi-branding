/**
 * Minimal Instagram Graph API client. Tokens are passed per call and never
 * logged; errors are normalised and redacted.
 */
import { redact } from "@/services/instagram/sync";
import { IG_GRAPH_HOST } from "./config";

export class GraphApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly type: string | null,
  ) {
    super(message);
    this.name = "GraphApiError";
  }
  /** OAuthException 190 = invalid/expired token. */
  get isAuthError() {
    return this.code === 190 || this.type === "OAuthException" && this.status === 401;
  }
  get isRateLimit() {
    return this.status === 429 || this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function parseGraphResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  const err = (body as { error?: { message?: string; code?: number; error_subcode?: number; type?: string } } | null)?.error;
  if (!res.ok || err) {
    throw new GraphApiError(
      redact(err?.message ?? `HTTP ${res.status}`),
      res.status,
      err?.code ?? null,
      err?.error_subcode ?? null,
      err?.type ?? null,
    );
  }
  return body as T;
}

export class GraphClient {
  constructor(
    private readonly accessToken: string,
    private readonly version: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  url(path: string, params: Record<string, string | number | undefined> = {}): string {
    const u = new URL(`${IG_GRAPH_HOST}/${this.version}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
    return u.toString();
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    // Token in the Authorization header keeps it out of URLs and logs.
    const res = await this.fetchImpl(this.url(path, params), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      cache: "no-store",
    });
    return parseGraphResponse<T>(res);
  }

  /** Follows `paging.next` cursors (absolute URLs) up to `maxPages`. */
  async getAll<T>(path: string, params: Record<string, string | number | undefined>, maxPages = 200): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = this.url(path, params);
    for (let i = 0; url && i < maxPages; i++) {
      const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.accessToken}` }, cache: "no-store" });
      const page: { data?: T[]; paging?: { next?: string } } = await parseGraphResponse(res);
      out.push(...(page.data ?? []));
      const next: string | undefined = page.paging?.next;
      url = next && next.startsWith(IG_GRAPH_HOST) ? next : null;
    }
    return out;
  }
}
