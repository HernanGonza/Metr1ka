# Plan — Tiempo promedio por encuesta + Mensajes a pantalla completa + OTA

Este archivo documenta el diseño acordado el 5/sep/2026 para tres funciones
nuevas de la app móvil (tiempo por encuesta, mensajes a pantalla completa y
OTA), pensado para implementarlas más adelante (no se tocó
nada de código ni de la base de datos todavía — se decidió esperar a que
termine el operativo en curso antes de aplicar cualquier cambio, aunque las
migraciones descriptas son aditivas y no deberían romper el comportamiento
actual). Sirve como punto de partida para retomar el trabajo sin tener que
re-investigar el código desde cero.

Repos involucrados: `Metr1ka` (panel web) y `metr1ka-app` (app Expo/React
Native). Un solo proyecto Supabase (`zjphrjcpkzlmdpqhjypq`).

Decisiones ya acordadas:
- El objetivo de tiempo se configura **por encuesta**, no por encuestador.
- Los mensajes a pantalla completa funcionan **con la app abierta** (Realtime
  de Supabase, mismo patrón que ya usa el resto de la app) + revisión de
  pendientes al iniciar sesión. Sin push nativo/EAS por ahora.
- Pueden enviar mensajes **admin/gestor** (a toda la organización, un equipo,
  o un encuestador puntual) y **coordinador** (solo a encuestadores de sus
  propios equipos).

---

## 1. Tiempo promedio de encuesta

### Hallazgo importante
La tabla `sesiones_respuesta` ya tiene columnas `iniciada_en` /
`completada_en`, pero la función `guardar_encuesta_completa()`
(`backups/metr1ka-20260902-211401.schema.sql:2340`) hoy inserta **las dos con
`now()`** en el momento del envío. O sea que la duración real de una encuesta
nunca se capturó hasta ahora — hay que capturar el inicio real del lado del
cliente (cuando el encuestador empieza a responder) y mandarlo al backend.

### Migraciones SQL (`Metr1ka/supabase/migrations/`, con su `_rollback.sql` par)
1. `encuestas.tiempo_objetivo_minutos integer null` — nueva columna. `null` =
   sin objetivo configurado → no se muestra alerta.
2. `guardar_encuesta_completa`: agregar parámetro
   `p_iniciada_en timestamptz default null`; usar
   `COALESCE(p_iniciada_en, now())` para `iniciada_en` (si el cliente no lo
   manda, se comporta igual que hoy — compatible con la versión de la app ya
   instalada en los celulares).
3. `get_resultados_encuesta_filtrado`: sumar al jsonb de salida
   `promedio_segundos` y `tiempo_objetivo_minutos`. Esta función ya se llama
   en vivo desde `EncuestaDetalle.jsx` vía una suscripción Realtime a
   `INSERT` en `sesiones_respuesta`, así que el dato queda en vivo gratis.
4. `get_stats_encuestadores_por_encuesta`: sumar `promedio_segundos` por
   encuestador.
5. Nueva función `get_stats_tiempos_encuestadores(p_organizacion_id uuid)`:
   promedio general (todas las encuestas) por encuestador, para
   `Encuestadores.jsx`.

### App móvil (`metr1ka-app`)
- `app/(encuestador)/encuesta/[id].tsx`: agregar `inicioRef = useRef<number|null>(null)`
  y setearlo con `Date.now()` cuando `pantalla` deja `"mapa"` y arranca el
  flujo de preguntas (confirmar el callback exacto — `onComenzar` o
  equivalente — al implementar). Mandar
  `p_iniciada_en: new Date(inicioRef.current).toISOString()` en la llamada a
  `guardar_encuesta_completa` dentro de `guardarYFinalizar` (~líneas
  1314-1399).
- `lib/offlineQueue.ts`: agregar `iniciada_en` a `ItemCola` y enhebrarlo en
  `encolarRespuesta` / `sincronizarItem`.
- Extender el `select` de la encuesta cargada para incluir
  `tiempo_objetivo_minutos`.
