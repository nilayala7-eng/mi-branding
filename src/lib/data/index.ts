// Server-side module (also used by the standalone MCP server, so it cannot
// import "server-only"). Never import from a "use client" file.
import { serverEnv } from "@/lib/env";
import { localDate } from "@/lib/metrics/filters";
import { MockRepository, MOCK_TIMEZONE } from "./mock/mock-repository";
import type { DataRepository } from "./repository";
import { getSql } from "@/lib/db/client";
import { PostgresRepository } from "./postgres/postgres-repository";

let cached: { key: string; repo: DataRepository } | null = null;

/**
 * Returns the active data repository.
 * - DATA_SOURCE=mock (default in Phase 1): deterministic demo data.
 * - DATA_SOURCE=supabase: real data from Postgres (DATABASE_URL).
 */
export function getRepository(): DataRepository {
  const env = serverEnv();
  const today = localDate(new Date().toISOString(), env.ACCOUNT_TIMEZONE || MOCK_TIMEZONE);
  const key = `${env.DATA_SOURCE}:${today}`;
  if (cached?.key === key) return cached.repo;

  if (env.DATA_SOURCE === "supabase") {
    // New instance per call: cheap (shared connection pool) and never stale.
    return new PostgresRepository(getSql(), env.ACCOUNT_TIMEZONE);
  }
  cached = { key, repo: new MockRepository(today) };
  return cached.repo;
}
