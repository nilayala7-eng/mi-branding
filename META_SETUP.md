# Conectar Instagram — guía para Nil

No hace falta saber programar. Sigue los pasos en orden. **Nunca** me des tu contraseña de Instagram: la conexión usa el login oficial de Meta y la app solo recibe un token de acceso.

## 0. Estado actual (importante)

La documentación oficial de Meta no se pudo leer desde el entorno de trabajo (red bloqueada). Lo que sigue está basado en fragmentos de la documentación oficial y en el SDK oficial de Meta, **pero los nombres exactos de botones, permisos y pantallas deben confirmarse** cuando se abra el acceso. La app no intentará conectarse a Instagram hasta entonces. Estado detallado: página **Settings → Estado de verificación**.

Para desbloquearlo: en la sesión de Claude Code → menú del entorno → **Edit → Network access**, permite `developers.facebook.com`, `graph.instagram.com` y `graph.facebook.com`.

## 1. Requisitos de tu cuenta de Instagram

1. La cuenta `@ayala.fit_` debe ser **profesional** (Empresa o Creador). Las cuentas personales no tienen acceso a la API.
   - Instagram → Perfil → ☰ → *Configuración* → *Tipo de cuenta y herramientas* → *Cambiar a cuenta profesional*.
2. Algunas métricas no están disponibles con menos de 100 seguidores (no es tu caso).
3. Con el método recomendado ("Instagram API with Instagram Login") **no necesitas página de Facebook**.

## 2. Crear cuenta de desarrollador de Meta

1. Entra en <https://developers.facebook.com> con tu cuenta de Facebook.
2. Pulsa **Empezar / Get Started** y completa el registro (verificar email/teléfono).

## 3. Crear la app

1. **Mis apps → Crear app**.
2. Caso de uso: el relacionado con **Instagram** (gestionar mensajes y contenido / Instagram API).
3. Tipo: **Business**. Nombre: `Ayala OS`. Email de contacto: el tuyo.
4. Dentro de la app, en el producto **Instagram → API setup with Instagram login**.

## 4. Configurar el login

1. En *Business login settings* añade la **OAuth redirect URI**:
   - Local: `http://localhost:3000/api/instagram/callback`
   - Producción: `https://TU-DOMINIO.vercel.app/api/instagram/callback`
2. Permisos a solicitar (a confirmar en la docs):
   - `instagram_business_basic` — perfil y publicaciones.
   - `instagram_business_manage_insights` — métricas (insights).
3. Copia **Instagram App ID** e **Instagram App Secret** (en *App settings → Basic* o en la sección de Instagram). El secret es como una contraseña: **no lo compartas en chats ni capturas**.

## 5. Añadir tu cuenta como tester

Mientras la app esté en modo desarrollo solo funciona con cuentas añadidas:
*App roles → Roles → Instagram testers* → añade `ayala.fit_` → acepta la invitación desde Instagram (*Configuración → Apps y sitios web → Invitaciones de tester*).
Como es una app privada para tu propia cuenta, **no necesitas pasar la revisión de Meta (App Review)** mientras siga en modo desarrollo (a confirmar).

## 6. Poner las claves en la app

En `.env.local` (ver SETUP.md):
```
META_APP_ID=...
META_APP_SECRET=...
META_GRAPH_API_VERSION=v24.0   # usa la versión que muestre el panel de Meta
APP_ENCRYPTION_KEY=...         # openssl rand -base64 48
```

## 7. Conectar (cuando la Fase 2 esté implementada)

Settings → **Conectar Instagram** → login oficial de Instagram → aceptar permisos → vuelta a Ayala OS → primera sincronización.

## Qué datos NO se podrán obtener automáticamente (esperado, a confirmar)

| Dato | Motivo |
|---|---|
| Historial de métricas de cuenta de hace > ~90 días | La API solo ofrece una ventana limitada → Ayala OS guarda el histórico desde el día de la conexión. |
| Impressions de posts recientes | Métrica retirada; se usa `views`. |
| Métricas de stories caducadas | Solo durante ~24 h → requiere sync frecuente. |
| Datos de audio/tendencias, contenido de otras cuentas | No disponibles en la API de insights propia. |
| Quién guardó/compartió | La API da totales, no personas. |
| DMs → clientes | Requiere permisos de mensajería y un módulo propio (Fase 4). |
| Thumbnails permanentes | Las URLs caducan → se cachearán en Supabase Storage. |
| Hook, tema, CTA, formato | No existen en la API → clasificación manual o con Claude. |
