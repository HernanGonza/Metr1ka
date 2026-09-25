// Correlación evaluación de gestión × intención de voto (Pearson, sesión
// por sesión). Sin librerías externas.
//
// Metodología: la evaluación se pasa a escala numérica (Muy buena=5 …
// Muy mala=1; NS/NC y respuestas no clasificables quedan fuera) y el voto a
// binario por candidato (1 = vota a ese candidato, 0 = no). Se calcula un r
// por candidato; el "oficialista" es el que tiene el r más alto — el que más
// se beneficia de una buena evaluación. Es la misma aproximación que usa la
// regla de consistencia interna (reglaGestionVsVoto en reportesAutomaticos.js):
// el modelo de datos no guarda el espacio político de cada candidato.

import { normalizarTexto } from './fuzzyMatch'
import {
  preguntaEspecial, opcionesDe, esCompletada, valorFusionadoConSeguimiento,
  buscarSeguimientoOtro, OTRO_SIN_IDENTIFICAR,
} from './reportesAutomaticos'
import { esOpcionIndecisa } from './indecision'

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i] }
  const mx = sx / n, my = sy / n
  let cov = 0, vx = 0, vy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    cov += dx * dy; vx += dx * dx; vy += dy * dy
  }
  if (vx === 0 || vy === 0) return null
  return cov / Math.sqrt(vx * vy)
}

export function fuerzaCorrelacion(r) {
  const a = Math.abs(r)
  const fuerza = a < 0.2 ? 'débil' : a <= 0.4 ? 'moderada' : 'fuerte'
  const signo = r >= 0 ? 'positiva' : 'negativa'
  return `${fuerza} ${signo}`
}

// Escala de evaluación → 1..5. El orden de los tests importa ("muy buena"
// contiene "buena").
export function valorGestion(texto) {
  const t = normalizarTexto(texto || '')
  if (!t) return null
  if (/muy\s*buen|excelente/.test(t)) return 5
  if (/muy\s*mal|pesim/.test(t)) return 1
  if (/ni\s*buen.*ni\s*mal|regular|normal/.test(t)) return 3
  if (/buen|aprueba|positiv/.test(t)) return 4
  if (/mal|desaprueba|negativ/.test(t)) return 2
  return null
}

const N_MINIMO_CORRELACION = 30

// Claves alternativas por si la encuesta viene etiquetada con los nombres
// viejos/alternativos de la pregunta de gestión municipal.
const CLAVES_GESTION_INTENDENTE = ['evaluacion_gestion_intendente', 'gestion_intendente', 'evaluacion_municipal']

export function correlacionGestionVoto(ctx, clavesGestion = CLAVES_GESTION_INTENDENTE, claveCand = 'candidato_intendente') {
  const pGestion = clavesGestion.map(c => preguntaEspecial(ctx, c)).find(Boolean)
  const pCand = preguntaEspecial(ctx, claveCand)
  if (!pGestion || !pCand || !ctx.crudo) return null
  const pParticipa = preguntaEspecial(ctx, 'participa')
  const opciones = opcionesDe(pCand)
  const pSeg = buscarSeguimientoOtro(ctx.preguntas, pCand)

  const pares = []
  for (const fila of ctx.crudo.filas || []) {
    if (!esCompletada(fila, pParticipa)) continue
    const g = valorGestion(fila.respuestas?.[String(pGestion.id)])
    if (g == null) continue
    const cand = valorFusionadoConSeguimiento(fila, pCand, opciones, pSeg)
    if (!cand) continue
    pares.push({ g, cand })
  }
  if (pares.length < N_MINIMO_CORRELACION) return null

  const xs = pares.map(p => p.g)
  const candidatos = opciones.filter(o => !esOpcionIndecisa(o) && normalizarTexto(o) !== 'otro' && o !== OTRO_SIN_IDENTIFICAR)
  const porCandidato = candidatos.map(c => {
    const ys = pares.map(p => (p.cand === c ? 1 : 0))
    const r = pearson(xs, ys)
    return r == null ? null : { candidato: c, r, fuerza: fuerzaCorrelacion(r), votos: ys.reduce((a, b) => a + b, 0) }
  }).filter(Boolean).sort((a, b) => b.r - a.r)
  if (!porCandidato.length) return null

  const oficialista = porCandidato[0]
  // Puntos del scatter: por cada nivel de evaluación, % que vota al
  // oficialista (un scatter binario crudo sería ilegible).
  const puntos = [1, 2, 3, 4, 5].map(nivel => {
    const grupo = pares.filter(p => p.g === nivel)
    const votan = grupo.filter(p => p.cand === oficialista.candidato).length
    return { nivel, n: grupo.length, pct: grupo.length ? Math.round((votan / grupo.length) * 1000) / 10 : null }
  })

  return { n: pares.length, preguntaGestion: pGestion.texto, oficialista, porCandidato, puntos }
}

export const ETIQUETAS_GESTION = { 1: 'Muy mala', 2: 'Mala', 3: 'Regular', 4: 'Buena', 5: 'Muy buena' }
