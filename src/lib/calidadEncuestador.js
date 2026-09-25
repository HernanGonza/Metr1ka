// Score de calidad por encuestador (0–100) + datos de detalle (histograma
// horario, puntos GPS). Se recalcula siempre del lado del cliente, no se
// persiste.
//
// 4 indicadores de 0 a 25 puntos:
//   - Rechazo: 0% → 25, ≥ 40% → 0, lineal.
//   - Variedad de respuestas: entropía de Shannon de sus respuestas a
//     candidato, normalizada por ln(cantidad de opciones). Siempre el mismo
//     candidato → 0.
//   - Dispersión GPS: distancia típica al centroide de sus sesiones
//     (lib/geo.js). ≤ 25 m → 0 (siempre en el mismo punto), ≥ 250 m → 25.
//   - Ritmo: minutos promedio entre completadas consecutivas. < 2 → 0,
//     2–5 lineal, ≥ 5 → 25. Los huecos > 90 min se toman como pausas o
//     cambio de día y no entran al promedio.
// Si un indicador no se puede calcular (sin pregunta de candidato, sin GPS,
// muy pocas sesiones), queda "n/d" y el total se reescala sobre los
// indicadores disponibles.

import {
  preguntaEspecial, opcionesDe, esCompletada, valorFusionadoConSeguimiento,
  buscarSeguimientoOtro, horaArgentina,
} from './reportesAutomaticos'
import { dispersionMetros, distanciaMetros } from './geo'
import { detectarStraightlining } from './straightlining'

export const RECHAZO_MAX = 40
export const GPS_MIN_M = 25
export const GPS_OK_M = 250
export const RITMO_MIN = 2
export const RITMO_OK = 5
export const PAUSA_MIN = 90
const MIN_RESPUESTAS_ENTROPIA = 5

const lineal = (v, desde, hasta) => Math.max(0, Math.min(1, (v - desde) / (hasta - desde))) * 25
const r1 = v => Math.round(v * 10) / 10

export function colorScore(score) {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#ca8a04'
  return '#dc2626'
}

function entropiaNormalizada(valores, k) {
  if (valores.length < MIN_RESPUESTAS_ENTROPIA || k < 2) return null
  const conteo = {}
  valores.forEach(v => { conteo[v] = (conteo[v] || 0) + 1 })
  const h = -Object.values(conteo).reduce((s, n) => { const p = n / valores.length; return s + p * Math.log(p) }, 0)
  return Math.min(1, h / Math.log(k))
}

function ritmoMinutos(fechas) {
  const ts = fechas.map(f => new Date(f).getTime()).sort((a, b) => a - b)
  const gaps = []
  for (let i = 1; i < ts.length; i++) {
    const m = (ts[i] - ts[i - 1]) / 60000
    if (m <= PAUSA_MIN) gaps.push(m)
  }
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
}

// Sesiones de get_respuestas_crudas agrupadas por nombre de encuestador (la
// RPC no devuelve el id).
export function sesionesPorEncuestador(crudo) {
  const out = {}
  for (const f of crudo?.filas || []) {
    const k = f.encuestador || '—'
    ;(out[k] = out[k] || []).push(f)
  }
  return out
}

