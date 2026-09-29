import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { MockRepository } from "@/lib/data/mock/mock-repository";
import { runAnalystChat } from "./chat";

type Req = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** Scripted fake of client.beta.messages.create — no network. */
function fakeClient(responses: Partial<Anthropic.Beta.BetaMessage>[]) {
  const requests: Req[] = [];
  const client = {
    beta: {
      messages: {
        create: async (req: Req) => {
          requests.push(structuredClone(req));
          const r = responses.shift();
          if (!r) throw new Error("no more scripted responses");
          return {
            model: "claude-opus-5-5",
            usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
            ...r,
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const repo = new MockRepository("2026-09-29");

describe("runAnalystChat", () => {
  it("executes requested tools and returns the final text with a trace", async () => {
    const { client, requests } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "tool_use", id: "t1", name: "compare_periods", input: { from: "2026-09-01", to: "2026-09-29" } },
          { type: "tool_use", id: "t2", name: "get_account_metrics", input: { from: "bad", to: "2026-09-29" } },
        ] as Anthropic.Beta.BetaContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "**Datos** — …", citations: null }] as Anthropic.Beta.BetaContentBlock[] },
    ]);

    const res = await runAnalystChat(repo, [{ role: "user", content: "Compara este mes con el anterior." }], { client });

    expect(res.text).toBe("**Datos** — …");
    expect(res.toolCalls.map((t) => [t.name, t.ok])).toEqual(
      expect.arrayContaining([
        ["compare_periods", true],
        ["get_account_metrics", false],
      ]),
    );

    // Second request: assistant turn replayed unchanged (incl. thinking), then tool results.
    const second = requests[1].messages;
    expect(second.at(-2)).toMatchObject({ role: "assistant" });
    const results = second.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results.map((r) => r.tool_use_id)).toEqual(["t1", "t2"]);
    expect(results[1].is_error).toBe(true);
  });

  it("sends a stable system prompt, the mock-data warning and the fallback config", async () => {
    const { client, requests } = fakeClient([{ stop_reason: "end_turn", content: [] }]);
    await runAnalystChat(repo, [{ role: "user", content: "Hola" }], { client });
    const req = requests[0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(JSON.stringify(req.system)).not.toMatch(/2026-09-29/); // no dates in the cached prefix
    expect(JSON.stringify(req.messages[0].content)).toMatch(/DEMOSTRACIÓN/);
  });

  it("replays earlier turns as plain text only", async () => {
    const { client, requests } = fakeClient([{ stop_reason: "end_turn", content: [] }]);
    await runAnalystChat(
      repo,
      [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ],
      { client },
    );
    expect(requests[0].messages.slice(0, 2)).toEqual([
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
  });

  it("rejects a history that does not end with the user", async () => {
    const { client } = fakeClient([]);
    await expect(runAnalystChat(repo, [{ role: "assistant", content: "x" }], { client })).rejects.toThrow();
  });
});
