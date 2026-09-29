# AYALA OS

**Instagram Intelligence & Content Strategy** — centro de control privado para analizar la cuenta de Instagram de Ayala Fitness, detectar patrones y convertir métricas en hipótesis, experimentos y recomendaciones, con Claude como analista.

> Estado: **Fases 1 y 2 completas.** Con `DATA_SOURCE=mock` funciona con datos de demostración; con Supabase + app de Meta importa tus datos reales de Instagram — ver [META_SETUP.md](META_SETUP.md) y [PROGRESS.md](PROGRESS.md).

## Qué hace

| Página | Pregunta que responde |
|---|---|
| `/overview` | ¿Qué está pasando? KPIs vs periodo anterior, tendencias, top content, patrones, **What to do next** |
| `/analytics` | Evolución de seguidores, reach, views, engagement, shares, saves, comments, follows (7d–1 año / custom) |
| `/content` | Biblioteca de publicaciones con métricas, ratios por 1k reach y metadata (tema, hook, CTA, formato…) |
| `/strategy` | **Where to go next**: patrones +/−, cambios, oportunidades, hipótesis, experimentos |
| `/claude` | Chat con Claude sobre tus datos (cada cifra sale de una consulta) |
| `/experiments` | Hipótesis → test → resultado → conclusión |
| `/settings` | Conexiones, sync, estado de verificación de Meta, taxonomía |

## Arranque rápido

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run check      # typecheck + lint + tests
```

## Documentación

[SETUP](SETUP.md) · [ARCHITECTURE](ARCHITECTURE.md) · [META_SETUP](META_SETUP.md) · [CLAUDE_SETUP](CLAUDE_SETUP.md) · [DATABASE](DATABASE.md) · [DECISIONS](DECISIONS.md) · [PROGRESS](PROGRESS.md) · [DESIGN (marca)](DESIGN.md)

## Stack

Next.js 16 · TypeScript · Tailwind v4 · Recharts · Supabase/PostgreSQL · Claude API (`@anthropic-ai/sdk`) · MCP (`@modelcontextprotocol/sdk`) · Vitest · Vercel.
