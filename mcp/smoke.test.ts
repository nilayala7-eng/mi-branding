/**
 * End-to-end MCP check: spawns `mcp/server.ts` over stdio with the official
 * MCP client, lists tools and calls one.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

describe("MCP server (stdio)", () => {
  it("lists the analytics tools and answers a call", async () => {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "mcp/server.ts"],
      env: { ...process.env, DATA_SOURCE: "mock" } as Record<string, string>,
      stderr: "ignore",
    });
    const client = new Client({ name: "ayala-os-test", version: "0.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(
        expect.arrayContaining(["get_account_metrics", "compare_periods", "search_posts", "get_strategy", "create_experiment"]),
      );
      expect(tools.find((t) => t.name === "get_strategy")?.annotations?.readOnlyHint).toBe(true);
      expect(tools.find((t) => t.name === "create_experiment")?.annotations?.readOnlyHint).toBe(false);

      const res = await client.callTool({ name: "get_experiments", arguments: {} });
      const text = (res.content as { type: string; text: string }[])[0].text;
      expect(JSON.parse(text).experiments.length).toBeGreaterThan(0);

      const bad = await client.callTool({ name: "get_account_metrics", arguments: { from: "nope", to: "2026-01-01" } });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 60_000);
});
