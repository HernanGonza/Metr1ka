import { useState, useMemo } from 'react'
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler)

// Extraído de EncuestaDetalle.jsx (pantalla de resultados de campo) para
// poder reusarlo tal cual en la pantalla de resultados de encuestas online
// — el desglose por pregunta es idéntico para ambos tipos de encuesta.

// Paleta variada — cada índice de pregunta recibe colores distintos
const PALETAS = [
  ['#1a472a','#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2'],
  ['#0369a1','#0284c7','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd'],
  ['#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#6d28d9','#5b21b6'],
  ['#b45309','#d97706','#f59e0b','#fbbf24','#fcd34d','#fde68a'],
  ['#be185d','#db2777','#ec4899','#f472b6','#f9a8d4','#fce7f3'],
  ['#047857','#059669','#10b981','#34d399','#6ee7b7','#a7f3d0'],
]

const TIPOS_GRAFICO = [
  { value: 'bar',      label: '▌ Barras' },
  { value: 'pie',      label: '◕ Torta' },
  { value: 'doughnut', label: '◎ Rosquilla' },
  { value: 'line',     label: '↗ Líneas' },
]

const DEFAULT_TIPO = {
  si_no:           'doughnut',
  escala:          'bar',
  opcion_multiple: 'bar',
  texto_libre:     null,
}

/* ── Tabla para preguntas de tipo Matriz ── */
function MatrizTabla({ pregunta, filas, color }) {
  const filasDef    = (pregunta.config_matriz?.filas    || []).map(f => typeof f === 'string' ? f : f.texto || f)
  const columnasDef = (pregunta.config_matriz?.columnas || []).map(c => typeof c === 'string' ? c : c.texto || c)

  const conteo = {}
  filasDef.forEach(f => {
    conteo[f] = {}
    columnasDef.forEach(c => { conteo[f][c] = 0 })
  })

  filas.forEach(resp => {
    try {
      const val = typeof resp.valor_texto === 'string'
        ? JSON.parse(resp.valor_texto)
        : resp.valor_texto

      if (val && typeof val === 'object') {
        Object.entries(val).forEach(([fi, col]) => {
          const filaTexto = isNaN(Number(fi)) ? fi : filasDef[Number(fi)]
          if (filaTexto && conteo[filaTexto] && columnasDef.includes(col)) {
            conteo[filaTexto][col] = (conteo[filaTexto][col] || 0) + Number(resp.cantidad || 1)
          }
        })
      }
    } catch (e) {
      console.warn('Error parseando respuesta de matriz:', e)
    }
  })

  if (!filasDef.length || !columnasDef.length) {
    return (
      <div style={{
        color: 'var(--ink3)',
        fontSize: 13,
        padding: '40px 0',
        textAlign: 'center'
      }}>
        Sin configuración de matriz
      </div>
    )
  }

  const totalesFila = filasDef.map(f =>
    columnasDef.reduce((s, c) => s + (conteo[f]?.[c] || 0), 0)
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontSize: 12,
        width: '100%',
        minWidth: `${columnasDef.length * 85 + 200}px`
      }}>
        <thead>
          <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
            <th style={{
              padding: '10px 14px',
              textAlign: 'left',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ink3)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              width: 200
            }} />
            {columnasDef.map(col => (
              <th key={col} style={{
                padding: '10px 12px',
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--ink3)',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                {col}
              </th>
            ))}
            <th style={{
              padding: '10px 12px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--ink3)'
            }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {filasDef.map((fila, fi) => {
            const totalFila = totalesFila[fi]
            return (
              <tr key={fi} style={{
                borderBottom: '1px solid var(--border)',
                background: fi % 2 === 0 ? 'var(--paper)' : 'var(--surface)'
              }}>
                <td style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  verticalAlign: 'middle'
                }}>
                  {fila}
                </td>
                {columnasDef.map(col => {
                  const n = conteo[fila]?.[col] || 0
                  const pct = totalFila > 0 ? Math.round(n / totalFila * 100) : 0
                  return (
                    <td key={col} style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: n > 0 ? color : 'var(--ink3)'
                      }}>
                        {n}
                      </div>
                      {n > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>
                          {pct}%
                        </div>
                      )}
                    </td>
                  )
                })}
                <td style={{
                  padding: '10px 12px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-num)',
                  fontSize: 13,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ink2)'
                }}>
                  {totalFila}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PreguntaMatriz({ pregunta, filas, paletaIdx }) {
  const colorPrincipal = PALETAS[paletaIdx % PALETAS.length][0]
  const totalRespuestas = (filas || []).reduce((sum, f) => sum + Number(f.cantidad || 1), 0)
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorPrincipal, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{pregunta.texto}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>Matriz · {totalRespuestas} respuestas</div>
        </div>
      </div>
      <MatrizTabla pregunta={pregunta} filas={filas || []} color={colorPrincipal} />
    </div>
  )
}

