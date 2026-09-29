# Arquitectura — Ayala OS

## Visión general

```
                         ┌──────────────── Next.js 16 (App Router) ────────────────┐
 Navegador ── Basic auth ─▶ src/proxy.ts                                           │
                         │   │                                                     │
                         │   ├─ Páginas (server components)  /overview /analytics │
                         │   │   /content /strategy /claude /experiments /settings │
                         │   ├─ Server actions (experiments)                       │
                         │   └─ API routes  /api/claude/chat  /api/instagram/*     │
                         │            │                                            │
                         │            ▼                                            │
                         │   services/  analytics · strategy · experiments ·       │
                         │              classification · instagram (sync)          │
                         │            │                                            │
                         │            ▼                                            │
                         │   lib/data  DataRepository  ──┬─ MockRepository (F1)   │
                         │                               └─ Supabase repo (F2)    │
                         └─────────────────────────────────────────────────────────┘
   lib/ai  (tool registry + analyst rules + chat loop) ──▶ Claude API
   mcp/server.ts (stdio) ── mismo tool registry ──▶ Claude Code / Claude Desktop
   lib/meta (Fase 2, bloqueado hasta verificar docs) ──▶ Instagram Graph API
```

## Capas y reglas

| Capa | Carpeta | Regla |
|---|---|---|
| Dominio | `src/lib/domain` | Tipos y periodos. Sin I/O. `null` = "no disponible", nunca 0. |
| Cálculo | `src/lib/metrics` | Funciones puras (sumas, ratios, medianas, filtros, series). 100% testeadas. |
| Datos | `src/lib/data` | Única frontera de acceso a datos: interfaz `DataRepository`. |
| Negocio | `src/services/*` | Toda la lógica de negocio. Reciben un repositorio → testeables. |
| IA | `src/lib/ai` | Reglas del analista, registro de herramientas (zod), bucle de chat. |
| MCP | `mcp/server.ts` | Expone **el mismo** registro de herramientas por stdio. |
| Meta | `src/lib/meta` | Hechos de la API con nivel de verificación. Sin endpoints hasta verificarlos. |
| Seguridad | `src/lib/security`, `src/proxy.ts` | Contraseña de acceso, cifrado de tokens, state OAuth firmado. |
| UI | `src/app`, `src/components` | Solo presenta. Nunca calcula métricas por su cuenta. |

## Funciones principales (pedidas en el brief)

`getAccountMetrics`, `getPostMetrics`, `getTopPosts`, `comparePeriods`, `getContentByTopic/Hook/CTA`
→ `src/services/analytics`. `detectPatterns`, `generateStrategy` → `src/services/strategy`.
`createExperiment` → `src/services/experiments`.

## Flujo de datos de Instagram (Fase 2)

`InstagramSource` (adaptador Meta, pendiente) → `runSync()` → `SyncStore` (Supabase).
Claves de idempotencia: `posts(account_id, ig_media_id)`, `post_insights(post_id, captured_on)`,
`account_insights(account_id, date)`. Un sync con lock, registro en `sync_runs`, errores por post
no abortan el run (`partial`), tokens redactados en errores.

## Inteligencia (Claude)

1. Las métricas y patrones se calculan de forma **determinista** en `services/`.
2. Claude recibe **herramientas** (no la BD): `get_account_metrics`, `compare_periods`, `get_top_posts`,
   `search_posts`, `get_post_metrics`, `get_content_patterns`, `get_strategy`, `get_experiments`,
   `get_taxonomy`, `create_experiment`. Salidas compactas y acotadas.
3. El system prompt (`analyst-rules.ts`) impone las 14 reglas del analista y el formato
   Datos / Interpretación / Hipótesis / Recomendación.
4. La UI muestra qué herramientas se usaron en cada respuesta ("Datos consultados").

## Taxonomía evolutiva

Dimensiones y valores viven en `taxonomy_dimensions` / `taxonomy_values` (datos). Ningún servicio
depende de un slug concreto. Clasificadores implementan `ContentClassifier`; las etiquetas guardan
`source` (manual/claude/rule) y `confidence`. Las manuales nunca se sobrescriben.
