# Claude — configuración

## 1. API key (para el chat de /claude)

1. Entra en <https://platform.claude.com> → *API Keys* → **Create key** (nombre: `ayala-os`).
2. Añade saldo/facturación en *Billing* si la cuenta es nueva.
3. En `.env.local`: `ANTHROPIC_API_KEY=sk-ant-...` y reinicia `npm run dev`.
4. En Vercel: añade la misma variable en *Settings → Environment Variables*.

La key solo se usa en el servidor; nunca llega al navegador.

**Coste orientativo:** el chat usa `claude-opus-5-5` (4 $/M tokens entrada, 20 $/M salida) con thinking adaptativo. Una pregunta típica con 2–4 consultas de datos suele costar céntimos. Para abaratar: `CLAUDE_MODEL=claude-sonnet-5-5`.

## 2. Cómo trabaja el analista

- System prompt: `src/lib/ai/analyst-rules.ts` (14 reglas del brief + contexto de Ayala Fitness).
- Herramientas: `src/lib/ai/tools.ts`. Claude nunca ve la base de datos completa; pide datos acotados.
- Cada respuesta muestra "Datos consultados" con las herramientas y parámetros usados.

## 3. MCP — usar tus datos desde Claude Code / Claude Desktop

El servidor MCP expone las mismas herramientas (solo lectura, salvo crear experimentos en borrador).

**Claude Code** (desde la carpeta del proyecto):
```bash
claude mcp add ayala-os -- npx tsx mcp/server.ts
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "ayala-os": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/ruta/a/mi-branding",
      "env": { "DATA_SOURCE": "mock" }
    }
  }
}
```

Prueba: "Usa ayala-os y compara los últimos 30 días con los anteriores".
