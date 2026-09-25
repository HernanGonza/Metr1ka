// Margen de error de una proporción (muestreo aleatorio simple, 95% de
// confianza por defecto). Todas las features estadísticas de reportes
// (panel de resumen, PDFs, whiskers de gráficos, tendencia entre
// encuestas) salen de acá — no recalcular la fórmula en otro lado.
//
// ME general de la encuesta: p = 0.5 (peor caso) sobre n completadas.
// ME específico de una opción: p = proporción observada de esa opción.

export const Z_95 = 1.96

export const margenError = (n, p = 0.5, z = Z_95) => {
  if (!n || n < 2) return null
  return z * Math.sqrt((p * (1 - p)) / n)
}

export const margenFormateado = (n, p = 0.5) => {
  const me = margenError(n, p)
  return me != null ? `±${(me * 100).toFixed(1)}%` : 'n/a'
}

export const nivelMuestra = (n) => {
  if (n < 100) return { label: 'Piloto', color: '#e74c3c' }
  if (n < 384) return { label: 'En construcción', color: '#e67e22' }
  if (n < 600) return { label: 'Suficiente', color: '#f1c40f' }
  if (n < 1067) return { label: 'Robusta', color: '#2ecc71' }
  return { label: 'Alta precisión', color: '#1a472a' }
}

// Suma de márgenes como criterio (conservador) de "la diferencia entre las
// dos proporciones supera el ruido de muestreo". p1/p2 en proporción (0–1).
export const diferenciaSignificativa = (n1, p1, n2, p2) => {
  const me1 = margenError(n1, p1)
  const me2 = margenError(n2, p2)
  if (me1 == null || me2 == null) return false
  return Math.abs(p1 - p2) > (me1 + me2)
}

// n necesario para llegar a un ME objetivo con p = 0.5. Redondeado (no
// ceil) para que coincida con los umbrales de referencia de la industria
// (±5% → 384, ±4% → 600, ±3% → 1067).
export const nNecesario = (meObjetivo, z = Z_95) => Math.round((z * z * 0.25) / (meObjetivo * meObjetivo))

// Intervalo de confianza de una opción, en proporción (0–1), recortado a [0, 1].
export const intervaloConfianza = (n, p) => {
  const me = margenError(n, p)
  if (me == null) return null
  return { lo: Math.max(0, p - me), hi: Math.min(1, p + me), me }
}

// Umbrales de referencia — se muestran siempre como leyenda (pantalla y PDF).
export const UMBRALES_MUESTRA = [
  { desde: 0,    rango: '> ±9.8%',       texto: 'Muestra piloto, resultados orientativos' },
  { desde: 100,  rango: '±5% a ±9.8%',   texto: 'Muestra en construcción' },
  { desde: 384,  rango: '≤ ±5%',         texto: 'Muestra suficiente' },
  { desde: 600,  rango: '≤ ±4%',         texto: 'Muestra robusta' },
  { desde: 1067, rango: '≤ ±3%',         texto: 'Muestra de alta precisión' },
]

// Metas intermedias para la barra de progreso del panel de resumen.
export const METAS_ME = [0.05, 0.04, 0.03].map(me => ({ me, n: nNecesario(me) }))