- En la pantalla `"fin"`: si hay objetivo configurado, comparar la duración
  real contra el objetivo y mostrar un banner — verde "🟢 Venís bien de
  tiempo" o rojo "🔴 Te está tomando más tiempo del esperado".

### Panel web (`Metr1ka`)
- `src/pages/admin/MuestreoConfig.jsx`: input "Tiempo objetivo (minutos)"
  junto a fecha inicio/fin, en el mismo `update` a `encuestas` (~línea 2029).
- `src/pages/admin/EncuestaDetalle.jsx`: tarjeta KPI con el promedio en vivo
  vs. el objetivo (mismo verde/rojo que en la app).
- `src/pages/admin/Encuestadores.jsx`: promedio general por encuestador,
  usando `get_stats_tiempos_encuestadores`.
- Repetir en las vistas equivalentes de coordinador
  (`src/pages/coordinador/encuesta-detalle.tsx` y su listado de equipo) —
  mismas RPCs, ya scoped por rol vía `security definer` + `mi_rol()`.

---

## 2. Mensajes a pantalla completa

### Migraciones SQL
1. Tabla `mensajes` (`id`, `organizacion_id`, `remitente_id`, `titulo`,
   `texto`, `creado_en default now()`).
2. Tabla `mensajes_destinatarios` (`id`, `mensaje_id`, `encuestador_id`,
   `leido_en`) — una fila por destinatario, creada al momento del envío (un
   cambio de equipo después no afecta la entrega ya hecha).
3. RLS: el encuestador puede `select`/`update leido_en` solo sobre sus
   propias filas de `mensajes_destinatarios`. Nadie inserta directo — todo
   pasa por la RPC de envío.
4. RPC `enviar_mensaje_encuestadores(p_titulo text, p_texto text, p_alcance text, p_equipo_id uuid default null, p_encuestador_id uuid default null)`,
   `security definer`, usando `mi_rol()`:
   - `admin`/`gestor`: alcance `'org'`, `'equipo'` o `'individual'`.
   - `coordinador`: solo `'equipo'` (sus equipos vía `equipo_coordinadores`)
     o `'individual'` (encuestador dentro de sus equipos).
   - Resuelve destinatarios en el momento e inserta `mensajes` + fan-out en
     `mensajes_destinatarios`.
5. RPC `marcar_mensaje_leido(p_destinatario_id uuid)`.

### App móvil
- `lib/mensajes.ts` (nuevo): `fetchMensajesPendientes()` (query inicial al
  loguear/reanudar) + `useMensajesRealtime(encuestadorId, onNuevo)` — mismo
  patrón que `useRealtimeSesiones` en `lib/realtime.ts`, con
  `postgres_changes` `INSERT` sobre `mensajes_destinatarios` filtrado por
  `encuestador_id=eq.<uid>`.
- `components/UI/MensajeOverlay.tsx` (nuevo): `View` absoluto a pantalla
  completa, por encima del `<Stack>`, título/texto + botón "Entendido".
  Encola si llega más de un mensaje pendiente.
- Montado en `app/_layout.tsx` como hermano del `<Stack>` (no como ruta) —
  cubre cualquier pantalla, incluso a mitad de una encuesta, sin navegar ni
  perder respuestas ya cargadas (a diferencia del patrón actual de
  `perfil.activo`, que sí redirige a `/desactivado`).
- Al cerrar el mensaje, llamar a `marcar_mensaje_leido`.

### Panel web
- Nuevo componente `src/components/MensajeModal.jsx`: título, texto, y
  selector de alcance (Toda la organización / Un equipo / Un encuestador) —
  admin ve las tres opciones, coordinador solo equipo/individual restringido
  a los suyos.
- Se engancha desde `src/pages/admin/Encuestadores.jsx` (acción "📢 Mensaje"
  en el Topbar + botón por fila para un encuestador puntual) y desde la
  vista equivalente de coordinador (confirmar archivo exacto al
  implementar).

---

## 3. OTA — actualizaciones sin recompilar

