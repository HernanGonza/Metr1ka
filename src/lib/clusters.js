// Distribución geográfica del voto (clusters territoriales), versión
// simplificada: para cada candidato, qué parte de sus votos viene de las 3
// zonas donde más votos sacó. > 60% → concentrado, < 40% → disperso.
//
// Ojo: la medida no corrige por el tamaño de muestra de cada zona (una zona
// con muchas encuestas aporta muchos votos a todos). Es la metodología
// pedida; para un análisis fino habría que comparar contra el peso de cada
// zona en la muestra.

import { esOpcionIndecisa } from './indecision'

const TOP_ZONAS = 3
const UMBRAL_CONCENTRADO = 60
const UMBRAL_DISPERSO = 40
const VOTOS_MINIMOS = 10

// porZona: { [zonaId]: { [opcion]: n } }; nombres: { [zonaId]: nombre }.
// Devuelve null si hay 3 zonas o menos (con ≤ 3 zonas el 100% de los votos
// sale siempre de "las 3 principales" y la medida no dice nada).
export function analizarClusters(porZona, nombres) {
  const zonaIds = Object.keys(porZona || {})
  if (zonaIds.length <= TOP_ZONAS) return null
  const opciones = new Set(zonaIds.flatMap(z => Object.keys(porZona[z])))
  const candidatos = [...opciones]
    .filter(op => op !== 'Otros' && !esOpcionIndecisa(op))
    .map(op => {
      const porZonaCand = zonaIds.map(z => ({ zona: nombres[z] || z, n: porZona[z][op] || 0 })).sort((a, b) => b.n - a.n)
      const total = porZonaCand.reduce((s, z) => s + z.n, 0)
      if (total < VOTOS_MINIMOS) return null
      const top = porZonaCand.slice(0, TOP_ZONAS)
      const pctTop = Math.round((top.reduce((s, z) => s + z.n, 0) / total) * 100)
      const zonasPresente = porZonaCand.filter(z => z.n > 0).length
      const tipo = pctTop > UMBRAL_CONCENTRADO ? 'concentrado' : pctTop < UMBRAL_DISPERSO ? 'disperso' : 'intermedio'
      return { candidato: op, total, pctTop, zonasTop: top.map(z => z.zona), zonasPresente, totalZonas: zonaIds.length, tipo }
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)
  if (!candidatos.length) return null
  return { candidatos, sintesis: candidatos.map(textoCluster).join(' ') }
}

export function textoCluster(c) {
  if (c.tipo === 'concentrado') {
    return `${c.candidato} tiene apoyo concentrado territorialmente: el ${c.pctTop}% de sus votos viene de ${c.zonasTop.join(', ')}.`
  }
  if (c.tipo === 'disperso') {
    return `${c.candidato} tiene apoyo disperso — está presente en ${c.zonasPresente} de ${c.totalZonas} zonas y sus 3 zonas principales aportan solo el ${c.pctTop}% de sus votos.`
  }
  return `${c.candidato} tiene un apoyo intermedio: el ${c.pctTop}% de sus votos viene de ${c.zonasTop.join(', ')}.`
}
