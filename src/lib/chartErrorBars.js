// Plugin mínimo de Chart.js para dibujar whiskers (intervalo de confianza
// al 95%) sobre barras — equivalente al <ErrorBar> de Recharts, que no es
// dependencia del proyecto. Se activa por dataset con
//   dataset.errorBars = [{ lo, hi }, …]   (en unidades del eje de valores)
// y se registra por gráfico: `plugins: [errorBarsPlugin]` (Chart.js) o
// `plugins={[errorBarsPlugin]}` (react-chartjs-2). No aplica a barras
// apiladas ni a tortas.

import { intervaloConfianza } from './margenError'

export const errorBarsPlugin = {
  id: 'errorBars',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const horizontal = chart.options.indexAxis === 'y'
    chart.data.datasets.forEach((ds, di) => {
      if (!ds.errorBars) return
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden || meta.type !== 'bar') return
      const escala = horizontal ? chart.scales[meta.xAxisID] : chart.scales[meta.yAxisID]
      if (!escala) return
      ctx.save()
      ctx.strokeStyle = 'rgba(17,24,39,0.75)'
      ctx.lineWidth = 1.5
      meta.data.forEach((bar, i) => {
        const eb = ds.errorBars[i]
        if (!eb || eb.hi <= eb.lo) return
        const lo = escala.getPixelForValue(eb.lo)
        const hi = escala.getPixelForValue(eb.hi)
        const centro = horizontal ? bar.y : bar.x
        const grosor = horizontal ? bar.height : bar.width
        const cap = Math.max(3, Math.min(7, (grosor || 12) / 4))
        ctx.beginPath()
        if (horizontal) {
          ctx.moveTo(lo, centro); ctx.lineTo(hi, centro)
          ctx.moveTo(lo, centro - cap); ctx.lineTo(lo, centro + cap)
          ctx.moveTo(hi, centro - cap); ctx.lineTo(hi, centro + cap)
        } else {
          ctx.moveTo(centro, lo); ctx.lineTo(centro, hi)
          ctx.moveTo(centro - cap, lo); ctx.lineTo(centro + cap, lo)
          ctx.moveTo(centro - cap, hi); ctx.lineTo(centro + cap, hi)
        }
        ctx.stroke()
      })
      ctx.restore()
    })
  },
}

// Whiskers en CONTEOS a partir de los conteos de cada opción y el total de
// respuestas de la pregunta (o zona): IC de la proporción × total.
export function errorBarsDeConteos(valores, total) {
  if (!total) return null
  return valores.map(v => {
    const ic = intervaloConfianza(total, v / total)
    return ic ? { lo: ic.lo * total, hi: ic.hi * total } : null
  })
}

// Máximo sugerido del eje de valores para que el whisker superior no quede
// recortado por el borde del gráfico.
export function maxConWhiskers(errorBars) {
  const his = (errorBars || []).filter(Boolean).map(e => e.hi)
  return his.length ? Math.ceil(Math.max(...his)) : undefined
}
