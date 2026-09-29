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

## Fase 2 — Datos reales ✅ (código) · ⏳ (tu configuración)
- Documentación de Meta verificada (v26.0) → `src/lib/meta/verification.ts`, META_SETUP.md.
- OAuth Instagram Login completo: state firmado + cookie (anti-CSRF), token largo cifrado, renovación automática.
- `MetaInstagramSource`: media paginada, insights por tipo (sin follows en Reels), métricas diarias de cuenta, seguidores diarios.
- Postgres: `PostgresRepository` + `PostgresSyncStore` (upserts idempotentes, lock, `sync_runs`).
- Settings: Conectar / Sincronizar / Sync completo / Desconectar. Cron diario (`vercel.json`, `/api/cron/sync` con `CRON_SECRET`).
- Content: etiquetado manual por dimensión (las manuales nunca se sobrescriben).
- Verificación: 146 tests (incl. 9 de integración contra PostgreSQL 16 y 18 de Meta con fetch simulado) · build ✅ · app en modo `supabase` probada (páginas, redirect OAuth, state inválido rechazado, cron 401 sin secreto).
- **No probado todavía:** llamadas reales a Instagram (requiere tu app de Meta y tu cuenta).
- Pendiente de confirmar con datos reales: mapeo follows/unfollows, VIDEO = Reel, unidad de `ig_reels_avg_watch_time`.

## Fase 3 — Inteligencia
- [ ] Clasificador con Claude (structured outputs) + revisión humana.
- [ ] Editor de taxonomía en Settings; caché de thumbnails en Supabase Storage.
- [ ] Persistir `claude_analyses` y `strategy_recommendations`; chat en streaming.
- [ ] Evaluación automática de experimentos con posts asignados.

## Fase 4 — Negocio
- [ ] Leads, DMs y conversión a clientes conectados al contenido.
