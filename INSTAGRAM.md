# Instagram ↔ Claude (sin web)

Claude lee tus estadísticas en directo con la API oficial de Instagram. Solo hace falta un **token de acceso** de tu propia cuenta. Nunca se usa tu contraseña.

## Conseguir el token (una vez, ~15 min)

1. `@ayala.fit_` debe ser cuenta **profesional** (Empresa o Creador).
2. <https://developers.facebook.com> → entra con tu Facebook → **My Apps → Create app** → caso de uso de **Instagram** → nombre `Ayala OS` → crear.
3. En la app: **Instagram → API setup with Instagram login**.
4. **App roles → Roles → Add people → Instagram tester** → `ayala.fit_`. Acepta la invitación en Instagram (*Configuración → Apps y sitios web → Invitaciones de tester*, o en instagram.com).
5. Vuelve a **API setup with Instagram login → Generate access tokens → Add account** → inicia sesión en Instagram y acepta los permisos → **Generate token** → cópialo.

## Guardarlo (nunca en el chat)

Entorno cloud de Claude Code (menú del entorno en la barra de título de la sesión → **Edit**) → variable de entorno:

```
IG_ACCESS_TOKEN=el_token
```

Las sesiones nuevas lo leen. El token dura **60 días**; cuando caduque, Claude te avisará y repites el paso 5.

## Uso

Pregunta en lenguaje normal ("¿cómo van mis estadísticas?", "¿qué vídeos funcionan más?"). Claude ejecuta:

```
npm run ig -- cuenta              # comprobar conexión
npm run ig -- resumen [días=30]   # totales de cuenta vs periodo anterior + mejores/peores
npm run ig -- top [días=30] [métrica=valor|views|reach|shares|saves|likes|comments|follows]
npm run ig -- posts [n=12]        # últimas publicaciones
```

"valor" = (compartidos + guardados) por cada 1.000 cuentas alcanzadas: la mejor señal de que un contenido aporta.
Límites de la API: datos de cuenta de los últimos 90 días, pueden llegar con hasta 48 h de retraso; los Reels no dan "follows".