// stats = { no_respuesta, total } del encuestador (get_stats_por_zona /
// get_encuesta_full); sesiones = sus filas de get_respuestas_crudas.
// ── "Carga rápida en el mismo lugar" ──
// Lo que se busca es al encuestador parado en un punto cargando encuestas
// sin hacerlas ("dándole al dedo"). NO se marcan:
//   - encuestas cercanas entre sí si el encuestador se mueve (gente en la
//     calle, casas vecinas);
//   - varias entrevistas en la misma casa (miembros de una familia) si cada
//     una dura lo normal.
// Se marca una encuesta completada cuando:
//   1. duró mucho menos de lo normal (< 40% de la duración mediana de las
//      completadas de TODA la encuesta), y
//   2. hay otra sesión del mismo encuestador a < 30 m dentro de ±15 min.
// Aparte se avisa (amarillo, no rojo) la SUPERPOSICIÓN: una sesión que
// empieza más de 2 min antes de que termine la anterior. Es señal débil:
// `iniciada_en` es la hora del CELULAR y `completada_en` la del SERVIDOR al
// guardar, así que un reloj desfasado (en San Ignacio, set/2026, hasta
// ~40 s) o una encuesta guardada sin señal y sincronizada después también
// la producen.
//
// Desde la migración 20260925010000 la app manda además la hora de fin
// según el CELULAR (`fin_dispositivo`). Cuando está, duración y
// superposición se miden con un solo reloj: la duración es exacta y una
// superposición es real (con un solo celular no se pueden hacer dos
// encuestas a la vez → misma cuenta en dos teléfonos) y pasa a alerta roja.
//
// Datos sin hora de inicio real: la versión vieja de la app no mandaba
// `iniciada_en` y el servidor guardaba inicio = fin. Esas sesiones se
// tratan como "sin dato" (si no, darían duración 0 y se marcarían todas).
//
// Duración: completada_en − iniciada_en (campo `inicio`, migración
// 20260925000000). Si la RPC todavía no lo devuelve, se aproxima con el
// tiempo desde que terminó la sesión anterior del encuestador (cota
// superior de la duración real) — detecta lo mismo, con menos precisión.
export const MISMO_LUGAR_M = 30
export const VENTANA_MIN = 15
export const FRACCION_EXPRES = 0.4
const SUPERPOSICION_TOLERANCIA_S = 120 // relojes mezclados (celular vs servidor)
const SUPERPOSICION_TOLERANCIA_MISMO_RELOJ_S = 10
const DURACION_REFERENCIA_DEFECTO_MIN = 8

const cacheMediana = new WeakMap()

// Duración mediana (min) de las completadas de toda la encuesta.
export function duracionMediana(crudo, pParticipa) {
  if (!crudo) return null
  if (cacheMediana.has(crudo)) return cacheMediana.get(crudo)
  const durs = (crudo.filas || [])
    .filter(f => f.inicio && f.fecha && esCompletada(f, pParticipa))
    .map(f => (new Date(f.fin_dispositivo || f.fecha) - new Date(f.inicio)) / 60000)
    .filter(d => d > 1 / 60 && d < 180)
    .sort((a, b) => a - b)
  const med = durs.length >= 10 ? durs[Math.floor(durs.length / 2)] : null
  cacheMediana.set(crudo, med)
  return med
}

// Hora de inicio real, o null si no hay (versión vieja: inicio = fin).
function inicioReal(f) {
  if (!f.inicio) return null
  const ini = new Date(f.inicio).getTime()
  return Math.abs(new Date(f.fecha).getTime() - ini) < 1000 ? null : ini
}