### Objetivo
Poder publicar cambios de JS/assets de `metr1ka-app` (fixes, ajustes de UI,
lo de tiempo/mensajes de este mismo plan, etc.) sin tener que generar un APK
nuevo y hacer que cada encuestador lo reinstale. Se usa **EAS Update**
(`expo-updates`), el mecanismo oficial de Expo.

### Estado actual (relevado 5/sep/2026)
- `metr1ka-app` es 100% managed workflow (sin carpetas `android/`/`ios/`).
- `expo-updates` **no está instalado** — hoy no hay ningún mecanismo de OTA.
- Ya existe `extra.eas.projectId` en `app.json` (`63f7f8cd-...`) y tres
  profiles en `eas.json` (`development`, `preview`, `production`), sin
  `channel` asignado a ninguno.
- Expo SDK 54, `expo-updates: ~6.0.21` (rango a validar con `expo install`).

### Qué cambia
1. **Dependencia**: agregar `expo-updates` vía `npx expo install expo-updates`
   (asegura la versión compatible con el SDK instalado).
2. **`app.json`**:
   - `runtimeVersion: { policy: "fingerprint" }` — el runtime se recalcula
     solo en base al código nativo real; evita tener que bumpear a mano cada
     vez que se agrega/saca un plugin nativo.
   - `updates.url: "https://u.expo.dev/<projectId>"`.
   - `updates.fallbackToCacheTimeout: 0` (no bloquear el arranque esperando
     red; usa el bundle cacheado y aplica el update recién en el próximo
     arranque en frío).
3. **`eas.json`**: un `channel` por profile (`production` → canal
   `production`, `preview` → canal `preview`). El profile `development`
   (dev client) no usa canal — `expo-updates` no corre en dev client.
4. **App móvil**: chequeo de update al arrancar (antes o junto al splash de
   `app/_layout.tsx`), guardado detrás de `!__DEV__` /
   `Updates.isEnabled`. Si hay update: `fetchUpdateAsync()` +
   `reloadAsync()` **solo en el arranque en frío**, nunca a mitad de una
   encuesta en curso (mismo cuidado que con los mensajes a pantalla
   completa — no interrumpir una respuesta ya empezada). El
   `checkAutomatically: "ON_LOAD"` (default) queda como red de respaldo para
   cuando la app vuelve de background.

### Flujo de publicación (una vez configurado)
- Cambios de JS/assets sin tocar nativo → `eas update --channel production`
  (o `preview` para probar antes). Llega a los dispositivos en el próximo
  arranque en frío, sin pasar por store/APK.
- Cambios nativos (nuevo permiso, nuevo plugin, bump de SDK de Expo) siguen
  necesitando `eas build` + reinstalación del APK — OTA no los cubre.

### Verificación al implementar
- Confirmar versión de `expo-updates` compatible con SDK 54 vía
  `npx expo install expo-updates` (no fijar versión a mano).
- Probar el ciclo completo en `preview` antes de tocar `production`: build
  preview → `eas update --branch preview` → confirmar que un dispositivo con
  ese build levanta el cambio sin reinstalar.
- `npx tsc --noEmit` después de agregar el chequeo de update en
  `app/_layout.tsx`.

---

## Verificación al implementar
- **Mobile**: `npx tsc --noEmit` en `metr1ka-app` + lectura de diffs. No se
  compila/corre la app hasta que se decida explícitamente.
- **Web**: `npm run dev` en `Metr1ka`, probar a mano: guardar el campo nuevo
  en `MuestreoConfig`, ver el KPI en vivo en `EncuestaDetalle`, ver el
  promedio general en `Encuestadores`, enviar un mensaje de prueba y
  confirmar en la base el fan-out correcto.
- **DB**: pedir confirmación explícita antes de aplicar migraciones al
  proyecto Supabase (parece ser el único proyecto, producción). Respetar el
  patrón migración + rollback ya usado en `supabase/migrations/`, y
  considerar correr `scripts/backup-db.sh` antes si se aplica en un momento
  con datos reales cargados.
