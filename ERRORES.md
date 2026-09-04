# Registro de errores — 03/sep/2026

Este archivo documenta los incidentes reales encontrados y corregidos la noche
del 3 de septiembre de 2026, mientras se probaba "Encuesta modelo de prueba"
en la Organización de prueba con el usuario Ana Soria. El objetivo es poder
reconocer rápido si algo parecido vuelve a pasar el sábado, sin tener que
re-investigar todo desde cero.

Formato de cada entrada: **síntoma** → **causa real** → **arreglo aplicado** →
**cómo reconocerlo si vuelve a pasar**.

---

## 1. El encuestador no ve NINGUNA encuesta en la app móvil (Error 400 en `get_encuestas_encuestador`)

### Síntoma
- Ana Soria abre la app en el rol encuestador y la lista de encuestas
  aparece vacía, sin importar cuántas veces se recarga o se vuelve a entrar.
- En el panel web, la encuesta y las zonas se ven perfectamente asignadas
  (esto es lo que generó la confusión: "si está todo bien en la base, ¿por
  qué no aparece en el celular?").
- Pasaba con **cualquier** encuestador, en **cualquier** encuesta, sin
  importar cómo estuvieran armados los equipos o las zonas.

### Causa real
La función `get_encuestas_encuestador()` (la que la app llama para traer la
lista de encuestas del encuestador) tenía un bug de PL/pgSQL: la migración
`20260902220019` (aplicada el día anterior) agregó una subconsulta con
`UNION` que referenciaba la columna `equipo_id` **sin calificar con el
nombre de tabla**:

```sql
select encuesta_id, equipo_id from encuestas_equipo
union
select encuesta_id, equipo_id from encuesta_zonas where equipo_id is not null
```

El problema: la función declara `RETURNS TABLE(... equipo_id uuid ...)`, y en
PL/pgSQL eso crea automáticamente una variable llamada `equipo_id` visible en
toda la función. Cualquier referencia sin calificar a una columna con ese
mismo nombre dentro de una consulta se vuelve ambigua entre la variable de
salida y la columna de la tabla. Resultado: **el 100% de los llamados a esta
función para el rol encuestador fallaban con HTTP 400** desde que se aplicó
esa migración, sin importar los datos. `auto_asignar_encuestador()` no se vio
afectada porque no usa esa columna de salida — por eso las asignaciones se
seguían creando bien "por atrás" aunque la lista no se pudiera mostrar.

Se confirmó revisando los logs de Supabase (`edge_logs` + `postgres_logs`):
el mensaje exacto era `column reference "equipo_id" is ambiguous`.

### Arreglo aplicado
Se recreó la función calificando las columnas del `UNION` con el nombre de
tabla (`encuestas_equipo.equipo_id`, `encuesta_zonas.equipo_id`, etc.), sin
cambiar ninguna otra lógica. Aplicado directo en producción y versionado en:
- `supabase/migrations/20260903235500_fix_get_encuestas_encuestador_equipo_id_ambiguo.sql`
- rollback: `..._rollback.sql` (no usar salvo para comparar — reintroduce el 400)

Se auditó además **todo** el esquema `public` buscando esta misma clase de
bug (funciones `plpgsql` que devuelven `TABLE(...)` con columnas de salida
que puedan colisionar con nombres de columnas reales). Solo hay 3 funciones
así en todo el proyecto: `auto_asignar_encuestador`, `get_proxima_parcela` y
`get_encuestas_encuestador`. Las primeras dos ya calificaban bien sus
columnas — la única con el bug era la tercera, ya corregida.

### Cómo reconocerlo si vuelve a pasar
- Síntoma: un encuestador no ve ninguna encuesta, pero en el panel web todo
  parece estar bien asignado.
- Chequeo rápido: en Supabase → Logs → Edge Logs, filtrar por
  `get_encuestas_encuestador` y ver el `status_code`. Si hay 400 ahí (y en
  Postgres Logs aparece "column reference ... is ambiguous"), es este mismo
  patrón de bug reapareciendo (probablemente por una migración nueva tocando
  esa función sin calificar columnas).
- Este bug es 100% del lado del servidor: no se arregla recargando la app,
  cerrando sesión, ni reasignando zonas — hay que corregir la función en la
  base de datos.

---

## 2. La cuota mostraba "10 restantes" (o "8") en vez de "50"

### Síntoma
- El admin configuró (creyó configurar) la cuota por encuestador en 50 desde
  el panel (`Configurar muestreo`).
- En la app móvil, a Ana Soria le aparecía "10 encuestas restantes", y
  después de completar 2, "8 restantes" — nunca "50".

### Causa real
En `MuestreoConfig.jsx`, el slider de "Cuota por encuestador" mostraba
`config.cuota_por_encuestador || 50` como valor. Ese `|| 50` es un default
puramente visual: si el admin nunca movía el control a mano, el "50" que se
veía en pantalla **nunca se guardaba** en `encuestas.config_muestreo`, porque
`CONFIG_DEFAULT` (el objeto que se usa como base al cargar/guardar) tampoco
incluía esa clave.

La función `get_estado_encuesta_callejera()` (la que calcula cuántas
encuestas le quedan a cada encuestador) tiene esta cadena de fallback:

```
cuota_por_encuestador → cuota_por_manzana → 50
```

Como `cuota_por_encuestador` nunca estaba realmente guardado, la función caía
al siguiente valor de la cadena: `cuota_por_manzana` (10 en este caso), un
número sin relación con lo que el admin pensaba haber configurado.

### Arreglo aplicado
- Se agregó `cuota_por_encuestador: 50` a `CONFIG_DEFAULT` en
  `MuestreoConfig.jsx`, para que a partir de ahora se guarde solo con abrir y
  guardar la configuración, sin necesitar tocar el slider.
- Se agregó chequeo de error en el guardado de `config_muestreo` (antes era
  silencioso).
- Se corrigieron a mano en la base los datos de las 2 encuestas afectadas de
  la Organización de prueba (`config_muestreo` actualizado con
  `cuota_por_encuestador: 50`), verificado con una llamada directa a
  `get_estado_encuesta_callejera()` (dio `cuota: 50, completadas: 2,
  restantes: 48`).

### Cómo reconocerlo si vuelve a pasar
- Síntoma: el número de "restantes" en la app no coincide con lo que se ve
  configurado en el panel.
- Chequeo rápido (SQL):
  ```sql
  select id, nombre, config_muestreo
  from encuestas
  where tipo_encuesta in ('callejera','telefonica')
    and not (config_muestreo ? 'cuota_por_encuestador');
  ```
  Si una encuesta activa aparece en este listado, el panel le está mostrando
  un "50" que no está guardado de verdad. Hay que entrar a "Configurar
  muestreo", mover el slider (aunque sea 1 unidad y volverlo a 50) y guardar,
  o parchear `config_muestreo` directo en la base como se hizo arriba.
- **Encontrado en la auditoría de esta noche, no corregido todavía:** la
  encuesta **"gestion 2026"** (misma Organización de prueba) también le
  falta `cuota_por_encuestador` en `config_muestreo` y hoy cae al fallback de
  `cuota_por_manzana = 16`. No se tocó porque no está claro si ese `16` fue
  elegido a propósito por el admin para esa encuesta — antes de asumir que
  hay que ponerle 50 como a las otras dos, confirmar qué cuota corresponde
  ahí.

---

## 3. Antipatrón repetido: llamadas a Supabase sin revisar `error` (paneles de asignación de equipos)

### Síntoma
No es un síntoma puntual de esta noche, sino el mecanismo que **puede volver
a producir** el mismo tipo de fallo silencioso que causó la confusión de
zonas huérfanas al eliminar un equipo. Se encontró el mismo patrón de código
en varios lugares del panel admin.

### Causa real
`supabase-js` **no lanza una excepción** cuando un `insert`/`update`/`delete`
falla (por RLS, constraint, etc.) — devuelve `{ data, error }` y sigue. Si el
código hace `await supabase.from(...).delete()...` sin desestructurar y
revisar `error`, un fallo real pasa completamente desapercibido: el
`try/catch` nunca se dispara, la UI actúa como si hubiera funcionado
(cierra el modal, refresca la lista, etc.) y el dato roto queda en la base
sin ningún aviso. Este es exactamente el mecanismo por el que una zona puede
quedar "huérfana" (con `equipo_id` apuntando a un equipo que en teoría se
borró, o sin equipo asignado) sin que nadie se entere en el momento.

Se encontró y corrigió este mismo patrón en:
- `MuestreoConfig.jsx` — guardado de config de muestreo, `eliminarZona()`,
  `agregarZona()` (corregidos antes, en esta misma sesión).
- `Equipos.jsx` — `confirmarEliminar()` (borrar equipo), `toggleCoordinador()`
  y `toggleEncuestador()` (asignar/desasignar miembros a un equipo).
- `Encuestadores.jsx` — `AsignarEquipoModal.handleSave()` (asignar equipo a
  un encuestador).
- `Coordinadores.jsx` — asignación de equipos a un coordinador.

### Arreglo aplicado
En cada uno de esos puntos se agregó `const { error } = await supabase...` +
`if (error) throw error`, para que un fallo real termine mostrando un
mensaje de error visible en vez de fallar en silencio. Verificado con
`npx vite build --mode development` (compila limpio).

**Nota:** quedan más llamadas del mismo estilo sin revisar en otras pantallas
del panel (`Encuestas.jsx` publicar/completar encuesta, `Reportes.jsx`
edición de clasificaciones, etc.) que no se tocaron porque no son parte del
flujo crítico de armado de equipos/zonas para el sábado. Si algo similar
vuelve a pasar en esas pantallas, buscar el mismo patrón: una llamada
`await supabase.from(...)` dentro de un `try` sin desestructurar `error`.

### Cómo reconocerlo si vuelve a pasar
- Síntoma: se hace una acción en el panel (borrar equipo, asignar
  encuestador, etc.), no aparece ningún error, pero el cambio "no prendió"
  (el dato sigue como antes al refrescar).
- Buscar en el código el `await supabase.from(...)` correspondiente a esa
  acción y confirmar si revisa `error`. Si no lo hace, ese es el bug.

---

## 4. Otro hallazgo de la auditoría: zonas sin equipo asignado con encuestadores activos

Al revisar toda la Organización de prueba se encontraron **zonas con
`equipo_id = NULL`** (el mismo estado de "zona huérfana" que disparó la
crisis de esta noche) en otras 3 encuestas publicadas, con encuestadores que
tienen asignaciones activas apuntando justo a esas zonas:

- "Encuesta Política Integral - Jardín América" — zona "Zona 1"
- "gestion 2026" — zona "Zona 1"
- "Satisfacción con la gestión municipal 2025" — zonas "Zona 1" y "Zona 2"

Estas son encuestas de prueba/demo viejas, no la que se usa el sábado, así
que **no se modificaron** en esta auditoría — pero si alguien las usa como
prueba en el celular, es esperable que se repita el síntoma "no veo la
encuesta / no veo esa zona" por esta misma causa. Chequeo rápido antes de
usar cualquier encuesta de prueba:

```sql
select ez.id, ez.nombre, e.nombre as encuesta
from encuesta_zonas ez
join encuestas e on e.id = ez.encuesta_id
where ez.equipo_id is null
  and e.estado_produccion = 'publicada';
```

Si la encuesta que se va a usar el sábado aparece en este listado, asignarle
equipo a esa zona antes de arrancar (no depender del fallback automático).

---

## 5. Comportamiento a tener en cuenta para el sábado: `auto_asignar_encuestador()`

No es un bug, pero es una limitación real de cómo funciona la asignación
automática, y puede confundir en el momento si no se sabe:

`auto_asignar_encuestador()` le crea automáticamente una asignación a un
encuestador para una zona de su equipo **solo si todavía no tiene ninguna
asignación activa en esa misma encuesta**. Si un encuestador ya tiene una
asignación (aunque sea de otra zona) y después se le agrega una zona nueva al
equipo dentro de la misma encuesta, **esa zona nueva no se le va a
auto-asignar** — hay que crear la asignación a mano desde el panel.

En la práctica: si el día del operativo hace falta sumarle una zona extra a
un encuestador que ya está trabajando en esa encuesta, no alcanza con
agregarla al equipo — hay que ir a asignar esa zona puntual manualmente.

---

## Resumen ejecutivo (para leer en 30 segundos)

| # | Problema | Estado |
|---|----------|--------|
| 1 | `get_encuestas_encuestador()` rompía con 400 para todo encuestador | ✅ Corregido en producción |
| 2 | Cuota "50" se mostraba pero no se guardaba (2 encuestas) | ✅ Corregido (código + datos) |
| 2b | Misma falla en "gestion 2026" (¿16 es intencional?) | ⚠️ Pendiente de confirmar con el admin |
| 3 | Llamadas a Supabase sin chequear `error` en asignación de equipos | ✅ Corregido en 4 pantallas |
| 4 | Zonas sin equipo en 3 encuestas de prueba viejas | ⚠️ No tocado, documentado |
| 5 | Auto-asignación no cubre zonas nuevas si ya hay asignación activa | ℹ️ Comportamiento a tener en cuenta, no corregido |