// Trayecto del encuestador: todas sus sesiones en orden cronológico con
// coordenadas locales en metros (x = este, y = norte, respecto del
// centroide), duración, distancia/minutos respecto de la anterior y las
// marcas de "carga rápida en el mismo lugar" y superposición.
export function trayectoGPS(sesiones, pParticipa, medianaMin = null) {
  const conFecha = (sesiones || [])
    .filter(f => f.fecha)
    .map(f => ({
      lat: f.lat != null ? Number(f.lat) : null, lng: f.lng != null ? Number(f.lng) : null,
      finServidor: new Date(f.fecha).getTime(), ini: inicioReal(f),
      finDisp: f.fin_dispositivo ? new Date(f.fin_dispositivo).getTime() : null,
      completada: esCompletada(f, pParticipa),
    }))
    .map(p => ({ ...p, fin: p.finDisp ?? p.finServidor }))
    .sort((a, b) => a.fin - b.fin)
  const tieneGPS = p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
  const referencia = medianaMin ?? DURACION_REFERENCIA_DEFECTO_MIN
  const umbralExpres = referencia * FRACCION_EXPRES
  const hayInicio = conFecha.some(p => p.ini != null)

  conFecha.forEach((p, i) => {
    const prev = conFecha[i - 1]
    p.duracion = p.ini != null ? (p.fin - p.ini) / 60000 : prev ? (p.fin - prev.fin) / 60000 : null
    p.duracionExacta = p.ini != null && p.finDisp != null
    p.desdeAnterior = prev ? ((p.ini ?? p.fin) - prev.fin) / 60000 : null
    // Mismo reloj (inicio de esta y fin de la anterior, ambos del celular) → confiable.
    p.superpuestaConfiable = !!(prev && p.ini != null && prev.finDisp != null)
    const tolerancia = (p.superpuestaConfiable ? SUPERPOSICION_TOLERANCIA_MISMO_RELOJ_S : SUPERPOSICION_TOLERANCIA_S) * 1000
    p.superpuesta = !!(prev && p.ini != null && p.ini < prev.fin - tolerancia)
    p.expres = p.completada && p.duracion != null && p.duracion < umbralExpres
  })
  conFecha.forEach((p, i) => {
    p.sospechosa = false
    if (!p.expres || !tieneGPS(p)) return
    for (let j = 0; j < conFecha.length; j++) {
      const q = conFecha[j]
      if (j === i || !tieneGPS(q) || Math.abs(q.fin - p.fin) / 60000 > VENTANA_MIN) continue
      if (distanciaMetros(p.lat, p.lng, q.lat, q.lng) < MISMO_LUGAR_M) { p.sospechosa = true; break }
    }
  })

  const conGPS = conFecha.filter(tieneGPS)
  const cLat = conGPS.length ? conGPS.reduce((s, p) => s + p.lat, 0) / conGPS.length : 0
  const cLng = conGPS.length ? conGPS.reduce((s, p) => s + p.lng, 0) / conGPS.length : 0
  const mLng = 111320 * Math.cos((cLat * Math.PI) / 180)
  const fmtHora = t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
  let prevGPS = null
  const puntos = []
  conFecha.forEach((p, i) => {
    if (!tieneGPS(p)) return
    puntos.push({
      idx: i + 1, lat: p.lat, lng: p.lng, x: (p.lng - cLng) * mLng, y: (p.lat - cLat) * 111320,
      hora: fmtHora(p.fin), franja: franjaDelDia(horaArgentina(new Date(p.fin).toISOString())),
      completada: p.completada, sospechosa: p.sospechosa, superpuesta: p.superpuesta,
      duracion: p.duracion, duracionEstimada: p.ini == null, duracionExacta: p.duracionExacta, desdeAnterior: p.desdeAnterior,
      distPrev: prevGPS ? distanciaMetros(prevGPS.lat, prevGPS.lng, p.lat, p.lng) : null,
    })
    prevGPS = p
  })
  const completadas = conFecha.filter(p => p.completada).length
  const sospechosas = conFecha.filter(p => p.sospechosa).length
  const superpuestas = conFecha.filter(p => p.superpuesta).length
  const superpuestasConfiables = conFecha.filter(p => p.superpuesta && p.superpuestaConfiable).length
  return {
    puntos, sospechosas, superpuestas, superpuestasConfiables, hayInicio,
    expres: conFecha.filter(p => p.expres).length,
    pctSospechosas: completadas ? Math.round((sospechosas / completadas) * 1000) / 10 : 0,
    umbralExpresMin: Math.round(umbralExpres * 10) / 10, referenciaMin: Math.round(referencia * 10) / 10,
  }
}

// Rojo: > 10% de sus completadas (o 5+) cargadas rápido en el mismo lugar,
// o alguna superposición medida con el reloj del celular.
// Amarillo: algún caso aislado, o superposiciones con relojes mezclados.
export function nivelAlertaMismoLugar(tray) {
  if (!tray || (!tray.sospechosas && !tray.superpuestas)) return null
  if (tray.pctSospechosas > 10 || tray.sospechosas >= 5 || tray.superpuestasConfiables) return { color: '#dc2626', label: 'alta' }
  return { color: '#ca8a04', label: 'revisar' }
}

export function textoAlertaMismoLugar(tray) {
  const partes = []
  if (tray.sospechosas) partes.push(`${tray.sospechosas} cargada${tray.sospechosas === 1 ? '' : 's'} rápido en el mismo lugar (${tray.pctSospechosas}%)`)
  if (tray.superpuestasConfiables) partes.push(`${tray.superpuestasConfiables} superpuesta${tray.superpuestasConfiables === 1 ? '' : 's'} con la anterior (¿misma cuenta en dos celulares?)`)
  const debiles = tray.superpuestas - (tray.superpuestasConfiables || 0)
  if (debiles) partes.push(`${debiles} superpuesta${debiles === 1 ? '' : 's'} con la anterior (puede ser sincronización tardía)`)
  return partes.join(' · ')
}

