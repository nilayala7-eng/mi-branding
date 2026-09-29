# Conectar Instagram — guía para Nil

No hace falta saber programar. Sigue los pasos en orden. **Nunca** me des tu contraseña de Instagram: la conexión usa el login oficial de Instagram y Ayala OS solo guarda un token de acceso **cifrado**.

Verificado con la documentación oficial de Meta el 29-09-2026 (Instagram API with Instagram Login, versión v26.0).

## 1. Tu cuenta de Instagram

1. `@ayala.fit_` debe ser **profesional** (Empresa o Creador): Instagram → Perfil → ☰ → *Configuración* → *Tipo de cuenta y herramientas* → *Cambiar a cuenta profesional*.
2. **No necesitas página de Facebook.**

## 2. Cuenta de desarrollador de Meta

1. Entra en <https://developers.facebook.com> con tu Facebook → **Get started / Empezar** → completa el registro.

## 3. Crear la app

1. **My Apps → Create app**.
2. Caso de uso relacionado con **Instagram** (gestionar mensajes y contenido de Instagram).
3. Nombre: `Ayala OS`. Email: el tuyo. Crear.
4. En el panel de la app: **Instagram → API setup with Instagram login**.

## 4. Configurar el login (paso "3. Set up Instagram business login")

1. Abre **Business login settings**.
2. En **OAuth redirect URIs** añade exactamente (sin barra final; Meta a veces la añade: compruébalo):
   - Producción: `https://TU-APP.vercel.app/api/instagram/callback`
   - Local (opcional): `http://localhost:3000/api/instagram/callback`
3. Copia **Instagram App ID** e **Instagram App Secret** de esa misma pantalla. El secret es como una contraseña: no lo pegues en chats ni capturas; solo en las variables de entorno.

Permisos que pedirá Ayala OS (solo lectura): `instagram_business_basic` e `instagram_business_manage_insights`.

## 5. Añadir tu cuenta como tester

Mientras la app no pase la revisión de Meta solo funciona con cuentas que tengan un rol en ella. Para tu propia cuenta **no hace falta App Review** (basta "Standard Access"):

- En el panel: **App roles → Roles → Add people → Instagram tester** → `ayala.fit_`.
- Acepta la invitación en Instagram: *Configuración → Apps y sitios web → Invitaciones de tester* (o en instagram.com, en la web).

## 6. Variables de entorno (Vercel → Settings → Environment Variables)

```
DATA_SOURCE=supabase
DATABASE_URL=...                 # SETUP.md, paso Supabase
META_APP_ID=...                  # Instagram App ID
META_APP_SECRET=...              # Instagram App Secret
META_GRAPH_API_VERSION=v26.0
APP_URL=https://TU-APP.vercel.app
APP_ENCRYPTION_KEY=...           # openssl rand -base64 48
APP_ACCESS_PASSWORD=...
CRON_SECRET=...                  # openssl rand -hex 32
```

## 7. Conectar

1. Abre Ayala OS → **Settings** → **Conectar Instagram**.
2. Inicia sesión en Instagram (si te lo pide) y **acepta todos los permisos**.
3. Vuelves a Settings con "Instagram conectado" → pulsa **Sincronizar ahora**. La primera vez importa todas tus publicaciones y los últimos 90 días de métricas de cuenta (puede tardar unos minutos).
4. A partir de ahí se sincroniza sola cada día a las 05:00 UTC y el token se renueva automáticamente.
5. Ve a **Content** y etiqueta tus publicaciones (tema, hook, CTA, formato…). Sin etiquetas no hay análisis de patrones.

## Lo que la API NO da (limitaciones verificadas)

| Dato | Qué hace Ayala OS |
|---|---|
| Métricas de cuenta de hace > 90 días | Guarda el histórico desde el día de conexión; cuanto antes conectes, mejor. |
| Historial diario de seguidores | Guarda el número de seguidores cada día que sincroniza. |
| **Follows y visitas al perfil por Reel** | Solo existen para posts de feed; en Reels aparece "—". Se usan shares, guardados y alcance. |
| Visitas al perfil a nivel de cuenta | No existen en la API actual. |
| Duración de los vídeos | No expuesta. |
| Stories | Solo 24 h y sin webhook con este tipo de login → fuera de alcance por ahora. |
| Impressions | Retiradas por Meta; se usa `views`. |
| Datos con menos de 48 h | Pueden estar incompletos; se re-leen los últimos 7 días en cada sync. |
| Tema, hook, CTA, formato | No existen en Instagram → etiquetado manual (y con Claude en la Fase 3). |
| Quién guardó o compartió | Solo totales. |

**A confirmar con tus primeros datos reales** (compara con la app de Instagram y dímelo):
1. Que "Follows" y "Unfollows" diarios cuadren con Instagram (breakdown `follow_type`).
2. Que todos tus vídeos aparezcan como Reels.
