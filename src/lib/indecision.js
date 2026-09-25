// Índice de indecisión para preguntas de intención de voto: suma de los %
// de NS/NC + voto en blanco + ninguno + "podría cambiar" / "todavía no
// decidió" (matching por texto de la opción, sin depender del orden).

import { normalizarTexto } from './fuzzyMatch'
import { preguntaEspecial, distribucionCompleta } from './reportesAutomaticos'

const RE_INDECISO = /no\s*sabe|no\s*contesta|ns\s*\/?\s*nc|blanco|ninguno|podria\s*cambiar|todavia\s*no\s*decid|no\s*decid|indecis/

export function esOpcionIndecisa(opcion) {
  return RE_INDECISO.test(normalizarTexto(opcion || ''))
}

export function nivelIndecision(pct) {
  if (pct < 15) return { label: 'Escenario consolidado', color: '#2d8f4e' }
  if (pct <= 30) return { label: 'Escenario abierto', color: '#b45309' }
  return { label: 'Alta volatilidad', color: '#c0392b' }
}

export const CARGOS_INDECISION = [
  { clave: 'candidato_intendente', nombre: 'Intendente' },
  { clave: 'candidato_gobernador', nombre: 'Gobernador' },
  { clave: 'candidato_presidente', nombre: 'Presidente' },
]

// ctx = { preguntas, crudo, overrides } (mismo ctx que calcularReporte).
// Devuelve una entrada por cargo presente en la encuesta con respuestas.
export function indicesIndecision(ctx) {
  if (!ctx?.crudo) return []
  const pParticipa = preguntaEspecial(ctx, 'participa')
  return CARGOS_INDECISION.map(({ clave, nombre }) => {
    const p = preguntaEspecial(ctx, clave)
    if (!p) return null
    const dist = distribucionCompleta(p, ctx.preguntas, ctx.crudo, pParticipa)
    if (!dist.total) return null
    const indecisas = dist.filas.filter(f => esOpcionIndecisa(f.opcion) && f.n > 0)
    const n = indecisas.reduce((s, f) => s + f.n, 0)
    const pct = Math.round((n / dist.total) * 1000) / 10
    return { cargo: nombre, pct, total: dist.total, opciones: indecisas.map(f => f.opcion), nivel: nivelIndecision(pct) }
  }).filter(Boolean)
}