function PreguntaChartBase({ pregunta, filas, paletaIdx }) {
  const { tipo } = pregunta
  const paleta = PALETAS[paletaIdx % PALETAS.length]
  const opciones  = pregunta.opciones_pregunta || []
  const [tipoGrafico, setTipoGrafico] = useState(DEFAULT_TIPO[tipo] || 'bar')

  const datos = useMemo(() => {
    if (tipo === 'texto_libre') return null
    const conteo = {}

    if (tipo === 'si_no') {
      filas.forEach(f => {
        let key = null
        if (f.valor_texto === 'Sí' || f.valor_booleano === true)  key = 'Sí'
        if (f.valor_texto === 'No' || f.valor_booleano === false)  key = 'No'
        if (key) conteo[key] = (conteo[key] || 0) + Number(f.cantidad)
      })
      if (!('Sí' in conteo)) conteo['Sí'] = 0
      if (!('No' in conteo)) conteo['No'] = 0

    } else if (tipo === 'escala') {
      const valores = [...new Set(filas.map(f => Number(f.valor_numero)).filter(v => !isNaN(v) && v > 0))].sort((a,b) => a-b)
      valores.forEach(v => {
        const fila = filas.find(f => Number(f.valor_numero) === v)
        conteo[String(v)] = fila ? Number(fila.cantidad) : 0
      })

    } else if (tipo === 'opcion_multiple' || tipo === 'opcion_simple') {
      opciones.forEach(op => {
        const fila = filas.find(f =>
          f.valor_texto === op.texto ||
          f.opcion_texto === op.texto ||
          f.opcion_id === op.id
        )
        conteo[op.texto] = fila ? Number(fila.cantidad) : 0
      })

    } else {
      return null
    }

    const labels = Object.keys(conteo)
    const values = Object.values(conteo)
    const total  = values.reduce((a, b) => a + b, 0)
    if (total === 0) return null

    const isPie  = tipoGrafico === 'pie' || tipoGrafico === 'doughnut'
    const isLine = tipoGrafico === 'line'
    const isBar  = tipoGrafico === 'bar'

    return {
      labels,
      datasets: [{
        label: pregunta.texto,
        data: values,
        backgroundColor: isPie
          ? paleta.slice(0, labels.length)
          : isLine
            ? `${paleta[0]}33`
            : paleta.slice(0, labels.length),
        borderColor: isLine ? paleta[0] : isPie ? '#fff' : undefined,
        borderWidth: isPie ? 2 : isLine ? 2.5 : 0,
        borderRadius: isBar ? 6 : 0,
        borderSkipped: false,
        fill: isLine,
        tension: 0.4,
        pointBackgroundColor: isLine ? paleta[0] : undefined,
        pointRadius: isLine ? 5 : undefined,
        pointHoverRadius: isLine ? 7 : undefined,
      }],
      total,
    }
  }, [filas, opciones, tipo, tipoGrafico, paleta, pregunta.texto])

  const chartOptions = useMemo(() => {
    const isPie  = tipoGrafico === 'pie' || tipoGrafico === 'doughnut'
    const total  = datos?.total || 1
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: isPie,
          position: 'bottom',
          labels: { font: { family: 'DM Sans', size: 11 }, padding: 14, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed?.y ?? ctx.parsed
              return ` ${ctx.label}: ${val} (${Math.round(val / total * 100)}%)`
            }
          },
          bodyFont: { family: 'DM Sans' },
          titleFont: { family: 'DM Sans' },
        },
      },
      scales: isPie ? {} : {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'var(--surface2)' }, ticks: { stepSize: 1, font: { family: 'DM Sans', size: 11 } } },
      },
    }
  }, [tipoGrafico, datos?.total])

  const card = { background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }
  const btnStyle = (v) => ({
    padding: '3px 10px', borderRadius: 100, fontSize: 11, fontFamily: 'DM Sans', cursor: 'pointer',
    border: `1.5px solid ${tipoGrafico === v ? paleta[0] : 'var(--border2)'}`,
    background: tipoGrafico === v ? `${paleta[0]}18` : 'var(--paper)',
    color: tipoGrafico === v ? paleta[0] : 'var(--ink3)',
    fontWeight: tipoGrafico === v ? 700 : 400,
    transition: 'all .15s',
  })

  // Texto libre
  if (tipo === 'texto_libre') {
    const textos = filas.filter(f => f.valor_texto?.trim())
    const total  = textos.reduce((s, f) => s + Number(f.cantidad), 0)
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: paleta[0], flexShrink: 0 }} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>{pregunta.texto}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{total} respuestas · texto libre</div>
        {textos.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Sin respuestas aún</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
              {textos.slice(0, 20).map((f, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: `${paleta[0]}10`, borderLeft: `3px solid ${paleta[0]}`, borderRadius: '0 var(--r) var(--r) 0', color: 'var(--ink2)' }}>
                  "{f.valor_texto}"
                </div>
              ))}
              {textos.length > 20 && <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>+ {textos.length - 20} más</div>}
            </div>
        }
      </div>
    )
  }

  const tiposDisponibles = tipo === 'escala' ? TIPOS_GRAFICO : TIPOS_GRAFICO.filter(t => t.value !== 'line')
  const ChartComp = { bar: Bar, pie: Pie, doughnut: Doughnut, line: Line }[tipoGrafico]
  const chartHeight = (tipoGrafico === 'pie' || tipoGrafico === 'doughnut') ? 220 : 190

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: paleta[0], flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{pregunta.texto}</div>
            {datos && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{datos.total} respuestas</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tiposDisponibles.map(t => (
            <button key={t.value} style={btnStyle(t.value)} onClick={() => setTipoGrafico(t.value)}>{t.label}</button>
          ))}
        </div>
      </div>
      {!datos
        ? <div style={{ fontSize: 13, color: 'var(--ink3)', padding: '20px 0', textAlign: 'center' }}>Sin respuestas aún</div>
        : <div style={{ height: chartHeight }}>
            <ChartComp data={datos} options={chartOptions} />
          </div>
      }
    </div>
  )
}

// Dispatcher — evita hooks condicionales: cada rama es su propio componente.
export default function PreguntaChart({ pregunta, filas, paletaIdx }) {
  if (pregunta.tipo === 'matriz') return <PreguntaMatriz pregunta={pregunta} filas={filas} paletaIdx={paletaIdx} />
  return <PreguntaChartBase pregunta={pregunta} filas={filas} paletaIdx={paletaIdx} />
}
