/**
 * Ayala OS MCP server (stdio).
 *
 * Exposes the same analytics tools the in-app chat uses, so Claude Code /
 * Claude Desktop can query the account data directly. Read-only except
 * `create_experiment` (creates drafts only).
 *
 * Run:  npm run mcp        (see CLAUDE_SETUP.md for client configuration)
 * Logs go to stderr — stdout is reserved for the MCP protocol.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getRepository } from "@/lib/data";
import { TOOLS, type ToolDef } from "@/lib/ai/tools";

async function main() {
  const repo = getRepository();
  const server = new McpServer({ name: "ayala-os", version: "0.1.0" });

  for (const tool of TOOLS as readonly ToolDef[]) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: { readOnlyHint: !tool.mutates },
      },
      async (input: unknown) => {
        try {
          const parsed = tool.schema.parse(input ?? {});
          const result = await tool.run(repo, parsed);
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return { content: [{ type: "text" as const, text: message }], isError: true };
        }
      },
    );
  }

  await server.connect(new StdioServerTransport());
  const account = await repo.getAccount();
  console.error(`ayala-os MCP server ready (${account.isMock ? "MOCK data" : "live data"}, ${TOOLS.length} tools)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
