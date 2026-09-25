// Análisis de no-respuesta selectiva: en zonas con mucho rechazo, ¿los que
// SÍ respondieron tienen un perfil (edad/género) distinto del promedio de la
// encuesta? Si difieren mucho, los que rechazaron probablemente tampoco se
// parecen a los que respondieron y la zona queda sesgada.

import { preguntaEspecial, opcionesDe, esCompletada, valorFusionado } from './reportesAutomaticos'

export const UMBRAL_RECHAZO = 25
export const MIN_COMPLETADAS_ZONA = 20
const UMBRAL_DIFERENCIA_PP = 10

function distribucion(filas, pregunta, opciones) {
  const conteo = {}
  let total = 0
  filas.forEach(f => {
    const v = valorFusionado(f, pregunta, opciones)
    if (!v) return
    conteo[v] = (conteo[v] || 0) + 1
    total++
  })
  return { conteo, total }
}

// ctx = { preguntas, crudo, overrides }; statsZona = get_stats_por_zona.
// Devuelve { [zona_id]: { tasa, completadas, desvios: [...], mensaje } }
// solo para zonas con rechazo > 25% y ≥ 20 completadas con algún desvío > 10pp.
export function noRespuestaSelectiva(ctx, statsZona) {
  if (!ctx?.crudo || !statsZona?.por_zona) return {}
  const pParticipa = preguntaEspecial(ctx, 'participa')
  const variables = [['edad', 'edad'], ['sexo', 'género']]
    .map(([clave, nombre]) => {
      const p = preguntaEspecial(ctx, clave)
      return p ? { p, nombre, opciones: opcionesDe(p) } : null
    })
    .filter(Boolean)
  if (!variables.length) return {}

  const completadas = (ctx.crudo.filas || []).filter(f => esCompletada(f, pParticipa))
  const globales = variables.map(v => distribucion(completadas, v.p, v.opciones))

  const out = {}
  for (const z of statsZona.por_zona) {
    if (!z.zona_id || !z.total) continue
    const tasa = Math.round(((z.no_respuesta || 0) / z.total) * 1000) / 10
    if (tasa <= UMBRAL_RECHAZO) continue
    const filasZona = completadas.filter(f => f.zona_id === z.zona_id)
    if (filasZona.length < MIN_COMPLETADAS_ZONA) continue

    const desvios = []
    variables.forEach((v, i) => {
      const local = distribucion(filasZona, v.p, v.opciones)
      const global = globales[i]
      if (!local.total || !global.total) return
      v.opciones.forEach(op => {
        const pl = ((local.conteo[op] || 0) / local.total) * 100
        const pg = ((global.conteo[op] || 0) / global.total) * 100
        const diff = Math.round((pl - pg) * 10) / 10
        if (Math.abs(diff) > UMBRAL_DIFERENCIA_PP) desvios.push({ variable: v.nombre, categoria: op, diff })
      })
    })
    if (!desvios.length) continue
    desvios.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    const d = desvios[0]
    const mensaje = `⚠️ ${z.zona_nombre}: los que rechazaron pueden no ser representativos — hay ${d.diff > 0 ? 'sobrerrepresentación' : 'subrepresentación'} de "${d.categoria}" entre los que respondieron (${d.diff > 0 ? '+' : ''}${d.diff}pp vs promedio).`
    out[z.zona_id] = { tasa, completadas: filasZona.length, desvios, mensaje }
  }
  return out
}
