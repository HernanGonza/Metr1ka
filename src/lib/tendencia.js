// Tendencia entre encuestas del mismo municipio: busca automáticamente la
// encuesta anterior de la misma organización cuyo nombre comparte palabras
// clave con la actual (ej. "San Ignacio" en ambas) y compara las preguntas
// con clave_base coincidente, marcando si cada variación supera la suma de
// los márgenes de error de las dos encuestas.

import { supabase } from './supabase'
import { cacheGet, cacheSet } from './cache'
import { normalizarTexto } from './fuzzyMatch'
import { buscarPregunta, distribucionCompleta } from './reportesAutomaticos'
import { diferenciaSignificativa } from './margenError'

// Palabras que aparecen en nombres de encuestas de cualquier municipio y no
// sirven para identificar uno. Además se descartan tokens de < 4 letras
// ("san", "de", "la") y números (años, "2da", etc.).
const GENERICAS = new Set([
  'encuesta', 'encuestas', 'sondeo', 'relevamiento', 'estudio', 'medicion', 'opinion', 'publica',
  'intencion', 'votos', 'electoral', 'elecciones', 'eleccion', 'municipal', 'municipio', 'provincial',
  'provincia', 'nacional', 'online', 'campo', 'operativo', 'prueba', 'test', 'final', 'primera', 'segunda',
  'tercera', 'cuarta', 'ronda', 'etapa', 'oleada', 'gestion', 'imagen', 'candidatos', 'intendente',
  'gobernador', 'presidente', 'concejales', 'barrio', 'barrios', 'ciudad', 'localidad', 'general',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'setiembre',
  'octubre', 'noviembre', 'diciembre', 'copia', 'nueva', 'nuevo',
])

export function palabrasClave(nombre) {
  return new Set(
    normalizarTexto(nombre || '')
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 4 && !/\d/.test(t) && !GENERICAS.has(t))
  )
}

// De `lista`, la más reciente creada antes que `actual` que comparta al
// menos una palabra clave. Sin fecha de creación en `actual`, se aceptan
// todas menos ella misma.
export function buscarEncuestaAnterior(actual, lista) {
  const claves = palabrasClave(actual?.nombre)
  if (!claves.size) return null
  const tActual = actual.creado_en ? new Date(actual.creado_en).getTime() : Infinity
  return (lista || [])
    .filter(e => e.id !== actual.id && (!e.creado_en || new Date(e.creado_en).getTime() < tActual))
    .filter(e => [...palabrasClave(e.nombre)].some(t => claves.has(t)))
    .sort((a, b) => new Date(b.creado_en || 0) - new Date(a.creado_en || 0))[0] || null
}

// `sinCache`: forzar la recarga (p. ej. cuando el admin aplica respuestas
// nuevas del operativo con "↻ Actualizar").
async function cargarCrudo(encuesta, { sinCache = false } = {}) {
  const key = `rvz:crudo:${encuesta.id}` // misma clave que ReporteVisualZona: se comparte el cache
  const cached = sinCache ? null : cacheGet(key)
  if (cached) return cached
  const { data, error } = await supabase.rpc('get_respuestas_crudas', {
    p_encuesta_id: encuesta.id, p_org_id: encuesta.organizacion_id,
    p_equipo_id: null, p_encuestador_id: null, p_fecha_desde: null, p_fecha_hasta: null,
  })
  if (error) throw error
  const crudo = data || { columnas: [], filas: [] }
  cacheSet(key, crudo, 120_000)
  return crudo
}

export { cargarCrudo as cargarRespuestasCrudas }

// Busca y carga la encuesta anterior comparable. Devuelve null si no hay.
export async function cargarEncuestaAnterior(actual) {
  if (!actual?.organizacion_id) return null
  const keyLista = `tend:lista:${actual.organizacion_id}`
  let lista = cacheGet(keyLista)
  if (!lista) {
    const { data, error } = await supabase.from('encuestas')
      .select('id, nombre, creado_en, organizacion_id, estado_produccion')
      .eq('organizacion_id', actual.organizacion_id)
      .in('estado_produccion', ['publicada', 'completada'])
    if (error) throw error
    lista = data || []
    cacheSet(keyLista, lista, 300_000)
  }
  const anterior = buscarEncuestaAnterior(actual, lista)
  if (!anterior) return null
  const keyFull = `tend:full:${anterior.id}`
  let preguntas = cacheGet(keyFull)
  if (!preguntas) {
    const { data, error } = await supabase.rpc('get_encuesta_full', { p_encuesta_id: anterior.id, p_org_id: actual.organizacion_id })
    if (error) throw error
    preguntas = data?.preguntas || []
    cacheSet(keyFull, preguntas, 300_000)
  }
  const crudo = await cargarCrudo(anterior)
  return { encuesta: anterior, preguntas, crudo }
}

// actual/anterior = { preguntas, crudo }. Una sección por clave_base común
// (sin 'participa'), con variación en puntos porcentuales por opción.
export function compararConAnterior(actual, anterior) {
  if (!actual?.crudo || !anterior?.crudo) return []
  const pPartAct = buscarPregunta(actual.preguntas, 'participa')
  const pPartAnt = buscarPregunta(anterior.preguntas, 'participa')

  return (actual.preguntas || [])
    .filter(p => p.clave_base && p.clave_base !== 'participa' && ['si_no', 'escala', 'opcion_multiple'].includes(p.tipo))
    .map(pAct => {
      const pAnt = buscarPregunta(anterior.preguntas, pAct.clave_base)
      if (!pAnt) return null
      const dAct = distribucionCompleta(pAct, actual.preguntas, actual.crudo, pPartAct)
      const dAnt = distribucionCompleta(pAnt, anterior.preguntas, anterior.crudo, pPartAnt)
      if (!dAct.total || !dAnt.total) return null
      const antPorOpcion = Object.fromEntries(dAnt.filas.map(f => [normalizarTexto(f.opcion), f]))
      const filas = dAct.filas.map(fa => {
        const fb = antPorOpcion[normalizarTexto(fa.opcion)]
        if (!fb) return null
        const diff = Math.round((fa.pct - fb.pct) * 10) / 10
        const significativa = diferenciaSignificativa(dAnt.total, fb.pct / 100, dAct.total, fa.pct / 100)
        const tendencia = !significativa ? 'igual' : diff > 0 ? 'sube' : 'baja'
        return { opcion: fa.opcion, pctAnterior: fb.pct, pctActual: fa.pct, diff, significativa, tendencia }
      }).filter(Boolean)
      if (!filas.length) return null
      return { claveBase: pAct.clave_base, titulo: pAct.texto, nAnterior: dAnt.total, nActual: dAct.total, filas }
    })
    .filter(Boolean)
}
