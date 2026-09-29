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
| `DATA_SOURCE` | no (`mock`) | `mock` = demo · `supabase` = datos reales |
| `APP_ACCESS_PASSWORD` | **sí en producción** | Contraseña de acceso (el navegador la pide; usuario cualquiera) |
| `APP_ENCRYPTION_KEY` | para Instagram | Cifra tokens y firma el OAuth. `openssl rand -base64 48` |
| `DATABASE_URL` | con `supabase` | Conexión a Postgres (ver abajo) |
| `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION` | para Instagram | META_SETUP.md |
| `APP_URL` | en producción | URL pública (se usa para la redirect URI de Instagram) |
| `CRON_SECRET` | en producción | Protege el sync diario automático |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | para el chat | CLAUDE_SETUP.md |

`.env.local` está en `.gitignore`: nunca se sube a git.

## Supabase (base de datos)

1. Crea un proyecto en <https://supabase.com> (región UE, p. ej. Frankfurt). Guarda la contraseña de la base de datos.
2. **SQL Editor → New query** → pega todo el contenido de `supabase/setup.sql` (tablas + categorías en un solo archivo) → **Run**.
   Se puede ejecutar más de una vez: crea solo lo que falta, nunca borra ni sobrescribe datos y va en una transacción (todo o nada). Si una tabla con el mismo nombre no es de Ayala OS, se detiene sin cambiar nada.
   Para ver el estado sin tocar nada: pega `supabase/check.sql` → **Run** (una fila por tabla: OK / FALTA / DISTINTA / AJENA, con nº de filas).
3. Botón **Connect** (arriba) → **Transaction pooler** → copia la cadena `postgresql://…:6543/postgres`, sustituye `[YOUR-PASSWORD]` y úsala como `DATABASE_URL`.
4. Pon `DATA_SOURCE=supabase`.

## Deploy en Vercel

1. <https://vercel.com/new> → importa el repositorio `mi-branding`.
2. Añade todas las variables de la tabla (Production).
3. **Deploy**. Copia el dominio (`https://….vercel.app`), ponlo en `APP_URL` y en la redirect URI de Meta, y vuelve a desplegar.
4. El sync diario (`vercel.json`, 05:00 UTC) funciona solo si `CRON_SECRET` está definida.

## Tests

`npm run check` (typecheck + lint + tests unitarios). Tests contra Postgres real: `TEST_DATABASE_URL=postgres://… npm run test:db` (**borra** esa base de datos; usa una vacía).

## MCP (opcional)

`npm run mcp` arranca el servidor MCP. Configuración de clientes en CLAUDE_SETUP.md.
