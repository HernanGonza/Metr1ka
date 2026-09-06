# Plan — Tiempo promedio por encuesta + Mensajes a pantalla completa + OTA + Contador offline

Este archivo documenta el diseño acordado el 5/sep/2026 para cuatro
funciones nuevas de la app móvil (tiempo por encuesta, mensajes a pantalla
completa, OTA y contador de cuota sin conexión) más dos bugs de fondo
encontrados al revisar la cola offline, pensado para implementarlas más
adelante (no se tocó
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

### Nota 5/sep/2026
Se preguntó si esto se podía hacer ahora, acotado solo al panel web (sin
tocar `metr1ka-app`), usando una aproximación por tiempo entre encuestas
consecutivas en vez del `iniciada_en` real. Se descartó: el diseño se
mantiene como estaba — captura real del inicio desde la app — y no se
implementa nada todavía, se espera a que termine el operativo en curso como
el resto del plan.

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

### Estado: implementado (5/sep/2026), pendiente probar ciclo `eas update`
Código ya en `metr1ka-app`: `expo-updates@~29.0.17` instalado, `app.json`
(`runtimeVersion.policy: fingerprint` + `updates.url` + `fallbackToCacheTimeout: 0`),
`eas.json` (`channel` en `preview`/`production`) y el chequeo de update en
`app/_layout.tsx` (cold-start only, gateado por `__DEV__`/`Updates.isEnabled`).
`npx tsc --noEmit` sin errores nuevos. Falta: correr `eas update --branch preview`
(requiere `eas` CLI + login del usuario, no disponible en este entorno) y
confirmar que un build `preview` levanta el cambio sin reinstalar, antes de
usar el canal `production`. Sin commitear todavía.

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

## 4. Contador de cuota sin conexión (encuestas callejeras)

### Problema (relevado 5/sep/2026, `metr1ka-app`)
En `app/(encuestador)/encuesta/[id].tsx` el contador de cuota que ven en el
mapa ("X de Y encuestas", líneas ~121-160 y ~278-289) sale de `estadoCalle`,
que se carga con la RPC `get_estado_encuesta_callejera` (server truth,
`cargarEstadoCallejera` ~línea 1163). Cuando el encuestador está sin
conexión, esa encuesta se guarda en la cola local
(`lib/offlineQueue.ts` → `encolarRespuesta`) en vez de mandarse directo, y la
RPC no tiene forma de enterarse — el contador de cuota queda congelado en el
mismo número aunque sigan completando encuestas. El único aviso que existe
hoy es un banner amarillo ("N encuestas guardadas sin conexión") en la
pantalla "fin" (línea ~1656), que se ve una vez por encuesta y no está
presente en el mapa, que es donde miran la cuota mientras siguen trabajando.
Resultado: creen que la app no está contando su trabajo y se preocupan.

### Fix propuesto
1. `lib/offlineQueue.ts`: extender `cantidadPendiente()` (línea 101) para
   poder filtrar por `asignacion_id` (ya está en `ItemCola`), ej.
   `cantidadPendiente(asignacionId?: string)`.
2. En `cargarEstadoCallejera`/donde se arma `estadoCalle`: sumar al
   `completadas` (y restar de `restantes`) la cantidad de items de la cola
   offline que correspondan a esa `asignacion_id`, para que el contador de
   cuota avance en el momento aunque no haya conexión — no depende de que la
   RPC se entere.
3. Mover el banner "N sin conexión, se van a sincronizar" (hoy solo en la
   pantalla "fin") también al mapa/header de la encuesta, para que quede
   visible todo el tiempo que dure la cola sin sincronizar, no solo una vez.
4. Mismo criterio aplicaría a los contadores de "completadas" que se
   muestren en encuestas no-callejeras si existiera un caso análogo — a
   confirmar si aplica al implementar.

### Verificación al implementar
- Probar con el celular en modo avión: completar varias encuestas seguidas
  de la misma asignación y confirmar que el contador de cuota avanza en el
  momento, y que el banner de "pendientes sin conexión" queda visible en el
  mapa. Confirmar que al recuperar conexión y sincronizar, el número no
  queda duplicado (offline + server ya sincronizado).
- `npx tsc --noEmit`.

---

## 5. Cola offline — bugs encontrados en la revisión (5/sep/2026)

Revisando `lib/offlineQueue.ts` y `guardarYFinalizar` en
`app/(encuestador)/encuesta/[id].tsx` para el punto 4, aparecieron dos bugs
de fondo que conviene arreglar junto con el contador (no son solo un tema de
UI — pueden perder o duplicar encuestas). No se tocó código, queda para
implementar junto con el resto del plan.

### Bug A — posible pérdida de encuestas encoladas (race condition)
`leerCola()`/`guardarCola()` en `lib/offlineQueue.ts` (líneas 21-30) hacen un
read-modify-write sobre `AsyncStorage` sin ningún lock. El riesgo **no** es
que dos encuestas se guarden en el mismo instante (entre una y otra siempre
pasa un rato) — el riesgo es que `sincronizarCola` quede corriendo por más
tiempo del que parece: recorre la cola **uno por uno esperando cada
request**, y con señal intermitente (no offline total, sino 2G que
prende/apaga en el campo) cada llamada puede tardar varios segundos en
fallar por timeout en vez de fallar al toque. Si además hay backlog (varias
encuestas juntadas durante un tramo sin señal), ese loop puede tardar
decenas de segundos o más. Mientras dura, si el encuestador termina otra
encuesta y esta se encola, puede pasar esto:
1. `sincronizarCola` lee la cola (ej. 5 items) y arranca a mandarlos uno por
   uno — tarda, porque cada request individual demora por señal mala.
2. Mientras el loop sigue corriendo, el encuestador termina otra encuesta
   sin conexión (buena) todavía; `encolarRespuesta` lee la cola (todavía 5
   items, porque sync no terminó de escribir) y guarda 6.
3. `sincronizarCola` termina y hace `guardarCola(restantes)` basado en los 5
   originales — **pisa** el archivo de 6 items con uno que nunca incluyó el
   6to, y esa encuesta se pierde para siempre (no está en el servidor ni en
   la cola local).

Es un escenario de campo creíble (backlog + señal intermitente que hace que
el sync tarde), pero no es algo que vaya a pasar en cualquier par de
encuestas seguidas — depende de que la sincronización esté efectivamente
en curso en ese momento. Vale la pena arreglarlo igual porque cuando pasa
es silencioso (no hay ningún error visible, la encuesta simplemente
desaparece), pero no es la explicación más probable de "no me cuenta" del
día a día — para eso el sospechoso principal es el punto 4 (el contador de
cuota no refleja la cola) y, en menor medida, el Bug B de abajo.

**Fix propuesto**: serializar todas las lecturas/escrituras de la cola con
un mutex simple en memoria (encadenar cada operación a una promesa
`colaLock`), para que `encolarRespuesta` y `sincronizarCola` nunca se
pisen.

### Bug B — posible duplicado si falla `registrar_visita`
Tanto en `guardarYFinalizar` (líneas ~1345-1368, "intentar enviar directo")
como en `sincronizarItem` (`lib/offlineQueue.ts` líneas 41-66), la llamada a
`guardar_encuesta_completa` y la llamada a `registrar_visita` están dentro
del mismo `try`. Si `guardar_encuesta_completa` **ya insertó** la sesión de
respuestas pero `registrar_visita` tira una excepción después (típico en
campo: la conexión se corta justo entre una llamada y la otra), el `catch`
atrapa todo y trata la operación completa como fallida → el item se
encola/reintenta → en el próximo sync se vuelve a llamar
`guardar_encuesta_completa` **con los mismos datos**, insertando una
segunda fila en `sesiones_respuesta` para la misma encuesta. Se confirmó
que `guardar_encuesta_completa` (`backups/metr1ka-20260902-211401.schema.sql:2320`)
no tiene ninguna protección de idempotencia — cada llamada inserta sí o sí,
no hay forma de detectar "esto ya se guardó".

**Fix propuesto** (evaluar ambas, no son excluyentes):
1. Separar responsabilidades: si `guardar_encuesta_completa` devuelve
   `sesionId` con éxito, considerar la encuesta "enviada" aunque
   `registrar_visita` falle después — reintentar solo `registrar_visita`
   (o resolverlo de forma best-effort), nunca volver a llamar
   `guardar_encuesta_completa` para esa respuesta.
2. Agregar idempotencia real: mandar el `id` local del item de la cola como
   parámetro nuevo (`p_idempotency_key`) a `guardar_encuesta_completa`, con
   un `unique` constraint o un `select` previo en `sesiones_respuesta` que
   la use — si ya existe una sesión con esa key, devolver el `sesionId`
   existente en vez de insertar de nuevo. Esto además resuelve el Bug A de
   raíz (un reintento accidental por la race condition ya no duplicaría
   nada del lado del servidor).

También notar (menor): `registrar_visita` no chequea `{ error }` — si
Postgrest devuelve un error (no una excepción), se ignora en silencio y el
item se marca como "enviado" igual, dejando la parcela sin visita
registrada pero la respuesta sí guardada. Revisar si vale la pena
propagarlo o dejarlo best-effort a propósito.

### Verificación al implementar
- Simular el Bug A: forzar conexión intermitente (o mockear el timing) y
  confirmar que ninguna encuesta desaparece de la cola.
- Simular el Bug B: cortar la conexión artificialmente entre el `await` de
  `guardar_encuesta_completa` y el de `registrar_visita` (breakpoint /
  throw forzado) y confirmar que no se genera una fila duplicada en
  `sesiones_respuesta` tras la sincronización.
- Revisar en la base si ya existen encuestadores con sesiones duplicadas
  (mismo `asignacion_id` + respuestas idénticas + `completada_en` muy
  cercano) para dimensionar el impacto real hasta ahora.

---

## 6. Cuota individual por encuestador

### Problema (relevado 5/sep/2026)
Hoy la cuota de encuestas callejeras es un solo número para toda la
encuesta: `encuestas.config_muestreo.cuota_por_encuestador`, configurado en
`ZonasYMuestreoModal` (`src/pages/admin/MuestreoConfig.jsx:2716-2735`) y
leído por la RPC `get_estado_encuesta_callejera`
(`backups/metr1ka-20260902-211401.schema.sql:1357-1358`), que hace
`v_cuota := COALESCE((v_config->>'cuota_por_encuestador')::int, ..., 50)`.
Es el mismo valor para todos los encuestadores de la encuesta — no hay
forma de subírsela (o bajársela) a uno en particular sin tocar la cuota
general de todos.

### Diseño propuesto
1. Nueva tabla `cuotas_individuales (encuesta_id uuid, encuestador_id uuid,
   cuota integer not null, primary key (encuesta_id, encuestador_id))`. Se
   guarda por `encuesta_id` + `encuestador_id` (no por `asignacion_id`)
   porque un mismo encuestador puede tener varias filas en
   `asignaciones_encuesta` (una por zona) dentro de la misma encuesta, y la
   cuota es a nivel encuesta, no a nivel zona — mismo criterio que ya usa
   `get_estado_encuesta_callejera` al sumar `v_todas_asignaciones`.
2. `get_estado_encuesta_callejera`: antes de calcular `v_cuota`, buscar si
   existe fila en `cuotas_individuales` para
   `(v_encuesta_id, encuestador_id de la asignación)`; si existe, usar ese
   valor; si no, caer al `config_muestreo` general como hoy (`COALESCE`).
3. RPC `set_cuota_individual(p_encuesta_id uuid, p_encuestador_id uuid, p_cuota integer)`
   (`security definer`, admin/gestor siempre; coordinador solo si el
   encuestador pertenece a uno de sus equipos vía `equipo_coordinadores`) —
   hace `upsert` en `cuotas_individuales`. `p_cuota null` o una RPC
   separada `quitar_cuota_individual` para volver a la cuota general.
4. **App móvil**: no requiere ningún cambio — `estadoCalle.cuota` ya viene
   de esta RPC, así que el override se ve automático en el mapa/pantalla
   "fin" apenas se guarda desde el panel.

### Panel web
- En `ZonasYMuestreoModal` (`MuestreoConfig.jsx`), dentro de `abrirEquipo`
  (~línea 1669, donde ya se cargan los miembros del equipo), agregar junto
  a cada encuestador un campo opcional "Cuota individual" — vacío = usa la
  general, con un valor = la pisa. Mismo lugar donde hoy se ve/edita la
  cuota general del equipo.
- Alternativa/complemento: mismo control desde `Encuestadores.jsx`, para
  poder ajustarlo sin entrar a la configuración de la encuesta.

### Verificación al implementar
- Configurar cuota general en 50, poner un override de 80 a un
  encuestador puntual, y confirmar en la app (o vía la RPC directo) que a
  esa persona el mapa le muestra 80 y al resto sigue en 50.
- Quitar el override y confirmar que vuelve a la cuota general.
- `npm run dev` + `npx tsc --noEmit` (aunque no haya cambios de app, para
  no romper nada del tipado si se toca algún tipo compartido).

---

## 7. Actualización automática de pantallas (sin pull-to-refresh ni cerrar la app)

### Problema (relevado 5/sep/2026)
No es un tema de caché — la app no usa ninguna librería de cache de datos
(React Query, SWR, etc.) que haya que "vaciar". El problema es más simple:
varias pantallas piden los datos una sola vez al montarse y no vuelven a
pedirlos solas, así que la única forma de ver un cambio hecho desde el
panel web (una encuesta nueva asignada, un cambio de equipo, etc.) es
tirar de la pantalla hacia abajo (pull-to-refresh manual) o cerrar y
volver a abrir la app (lo que remonta el componente y sí dispara la carga
inicial). Confirmado en:
- `app/(encuestador)/home.tsx:149` — `useEffect` que carga
  `get_encuestas_encuestador` solo cuando cambia `perfil?.id`; el
  `RefreshControl` de la lista (línea ~266) es manual, no automático.
- `app/(coordinador)/encuestas.tsx:49` — mismo patrón: `useEffect` una
  sola vez + `RefreshControl` manual (línea ~141).

El panel web ya resuelve este mismo problema en las pantallas de admin
combinando dos mecanismos (`src/pages/admin/EncuestaDetalle.jsx`):
una suscripción Realtime (`postgres_changes`) para reaccionar al
instante, más un polling de respaldo cada 20s por si el socket se cae.

### Propuesta
Aplicar el mismo patrón combinado a las pantallas del encuestador y del
coordinador:
1. **Refetch al volver a primer plano**: usar `AppState` (ya se usa en
   `lib/offlineQueue.ts:120` para relanzar la sincronización) para volver
   a pedir los datos cuando la app pasa a `active` después de haber
   estado en background — cubre "minimizié y volví" además de "cerré y
   reabrí".
2. **Polling liviano de respaldo** (por ejemplo cada 60s) mientras la
   pantalla está montada, igual que el panel, para el caso de que el
   encuestador deje la pantalla abierta mucho tiempo sin hacer nada.
3. Donde tenga sentido, sumar una suscripción Realtime a los cambios
   relevantes (`encuestas_equipo`, `asignaciones_encuesta`, `encuestas`)
   filtrada por encuestador/equipo, para que una encuesta nueva asignada
   aparezca sin esperar al polling ni a volver a primer plano.

### Alcance
- `app/(encuestador)/home.tsx` — lista de encuestas del encuestador.
- `app/(coordinador)/encuestas.tsx` — lista de encuestas del equipo.
- La pantalla de cuota (`estadoCalle` en `encuesta/[id].tsx`) ya tiene su
  propio arreglo específico documentado en la sección 4; no se duplica
  acá.

Es JS puro (hooks + listeners), sin cambios nativos — se puede publicar
por OTA (sección 3) una vez implementado, sin recompilar.

### Verificación al implementar
- Con la app abierta en la lista de encuestas del encuestador, asignarle
  una encuesta nueva desde el panel sin tocar nada en el teléfono, y
  confirmar que aparece sola dentro del intervalo definido.
- Repetir minimizando la app y volviendo a abrirla (no cerrarla del
  todo) y confirmar que también se actualiza.
- Repetir lo mismo en la pantalla de encuestas del coordinador.

---

## 8. Módulo de reportes descargables (PDF) por encuesta

### Pedido (5/sep/2026)
Reportes en PDF, uno por click, con datos en tiempo real de Supabase,
integrados al panel — para que el coordinador los baje solo, durante o
después del operativo, sin intervención técnica. Es una ampliación de
los reportes que ya existen en el panel, no un reemplazo: los actuales
también hay que mejorarlos en paralelo.

**Importante:** los cruces (candidato x zona, candidato x edad x género,
perfil demográfico, etc.) tienen que salir armados solos — el usuario no
arma la tabla a mano. Esto es distinto de cómo funciona hoy
`GraficoCruce` en `Reportes.jsx` (líneas ~360-532), donde el admin elige
manualmente qué dos preguntas cruzar. Acá el admin solo elige, de la
lista de los 10 reportes ya definidos (y qué columnas/preguntas incluir
dentro de cada uno), cuáles quiere ver o descargar — el cálculo del
cruce en sí (agrupar, sumar, ordenar, calcular porcentaje) lo hace el
reporte automáticamente, sin que el usuario arme nada.

### Estado actual (relevado 5/sep/2026)
- Hoy los reportes "en producción" (los que se le entregan al cliente)
  salen de scripts Node locales con la librería `docx`, corridos a mano,
  fuera del repo/panel.
- Dentro del panel ya existe un generador de PDF en
  `src/pages/admin/Reportes.jsx`: `generarHTML` (líneas ~699-1010) arma
  un HTML con el estilo de Metr1ka del lado del cliente, y `generarPDF`
  (líneas ~1449-1507) lo manda a `window.print()` — es un PDF vía el
  diálogo de impresión del navegador, no un render server-side con
  Puppeteer. Ya cubre resumen/KPIs, gráfico por pregunta (`MiniChart`),
  matrices, cruces (`GraficoCruce`), datos crudos y mapa.
- También existe `TextoLibreClasificado` (líneas ~162-293) con la tabla
  `clasificaciones_texto_libre` (`categoria`, `cantidad`, `orden`) — hoy
  es un clasificador 100% manual: el admin agrupa a mano las respuestas
  de texto libre en categorías con una cantidad agregada, sin ningún
  matching automático.

### Piezas que faltan en el modelo de datos
- No hay forma estándar de identificar preguntas "especiales" (candidato
  a intendente, edad, género, nivel educativo, situación laboral) más
  que por su `texto` literal — `preguntas.clave_base` hoy solo tiene el
  valor `'participa'` en uso real (definido en
  `backups/metr1ka-20260902-211401.schema.sql:3344`, usado en
  `get_encuesta_full` y otras RPCs). Para que los reportes de cruce
  demográfico y de candidato funcionen encuesta tras encuesta sin curar
  a mano cada vez, conviene sumar nuevos valores de `clave_base` (p. ej.
  `candidato_intendente`, `edad`, `genero`, `nivel_educativo`,
  `situacion_laboral`) que se asignen al armar las preguntas de la
  encuesta.
- `opciones_pregunta.orden` ya existe
  (`schema.sql:3241-3246`) — el reporte por pregunta puede usarlo
  directo para respetar el orden de las opciones, tal como pide el
  prompt.
- El matching fuzzy del "Otro" contra candidatos puede apoyarse en la
  tabla `clasificaciones_texto_libre` que ya existe, en vez de construir
  un clasificador nuevo desde cero: para la pregunta de candidato se
  pre-cargan las categorías con los nombres de los candidatos (+ alias
  conocidos), y un matching automático (normalizado a minúsculas +
  distancia de edición tipo Levenshtein) sugiere la categoría para cada
  respuesta de texto libre nueva — el admin la confirma o corrige igual
  que hoy, no se pierde la revisión humana, solo se le ahorra el tipeo.

### Los 10 reportes pedidos
1. Por zona — nombre + completadas, orden desc, total al pie.
2. Por encuestador — nombre + completadas (sin no-respuesta), orden
   desc, total al pie.
3. Comparativo de candidatos por zona — tabla por zona con cada
   candidato y sus votos, "Otro" fusionado por matching fuzzy (ver
   arriba), orden desc dentro de cada zona.
4. Completo por pregunta y zona — una sección por pregunta (excepto
   `participa`), tabla por zona con cada opción, cantidad y porcentaje,
   respetando `opciones_pregunta.orden`, "Otro" excluido como opción
   propia y fusionado cuando aplica, orden desc.
5. No-respuesta por zona — tasa de rechazo (no-respuesta / total
   sesiones) por zona.
6. Actividad por encuestador — completadas + no-respuesta + tasa de
   rechazo, para evaluación de campo.
7. Evolución horaria — completadas acumuladas por hora del día, zona
   horaria de Argentina (UTC-3).
8. Distribución geográfica — sesiones por zona con completadas,
   no-respuesta y lat/lng promedio, para cruzar con el KMZ.
9. Perfil demográfico — cruce edad / nivel educativo / situación
   laboral / género, absolutos y porcentajes por zona.
10. Intención de voto cruzada con perfil — candidato x edad x género
    (ej. hombres de 30-45 que votarían a un candidato puntual).

### Implementación técnica propuesta
- **Backend** (corregido 5/sep/2026 — el proyecto NO usa Render, solo
  Supabase + el panel desplegado en Vercel): generar los PDFs con
  Puppeteer (HTML/CSS → PDF), no con `window.print()`, pero corriéndolo
  como **Vercel Serverless Function** dentro del mismo proyecto del
  panel — no hace falta un hosting nuevo. Se agrega una carpeta `/api`
  en la raíz (hoy no existe; `vercel.json` solo tiene rewrites/headers
  para el SPA, Vercel detecta `/api` igual aunque el resto sea un Vite
  SPA) con un endpoint tipo `/api/reportes/[tipo].js` que recibe
  `encuesta_id`, pide los datos a Supabase, arma el HTML reusando el
  estilo de `generarHTML` existente, y lo renderiza a PDF con
  `puppeteer-core` + `@sparticuz/chromium` (el combo estándar para correr
  Chromium headless dentro del límite de tamaño de una función
  serverless tipo Lambda).
- A tener en cuenta al implementar: límite de tiempo de ejecución de
  Vercel (10s en Hobby, hasta 60s en Pro — revisar qué plan se usa,
  puede quedar corto para reportes con muchas zonas/preguntas) y cold
  start de Chromium en el primer request.
- CSP de `vercel.json` no necesita cambios: `connect-src` ya incluye
  `'self'`, y el endpoint `/api/...` es mismo origen.
- **Frontend**: en `EncuestaDetalle.jsx` (o una pestaña "Reportes" ahí
  mismo), un botón "Descargar PDF" por cada uno de los 10 reportes ya
  definidos (con checkboxes opcionales para incluir/sacar preguntas o
  columnas puntuales dentro de ese reporte), que llama al backend con
  `encuesta_id` + la selección y dispara la descarga. El admin nunca
  arma el cruce a mano — solo elige qué mostrar.
- Cada PDF: fecha/hora de generación en el encabezado, logo/branding
  Metr1ka (verde `#52B788`), filas alternadas, totales al pie,
  porcentajes donde aplique.
- **Reportes existentes en `Reportes.jsx`**: mejorarlos en paralelo
  (pedido explícito, no queda afuera) — evaluar si conviene migrarlos al
  mismo pipeline de Puppeteer para tener un solo mecanismo de PDF en vez
  de dos (`window.print()` para lo viejo, Puppeteer para lo nuevo).

### Verificación al implementar
- Con una encuesta de prueba con varias zonas, candidatos con variantes
  de escritura en "Otro" (mayúsculas, apodos, errores de tipeo), y
  respuestas demográficas cargadas, generar los 10 reportes y confirmar:
  orden desc correcto, totales al pie, matching fuzzy del candidato,
  zona horaria de la evolución horaria, orden de opciones según
  `opciones_pregunta.orden`.
- Confirmar que los reportes existentes en el panel siguen funcionando
  igual mientras se decide si migran al mismo pipeline (no regresión).

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