export function scoreCalidad(ctx, stats, sesiones) {
  const pParticipa = preguntaEspecial(ctx, 'participa')
  const pCand = preguntaEspecial(ctx, 'candidato_intendente')
    || preguntaEspecial(ctx, 'candidato_gobernador') || preguntaEspecial(ctx, 'candidato_presidente')
  const completadas = (sesiones || []).filter(f => esCompletada(f, pParticipa))

  const tasa = stats?.total ? ((stats.no_respuesta || 0) / stats.total) * 100 : null
  const rechazo = tasa == null ? null
    : { pts: 25 * (1 - Math.min(tasa, RECHAZO_MAX) / RECHAZO_MAX), valor: `${r1(tasa)}% de rechazo` }

  let variedad = null
  if (pCand) {
    const opciones = opcionesDe(pCand)
    const pSeg = buscarSeguimientoOtro(ctx.preguntas, pCand)
    const valores = completadas.map(f => valorFusionadoConSeguimiento(f, pCand, opciones, pSeg)).filter(Boolean)
    const e = entropiaNormalizada(valores, opciones.length)
    if (e != null) variedad = { pts: 25 * e, valor: `entropía ${Math.round(e * 100)}% del máximo` }
  }

  const disp = dispersionMetros(sesiones)
  const gps = disp == null ? null : { pts: lineal(disp, GPS_MIN_M, GPS_OK_M), valor: `${Math.round(disp)} m de dispersión` }

  const rm = ritmoMinutos(completadas.map(f => f.fecha).filter(Boolean))
  const ritmo = rm == null ? null : { pts: lineal(rm, RITMO_MIN, RITMO_OK), valor: `${r1(rm)} min entre encuestas` }

  const indicadores = { rechazo, variedad, gps, ritmo }
  const disponibles = Object.values(indicadores).filter(Boolean)
  const total = disponibles.length
    ? Math.round((disponibles.reduce((s, i) => s + i.pts, 0) / (25 * disponibles.length)) * 100)
    : null
  return { total, indicadores, dispersionM: disp, trayecto: trayectoGPS(sesiones, pParticipa, duracionMediana(ctx.crudo, pParticipa)) }
}

export const ETIQUETAS_INDICADORES = {
  rechazo: 'Tasa de rechazo',
  variedad: 'Variedad de respuestas',
  gps: 'Dispersión GPS',
  ritmo: 'Ritmo de encuestas',
}

export function desgloseTexto(score) {
  return Object.entries(ETIQUETAS_INDICADORES).map(([k, label]) => {
    const i = score.indicadores[k]
    return `${label}: ${i ? `${Math.round(i.pts)}/25 (${i.valor})` : 'n/d'}`
  })
}

// Franja horaria para colorear el scatter GPS.
export function franjaDelDia(hora) {
  if (hora >= 6 && hora < 12) return 'mañana'
  if (hora >= 12 && hora < 19) return 'tarde'
  return 'noche'
}
export const COLORES_FRANJA = { mañana: '#2563eb', tarde: '#ea580c', noche: '#6b7280' }

export function histogramaHoras(sesiones) {
  const h = Array.from({ length: 24 }, () => 0)
  ;(sesiones || []).forEach(f => { if (f.fecha) h[horaArgentina(f.fecha)]++ })
  return h
}


// Agrega al reporte "Actividad por encuestador" (reportesAutomaticos.js)
// la columna de score, el detalle para el PDF (histograma horario +
// dispersión GPS) y las alertas de straightlining. Vive acá y no en
// reportesAutomaticos.js para no crear una importación circular.
export function enriquecerActividad(resultado, ctx) {
  if (!resultado?.filas || !ctx?.crudo) return resultado
  const porNombre = sesionesPorEncuestador(ctx.crudo)
  const filas = resultado.filas.map(f => {
    const sesiones = porNombre[f.encuestador] || []
    const sc = scoreCalidad(ctx, f, sesiones)
    return { ...f, score: sc.total != null ? `${sc.total}/100` : 'n/d', _score: sc, _horas: histogramaHoras(sesiones) }
  })
  const straightlining = detectarStraightlining(ctx)
  return {
    ...resultado,
    columnas: [...resultado.columnas, { key: 'score', label: 'Score de calidad', num: true }],
    filas,
    straightlining,
  }
}
