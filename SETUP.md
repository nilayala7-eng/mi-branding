# Setup

## Local (5 minutos)

Requisitos: Node ≥ 22 y npm.

```bash
npm install
cp .env.example .env.local     # rellena lo que tengas; con DATA_SOURCE=mock ya funciona
npm run dev                    # http://localhost:3000
```

Comprobaciones: `npm run check` (typecheck + lint + tests) · `npm run build`.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATA_SOURCE` | no (`mock`) | `mock` ahora; `supabase` en Fase 2 |
| `APP_ACCESS_PASSWORD` | **sí en producción** | Contraseña de acceso (el navegador la pide; usuario cualquiera) |
| `APP_ENCRYPTION_KEY` | antes de conectar Instagram | Cifra tokens. `openssl rand -base64 48` |
| `ANTHROPIC_API_KEY` | para el chat | CLAUDE_SETUP.md |
| `CLAUDE_MODEL` | no | Por defecto `claude-opus-5-5` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Fase 2 | Base de datos |
| `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION` | Fase 2 | META_SETUP.md |

`.env.local` está en `.gitignore`: nunca se sube a git.

## Supabase (Fase 2)

1. Crea un proyecto en <https://supabase.com> (región UE).
2. *Project Settings → API*: copia URL, `anon` key y `service_role` key a `.env.local`.
3. Aplica el esquema: *SQL Editor* → pega `supabase/migrations/20260929000001_initial_schema.sql` → Run; después `supabase/seed.sql`.
   (Alternativa CLI: `npx supabase link` + `npx supabase db push`.)

## Deploy en Vercel

1. Importa el repo en <https://vercel.com/new>.
2. Añade las variables de entorno (incluida **`APP_ACCESS_PASSWORD`**, sin ella la app responde 503).
3. Deploy. Actualiza la redirect URI de Meta con el dominio de Vercel.

## MCP (opcional)

`npm run mcp` arranca el servidor MCP. Configuración de clientes en CLAUDE_SETUP.md.
