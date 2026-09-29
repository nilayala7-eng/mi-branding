/**
 * Claude analyst conversation loop (server-side only).
 *
 * - Manual tool-use loop so the same tool registry serves chat and MCP.
 * - History from earlier turns is replayed as plain text (no thinking blocks);
 *   within a turn the message list is append-only. See DECISIONS.md D-013.
 * - Server-side refusal fallback enabled ("default" routing).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { DataRepository } from "@/lib/data/repository";
import { serverEnv } from "@/lib/env";
import { ANALYST_SYSTEM_PROMPT } from "./analyst-rules";
import { executeTool, TOOLS, toolInputJsonSchema } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ToolTrace {
  name: string;
  input: unknown;
  ok: boolean;
  error?: string;
}

export interface ChatResult {
  text: string;
  toolCalls: ToolTrace[];
  stopReason: string | null;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set. See CLAUDE_SETUP.md.");
  }
}

const MAX_ITERATIONS = 10;

const TOOL_DEFS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: toolInputJsonSchema(t),
}));

export async function runAnalystChat(
  repo: DataRepository,
  history: ChatTurn[],
  opts: { client?: Anthropic } = {},
): Promise<ChatResult> {
  const env = serverEnv();
  if (!opts.client && !env.ANTHROPIC_API_KEY) throw new ClaudeNotConfiguredError();
  const client = opts.client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const account = await repo.getAccount();
  const context = [
    `Contexto de esta petición: hoy es ${account.today} (zona horaria de la cuenta).`,
    account.isMock
      ? "ATENCIÓN: la base de datos contiene DATOS DE DEMOSTRACIÓN generados, no datos reales de Instagram."
      : `Cuenta: @${account.username}. Última sincronización: ${account.lastSyncAt ?? "nunca"}.`,
  ].join(" ");

  const last = history.at(-1);
  if (!last || last.role !== "user") throw new Error("History must end with a user message.");

  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(0, -1).map((t) => ({
    role: t.role,
    content: t.content,
  }));
  messages.push({
    role: "user",
    content: [
      { type: "text", text: context },
      { type: "text", text: last.content },
    ],
  });

  const toolCalls: ToolTrace[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let response: Anthropic.Beta.BetaMessage | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    response = await client.beta.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: ANALYST_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOL_DEFS,
      messages,
    });
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;

    if (response.stop_reason === "refusal") break;
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tu) => {
        try {
          const output = await executeTool(repo, tu.name, tu.input);
          toolCalls.push({ name: tu.name, input: tu.input, ok: true });
          return { type: "tool_result" as const, tool_use_id: tu.id, content: JSON.stringify(output) };
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          toolCalls.push({ name: tu.name, input: tu.input, ok: false, error });
          return { type: "tool_result" as const, tool_use_id: tu.id, content: error, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }

  if (!response) throw new Error("No response from Claude.");
  const text =
    response.stop_reason === "refusal"
      ? "Claude no ha podido responder a esta petición."
      : response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n\n");

  return { text, toolCalls, stopReason: response.stop_reason, model: response.model, usage };
}
