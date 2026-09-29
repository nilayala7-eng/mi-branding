// Server-side module (also used by the standalone MCP server, so it cannot
// import "server-only"). Never import from a "use client" file.
import { serverEnv } from "@/lib/env";
import { localDate } from "@/lib/metrics/filters";
import { MockRepository, MOCK_TIMEZONE } from "./mock/mock-repository";
import type { DataRepository } from "./repository";

let cached: { key: string; repo: DataRepository } | null = null;

/**
 * Returns the active data repository.
 * - DATA_SOURCE=mock (default in Phase 1): deterministic demo data.
 * - DATA_SOURCE=supabase: real data (Phase 2 — not implemented yet).
 */
export function getRepository(): DataRepository {
  const env = serverEnv();
  const today = localDate(new Date().toISOString(), env.ACCOUNT_TIMEZONE || MOCK_TIMEZONE);
  const key = `${env.DATA_SOURCE}:${today}`;
  if (cached?.key === key) return cached.repo;

  if (env.DATA_SOURCE === "supabase") {
    throw new Error(
      "DATA_SOURCE=supabase is not implemented yet (Phase 2). See PROGRESS.md. Use DATA_SOURCE=mock.",
    );
  }
  cached = { key, repo: new MockRepository(today) };
  return cached.repo;
}
