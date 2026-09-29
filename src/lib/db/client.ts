/**
 * Postgres connection (Supabase). Uses the Supabase connection string
 * (transaction pooler on port 6543 for serverless) — `prepare: false` is
 * required by the pooler. Server-only.
 */
import postgres from "postgres";

export type Sql = postgres.Sql;

let sql: Sql | null = null;

export function createSql(url: string, opts: { max?: number } = {}): Sql {
  return postgres(url, {
    prepare: false,
    max: opts.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
}

export function getSql(): Sql {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (required when DATA_SOURCE=supabase). See SETUP.md.");
    sql = createSql(url);
  }
  return sql;
}

/** Postgres numeric/bigint come back as strings/bigint → number|null. */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}
