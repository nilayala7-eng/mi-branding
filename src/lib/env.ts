/**
 * Server-side environment, validated with zod. Nothing here is exposed to the
 * browser: only variables prefixed NEXT_PUBLIC_ reach client bundles, and this
 * app defines none that are secret.
 */
import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const schema = z.object({
  DATA_SOURCE: z.enum(["mock", "supabase"]).default("mock"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ACCOUNT_TIMEZONE: z.string().default("Europe/Madrid"),

  // Anthropic
  ANTHROPIC_API_KEY: optionalSecret,
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),

  // Supabase (Phase 2)
  NEXT_PUBLIC_SUPABASE_URL: optionalSecret,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,

  // Meta / Instagram (Phase 2 — values pending verification, see META_SETUP.md)
  META_APP_ID: optionalSecret,
  META_APP_SECRET: optionalSecret,
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, "Expected a version like v24.0")
    .default("v24.0"),

  // Security
  /** 32+ byte secret used to sign OAuth state and encrypt tokens at rest. */
  APP_ENCRYPTION_KEY: optionalSecret,
  /** Shared password protecting this private app (single-user). */
  APP_ACCESS_PASSWORD: optionalSecret,
});

export type ServerEnv = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

let cached: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Feature flags derived from env — safe to send to the client (booleans only). */
export function integrationStatus() {
  const env = serverEnv();
  return {
    dataSource: env.DATA_SOURCE,
    claudeConfigured: Boolean(env.ANTHROPIC_API_KEY),
    supabaseConfigured: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    metaConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET),
    encryptionConfigured: Boolean(env.APP_ENCRYPTION_KEY && env.APP_ENCRYPTION_KEY.length >= 32),
    accessPasswordConfigured: Boolean(env.APP_ACCESS_PASSWORD),
    claudeModel: env.CLAUDE_MODEL,
    graphApiVersion: env.META_GRAPH_API_VERSION,
  };
}
