# Base de datos

PostgreSQL (Supabase). Esquema: `supabase/migrations/20260929000001_initial_schema.sql`. Seed de taxonomía: `supabase/seed.sql` (generado con `npm run db:seed:generate` desde `src/lib/data/taxonomy-seed.ts`). Validado en PostgreSQL 16.

## Tablas

| Tabla | Contenido | Clave única (idempotencia) |
|---|---|---|
| `users` | Usuario de la app | `email`, `auth_user_id` |
| `instagram_accounts` | Cuenta conectada, token **cifrado**, estado de conexión, último sync/error, lock | `ig_user_id` |
| `sync_runs` | Log de cada sincronización (contadores, errores redactados) | — |
| `posts` | Publicación (tipo, caption, fecha, duración, permalink, thumbnail) | `(account_id, ig_media_id)` |
| `post_insights` | Snapshot diario de métricas por post (historial) | `(post_id, captured_on)` |
| `account_insights` | Métricas diarias de cuenta | `(account_id, date)` |
| `taxonomy_dimensions` | topic, subtopic, hook, cta, format, visual_style, audio… | `key` |
| `taxonomy_values` | Valores editables, jerarquía subtopic→topic | `(dimension, slug)` |
| `content_tags` | Post ↔ valor, con `source` (manual/claude/rule), `confidence`, `model` | `(post_id, dimension)` |
| `claude_analyses` | Análisis de Claude + herramientas/datos usados | — |
| `strategy_recommendations` | Dato / interpretación / hipótesis / recomendación / confianza | `(account_id, insight_key, period_from, period_to)` |
| `experiments` | Hipótesis, métrica, baseline, test, fechas, estado, resultado, conclusión | — |
| `experiment_results` | Posts asignados a un experimento (brazo test/control) y su valor | `(experiment_id, post_id)` |

Vista `post_latest_insights`: último snapshot por post (`security_invoker`).

## Convenciones
- `timestamptz` en UTC; días (`date`) en la zona de la cuenta (`users.timezone`).
- `NULL` = métrica no disponible. Nunca se sustituye por 0.
- `updated_at` automático por trigger.
- Índices en `(account_id, published_at)`, `(account_id, date)`, snapshots por post, etiquetas por valor, búsqueda full-text en español sobre captions.

## Seguridad
- RLS activado en todas las tablas y **sin políticas públicas**: la `anon` key no puede leer nada. El servidor usa la `service_role` key (solo en el servidor).
- Tokens de Instagram cifrados con AES-256-GCM en la app antes de guardarse.
