// Detección de straightlining: sesiones donde TODAS las preguntas de escala
// de evaluación (opciones Muy buena/Buena/Regular/Mala/Muy mala) tienen la
// misma respuesta. Solo marca para revisión — no descarta nada.

import { normalizarTexto } from './fuzzyMatch'
import { preguntaEspecial, esCompletada } from './reportesAutomaticos'

const PASOS_ESCALA = [/muy\s*buen|excelente/, /muy\s*mal|pesim/, /^buen/, /^mal/, /regular|ni\s*buen/]

// Pregunta con opciones de escala de evaluación: al menos 3 de los 5 pasos
// presentes entre sus opciones (mismo criterio que esEscalaLike en
// ReporteVisualZona.jsx).
export function esPreguntaEscalaEvaluacion(p) {
  if (p?.tipo !== 'opcion_multiple') return false
  const textos = (p.opciones_pregunta || []).map(o => normalizarTexto(o.texto || ''))
  return PASOS_ESCALA.filter(re => textos.some(t => re.test(t))).length >= 3
}

// Con menos de 3 preguntas de escala respondidas, coincidir en todas es
// demasiado común para ser señal.
const MIN_PREGUNTAS_ESCALA = 3
export const UMBRAL_ALERTA_PCT = 20

export function detectarStraightlining(ctx) {
  const escalas = (ctx?.preguntas || []).filter(esPreguntaEscalaEvaluacion)
  if (escalas.length < MIN_PREGUNTAS_ESCALA || !ctx?.crudo) return null
  const pParticipa = preguntaEspecial(ctx, 'participa')

  const porEncuestador = {}
  for (const fila of ctx.crudo.filas || []) {
    if (!esCompletada(fila, pParticipa)) continue
    const nombre = fila.encuestador || '—'
    porEncuestador[nombre] = porEncuestador[nombre] || { encuestador: nombre, completadas: 0, sospechosas: 0 }
    porEncuestador[nombre].completadas++
    const valores = escalas.map(p => fila.respuestas?.[String(p.id)]).filter(Boolean).map(normalizarTexto)
    if (valores.length >= MIN_PREGUNTAS_ESCALA && valores.every(v => v === valores[0])) porEncuestador[nombre].sospechosas++
  }
  const filas = Object.values(porEncuestador)
    .map(e => ({ ...e, pct: e.completadas ? Math.round((e.sospechosas / e.completadas) * 1000) / 10 : 0 }))
    .sort((a, b) => b.pct - a.pct)
  const alertas = filas.filter(e => e.pct > UMBRAL_ALERTA_PCT)
  return { preguntasEscala: escalas.length, filas, alertas }
}
