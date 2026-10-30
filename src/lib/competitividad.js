// Competitividad electoral, proyección con intervalo y curva de saturación
// sobre la pregunta de candidato (intendente por defecto).

import {
  preguntaEspecial, opcionesDe, esCompletada, valorFusionadoConSeguimiento,
  buscarSeguimientoOtro, distribucionCompleta,
} from './reportesAutomaticos'
import { esOpcionIndecisa } from './indecision'
import { margenError, intervaloConfianza } from './margenError'

const CARGOS = [
  { clave: 'candidato_intendente', nombre: 'Intendente' },
  { clave: 'candidato_gobernador', nombre: 'Gobernador' },
  { clave: 'candidato_presidente', nombre: 'Presidente' },
]

// Pregunta de candidato "principal" de la encuesta: intendente si existe,
// si no gobernador, si no presidente.
export function preguntaCandidatoPrincipal(ctx) {
  for (const c of CARGOS) {
    const p = preguntaEspecial(ctx, c.clave)
    if (p) return { pregunta: p, cargo: c.nombre }
  }
  return null
}

// Cargos a mostrar en los paneles: intendente y gobernador si la encuesta
// tiene su pregunta; si no tiene ninguno de los dos, el principal (presidente).
export function cargosCandidato(ctx) {
  const propios = CARGOS.slice(0, 2).filter(c => preguntaEspecial(ctx, c.clave))
  if (propios.length) return propios
  const principal = preguntaCandidatoPrincipal(ctx)
  return principal ? [CARGOS.find(c => c.nombre === principal.cargo)] : []
}

// Pregunta + nombre de cargo para una clave dada (o la principal si no hay).
function resolverCargo(ctx, claveCand) {
  if (!claveCand) return preguntaCandidatoPrincipal(ctx)
  const pregunta = preguntaEspecial(ctx, claveCand)
  const cargo = CARGOS.find(c => c.clave === claveCand)?.nombre
  return pregunta && cargo ? { pregunta, cargo } : null
}

// ── 14. Índice de competitividad ──
export function nivelCompetitividadElectoral(diff) {
  if (diff < 5) return { label: 'Muy competitivo', emoji: '🔴', color: '#dc2626' }
  if (diff < 15) return { label: 'Disputado', emoji: '🟡', color: '#ca8a04' }
  if (diff <= 30) return { label: 'Definido', emoji: '🟢', color: '#16a34a' }
  return { label: 'Dominado', emoji: '🔵', color: '#2563eb' }
}

// Diferencia en pp entre 1° y 2° sobre votos válidos (sin NS/NC, blanco,
// ninguno ni indecisos — ver esOpcionIndecisa).
export function indiceCompetitividad(ctx, claveCand = 'candidato_intendente') {
  const p = preguntaEspecial(ctx, claveCand)
  if (!p || !ctx?.crudo) return null
  const dist = distribucionCompleta(p, ctx.preguntas, ctx.crudo, preguntaEspecial(ctx, 'participa'))
  const validas = dist.filas.filter(f => !esOpcionIndecisa(f.opcion) && f.n > 0).sort((a, b) => b.n - a.n)
  const totalValidos = validas.reduce((s, f) => s + f.n, 0)
  if (validas.length < 2 || !totalValidos) return null
  const pct = n => Math.round((n / totalValidos) * 1000) / 10
  const [c1, c2] = validas
  const diff = Math.round((pct(c1.n) - pct(c2.n)) * 10) / 10
  return {
    primero: { nombre: c1.opcion, pct: pct(c1.n) },
    segundo: { nombre: c2.opcion, pct: pct(c2.n) },
    diff, totalValidos, nivel: nivelCompetitividadElectoral(diff),
    cargo: CARGOS.find(c => c.clave === claveCand)?.nombre || 'Intendente',
  }
}

// ── 15. Proyección con intervalo ──
// Top 3 candidatos (sin indecisos) con su % sobre el total de respuestas a
// la pregunta — misma base que los reportes de intención de voto — y el
// intervalo de confianza con el ME específico de cada uno.
export const N_MINIMO_PROYECCION = 100

export function proyeccion(ctx, claveCand) {
  const principal = resolverCargo(ctx, claveCand)
  if (!principal || !ctx?.crudo) return null
  const dist = distribucionCompleta(principal.pregunta, ctx.preguntas, ctx.crudo, preguntaEspecial(ctx, 'participa'))
  if (dist.total < N_MINIMO_PROYECCION) return null
  const candidatos = dist.filas
    .filter(f => !esOpcionIndecisa(f.opcion) && f.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map(f => {
      const ic = intervaloConfianza(dist.total, f.n / dist.total)
      return { nombre: f.opcion, pct: f.pct, lo: Math.round(ic.lo * 1000) / 10, hi: Math.round(ic.hi * 1000) / 10 }
    })
  return candidatos.length ? { cargo: principal.cargo, n: dist.total, candidatos } : null
}

// ── 8. Curva de saturación ──
// % acumulado del líder (el más votado al final, sin indecisos) a medida
// que entran encuestas, en orden cronológico de completada_en.
export const N_MINIMO_SATURACION = 50
const VENTANA_ESTABILIDAD = 50
const UMBRAL_ESTABILIDAD_PP = 2
const MAX_PUNTOS_CURVA = 400

export function curvaSaturacion(ctx, claveCand) {
  const principal = resolverCargo(ctx, claveCand)
  if (!principal || !ctx?.crudo) return null
  const p = principal.pregunta
  const pParticipa = preguntaEspecial(ctx, 'participa')
  const opciones = opcionesDe(p)
  const pSeg = buscarSeguimientoOtro(ctx.preguntas, p)

  const votos = (ctx.crudo.filas || [])
    .filter(f => f.fecha && esCompletada(f, pParticipa))
    .map(f => ({ t: new Date(f.fecha).getTime(), valor: valorFusionadoConSeguimiento(f, p, opciones, pSeg) }))
    .filter(v => v.valor)
    .sort((a, b) => a.t - b.t)
  const n = votos.length
  if (n < N_MINIMO_SATURACION) return null

  const conteo = {}
  votos.forEach(v => { conteo[v.valor] = (conteo[v.valor] || 0) + 1 })
  const lider = Object.entries(conteo).filter(([op]) => !esOpcionIndecisa(op)).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!lider) return null

  let acumulado = 0
  const serie = votos.map((v, i) => {
    if (v.valor === lider) acumulado++
    return { k: i + 1, pct: (acumulado / (i + 1)) * 100 }
  })
  const pctFinal = serie[n - 1].pct
  const me = margenError(n, pctFinal / 100) * 100
  const ultimos = serie.slice(-VENTANA_ESTABILIDAD).map(s => s.pct)
  const variacion = Math.max(...ultimos) - Math.min(...ultimos)

  // Submuestreo para el gráfico (se conserva siempre el último punto).
  const paso = Math.ceil(n / MAX_PUNTOS_CURVA)
  const puntos = serie.filter((s, i) => i % paso === 0 || i === n - 1)

  return {
    cargo: principal.cargo, lider, n, puntos,
    pctFinal: Math.round(pctFinal * 10) / 10, me: Math.round(me * 10) / 10,
    variacion: Math.round(variacion * 10) / 10, estable: variacion < UMBRAL_ESTABILIDAD_PP,
    ventana: VENTANA_ESTABILIDAD, umbral: UMBRAL_ESTABILIDAD_PP,
  }
}
