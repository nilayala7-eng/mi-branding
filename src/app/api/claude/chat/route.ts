import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ClaudeNotConfiguredError, runAnalystChat } from "@/lib/ai/chat";
import { getRepository } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
    .min(1)
    .max(40)
    .refine((m) => m.at(-1)?.role === "user", "Last message must be from the user"),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : "Invalid JSON body";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const result = await runAnalystChat(getRepository(), body.messages);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ClaudeNotConfiguredError) {
      return Response.json({ error: e.message, code: "not_configured" }, { status: 503 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Claude rate limit reached. Try again in a minute." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Invalid ANTHROPIC_API_KEY." }, { status: 502 });
    }
    if (e instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error (${e.status ?? "unknown"}).` }, { status: 502 });
    }
    console.error("claude chat failed", e);
    return Response.json({ error: "Unexpected error" }, { status: 500 });
  }
}
