# Progreso

## Fase 0 — Investigación ✅ (parcial en Meta)
- Entorno: Node 22.22, npm 10.9, PostgreSQL 16 client/binarios, sin Docker.
- Meta: docs oficiales bloqueadas por la red del entorno → verificación parcial (ver META_SETUP.md §0 y Settings).
- Anthropic: referencia del SDK TS y MCP SDK revisadas; tipos comprobados con `tsc`.

## Fase 1 — Fundación ✅
- App Next.js con 7 páginas y datos mock etiquetados.
- Servicios analytics / strategy / experiments / classification / instagram-sync.
- Chat con Claude (herramientas estructuradas) + servidor MCP stdio.
- Seguridad: contraseña de acceso, cifrado de tokens, state OAuth, validación zod.
- Migración SQL + seed, validados en PostgreSQL 16.
- Verificación: `npm run check` (typecheck + lint + 119 tests) ✅ · `next build` ✅ · gate de acceso en producción probado (503 / 401 / 200) ✅.
- **No probado:** chat contra la API real de Claude (sin API key en el entorno).

## Fase 2 — Datos reales (siguiente)
- [ ] Verificar docs de Meta y marcar cada hecho como `verified`.
- [ ] Usuario: crear app de Meta (META_SETUP.md) y proyecto Supabase (SETUP.md).
- [ ] `SupabaseRepository` + `SupabaseSyncStore` (mismos contratos, tests compartidos).
- [ ] Adaptador `InstagramSource` (OAuth, media, insights) + `/api/instagram/*`.
- [ ] Cron de sync (Vercel Cron) + refresco de token + caché de thumbnails.
- [ ] Edición de taxonomía y etiquetado manual en Content.

## Fase 3 — Inteligencia
- [ ] Clasificador con Claude (structured outputs) + revisión humana.
- [ ] Persistir `claude_analyses` y `strategy_recommendations`; chat en streaming.
- [ ] Evaluación automática de experimentos con posts asignados.

## Fase 4 — Negocio
- [ ] Leads, DMs y conversión a clientes conectados al contenido.
