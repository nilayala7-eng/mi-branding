# Decisiones

Formato: contexto → decisión → consecuencia.

**D-001 Stack.** Next.js 16 + TS + Tailwind v4 + Supabase + Claude API + MCP + Vercel, como pidió el brief. Sin cambios de tecnología.

**D-002 Investigación de Meta.** (Actualizado en Fase 2: docs oficiales leídas y verificadas el 29-09-2026.) Inicialmente bloqueada: La red del entorno cloud bloquea `developers.facebook.com`. Se usó (a) búsqueda web limitada a docs oficiales y (b) el SDK oficial `facebook-nodejs-business-sdk` v24.0.1 (npm). Cada hecho se clasifica en `src/lib/meta/verification.ts` (verified / sdk / search / unverified). En Fase 1 no se implementó ningún endpoint de Meta. En Fase 2 se leyeron las docs oficiales (versión `.md` de cada página) y se implementó solo lo verificado.

**D-003 Repositorio como frontera.** `DataRepository` separa lógica y almacenamiento; el mock y Supabase son intercambiables vía `DATA_SOURCE`.

**D-004 Mock determinista y etiquetado.** Semilla fija; banner permanente "Datos de demostración"; los insights mock llevan un caveat explícito. Los patrones del mock no dicen nada de la cuenta real.

**D-005 Fuentes autoalojadas.** Sora + Inter (de DESIGN.md) vía `@fontsource`, sin dependencia de red en build.

**D-006 Tema oscuro.** El brief pide UI oscura; DESIGN.md es claro (marca pública). Se conservan tipografías y acentos verde/coral sobre fondo oscuro. Paleta de gráficos validada para daltonismo (ΔE ≥ 9,4).

**D-007 Periodos equivalentes.** Toda comparación usa un periodo de igual duración inmediatamente anterior; periodos de distinta longitud se rechazan.

**D-008 Reach agregado.** Sumar reach diario ≠ cuentas únicas del periodo. La UI lo etiqueta "suma de reach diario".

**D-009 Engagement.** Interacciones = likes + comments + shares + saves; engagement rate = interacciones / reach. Métricas por 1.000 cuentas alcanzadas para comparar posts.

**D-010 Umbrales estadísticos.** Grupo < 5 posts = "muestra insuficiente", nunca patrón. Medianas, no medias. Diferencia mínima ±25 % para patrón, ±15 % para cambio de cuenta y para experimentos. Patrones observacionales con confianza máx. "media"; solo experimentos pueden dar más.

**D-011 Una etiqueta por dimensión y post.** Simplifica agregaciones (`unique(post_id, dimension)`). Revisable si hace falta multi-etiqueta.

**D-012 Snapshots diarios de insights.** Una fila por post y día → historial de evolución sin duplicados.

**D-013 Chat: historial en texto.** Turnos anteriores se reenvían como texto plano (sin bloques de thinking); dentro de un turno la lista es append-only. Evita errores de "preserved thinking" de Opus 5.5 a costa de perder razonamiento previo. Fase 3: persistir conversación completa y reenviarla íntegra.

**D-014 Acceso: Basic auth.** App de un solo usuario: `APP_ACCESS_PASSWORD` vía `src/proxy.ts`. Sin contraseña → abierta en desarrollo, **503 en producción**. Supabase Auth cuando haga falta más.

**D-015 Tokens cifrados en la app.** AES-256-GCM con `APP_ENCRYPTION_KEY`; la BD nunca ve el token en claro. RLS activado en todas las tablas sin políticas públicas (acceso solo server-side con service role).

**D-016 Modelo Claude.** `claude-opus-5-5`, thinking adaptativo, effort `high`, fallback de servidor ante rechazos (`fallbacks: "default"`). Configurable con `CLAUDE_MODEL`.

**D-017 Chat no-streaming en F1.** Más simple; `maxDuration` 300 s. Streaming en Fase 3.

**D-018 Postgres directo en lugar de supabase-js.** `DATABASE_URL` (pooler de Supabase, `prepare: false`) con el driver `postgres`. Toda la lógica corre en servidor, el SQL refleja la migración y se prueba contra un PostgreSQL real. Supabase Auth/Storage siguen disponibles cuando se necesiten.

**D-019 VIDEO = Reel.** Con Instagram Login no existe `media_product_type`; los vídeos publicados hoy son Reels. Pendiente de confirmar con datos reales.

**D-020 Métricas de cuenta día a día.** Se piden con `period=day&metric_type=total_value` y `since/until` = medianoche local (Europe/Madrid). 2 llamadas por día; backfill de 90 días en el primer sync, últimos 7 días después (datos con hasta 48 h de retraso). Los valores nulos nunca sobrescriben valores conocidos (`coalesce`).

**D-021 Seguridad del OAuth.** `state` firmado con HMAC y caducidad de 10 min + cookie httpOnly que lo ata al navegador (anti login-CSRF). El token viaja en cabecera `Authorization`, no en la URL (salvo los endpoints de intercambio, que Meta define como GET con query). Los enlaces de paginación solo se siguen si apuntan a `graph.instagram.com`.

**D-022 Cron fuera de la contraseña.** `/api/cron/sync` se excluye del Basic auth y exige `Authorization: Bearer CRON_SECRET` (lo envía Vercel Cron).

**D-023 Stories fuera de alcance.** Solo 24 h y sin webhook de insights con Instagram Login.
