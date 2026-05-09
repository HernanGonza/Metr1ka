import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'
import { cacheGet, cacheSet, cacheClear } from '../../lib/cache'
import styles from './Page.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler)

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: 'var(--warning-light)' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: 'var(--info-light)' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: 'var(--accent-light)' },
}

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
                  fontFamily: 'Syne', 
                  fontSize: 15, 
                  fontWeight: 800, 
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

function PreguntaChart({ pregunta, filas, paletaIdx }) {
  const { tipo } = pregunta
  const paleta = PALETAS[paletaIdx % PALETAS.length]
  const colorPrincipal = paleta[0]

  // === MANEJO ESPECIAL PARA PREGUNTAS DE TIPO MATRIZ ===
  if (tipo === 'matriz') {
    const totalRespuestas = (filas || []).reduce((sum, f) => sum + Number(f.cantidad || 1), 0)

    return (
      <div style={{ 
        background: 'var(--paper)', 
        border: '1px solid var(--border)', 
        borderRadius: 'var(--r2)', 
        padding: '20px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: colorPrincipal, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{pregunta.texto}</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
              Matriz · {totalRespuestas} respuestas
            </div>
          </div>
        </div>

        <MatrizTabla 
          pregunta={pregunta} 
          filas={filas || []} 
          color={colorPrincipal} 
        />
      </div>
    )
  }

  // === CÓDIGO ORIGINAL PARA EL RESTO DE TIPOS ===
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
        y: { beginAtZero: true, grid: { color: '#f0f0f0' }, ticks: { stepSize: 1, font: { family: 'DM Sans', size: 11 } } },
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

function VistaProduccion({ encuesta, preguntas }) {
  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 'var(--r2)', padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4 }}>Estado: {cfg.label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
          {encuesta.estado_produccion === 'pendiente'    && 'Tu solicitud fue recibida. Nuestro equipo está trabajando en el diseño.'}
          {encuesta.estado_produccion === 'en_proceso'   && 'Estamos armando las preguntas y configurando la encuesta.'}
          {encuesta.estado_produccion === 'para_revisar' && 'La encuesta está lista para tu revisión y aprobación.'}
        </div>
      </div>
      {encuesta.descripcion && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 6 }}>Descripción</div>
          <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{encuesta.descripcion}</div>
        </div>
      )}
      {(encuesta.fecha_inicio || encuesta.fecha_fin) && (
        <div style={{ background: 'var(--accent-light)', border: '1px solid #b7e4c7', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>📅 Programación</span>
          {encuesta.fecha_inicio && (
            <span style={{ fontSize: 13, color: 'var(--accent2)' }}>
              Inicio: <strong>{new Date(encuesta.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </span>
          )}
          {encuesta.fecha_fin && (
            <span style={{ fontSize: 13, color: 'var(--accent2)' }}>
              Cierre: <strong>{new Date(encuesta.fecha_fin + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </span>
          )}
        </div>
      )}
      {preguntas.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 12 }}>Vista previa — {preguntas.length} preguntas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {preguntas.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.texto}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                    {p.tipo === 'escala' && 'Escala 1-10'}
                    {p.tipo === 'si_no' && 'Sí / No'}
                    {p.tipo === 'opcion_multiple' && `Opción múltiple (${p.opciones_pregunta?.length || 0} opciones)`}
                    {p.tipo === 'texto_libre' && 'Respuesta libre'}
                    {!p.requerida && ' · Opcional'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VistaResultados({ preguntas, resumen, respuestas, encuestadores, equipos, filtros, onFiltroChange, loadingR }) {
  const [vista, setVista] = useState('resumen')

  const filasPorPregunta = useMemo(() => {
    const map = {}
    preguntas.forEach(p => { map[String(p.id)] = [] })
    // Incluir TODAS las respuestas, incluso de preguntas base (participa, edad, etc.)
    respuestas.forEach(f => {
      if (!map[String(f.pregunta_id)]) map[String(f.pregunta_id)] = []
      map[String(f.pregunta_id)].push(f)
    })
    return map
  }, [respuestas, preguntas])

  // Razones de no respuesta (pregunta con clave_base = 'participa', valores != 'Sí')
  const razonesNoResp = useMemo(() => {
    const pregParticipa = preguntas.find(p => p.clave_base === 'participa')
    if (!pregParticipa) return []
    const filas = filasPorPregunta[String(pregParticipa.id)] || []
    return filas.filter(f => f.valor_texto && f.valor_texto !== 'Sí')
  }, [preguntas, filasPorPregunta])

  const encuestadoresFiltrados = useMemo(() =>
    filtros.equipo_id ? encuestadores.filter(e => e.equipo_id === filtros.equipo_id) : encuestadores,
    [encuestadores, filtros.equipo_id]
  )

  const kpis = [
    { label: 'Respuestas',       value: resumen?.total_participaron   || 0, color: 'var(--accent)',  border: '#1a472a' },
    { label: 'Encuestadores',    value: resumen?.encuestadores    || 0, color: '#0369a1',         border: '#0369a1' },
    { label: 'Equipos activos',  value: resumen?.equipos          || 0, color: '#7c3aed',         border: '#7c3aed' },
    { label: 'Última respuesta', value: resumen?.ultima_respuesta ? new Date(resumen.ultima_respuesta).toLocaleDateString('es-AR') : '—', color: '#b45309', border: '#b45309' },
  ]

  const hayFiltros = filtros.equipo_id || filtros.encuestador_id || filtros.fecha_desde || filtros.fecha_hasta
  const inp = { padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--paper)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', borderTop: `3px solid ${k.border}` }}>
            <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Equipo</label>
          <select value={filtros.equipo_id || ''} onChange={e => onFiltroChange('equipo_id', e.target.value || null)} style={inp}>
            <option value="">Todos</option>
            {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Encuestador</label>
          <select value={filtros.encuestador_id || ''} onChange={e => onFiltroChange('encuestador_id', e.target.value || null)} disabled={!filtros.equipo_id} style={inp}>
            <option value="">Todos</option>
            {encuestadoresFiltrados.map(e => <option key={e.encuestador_id} value={e.encuestador_id}>{e.nombre_completo}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Desde</label>
          <input type="date" value={filtros.fecha_desde || ''} onChange={e => onFiltroChange('fecha_desde', e.target.value || null)} style={inp} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Hasta</label>
          <input type="date" value={filtros.fecha_hasta || ''} onChange={e => onFiltroChange('fecha_hasta', e.target.value || null)} style={inp} />
        </div>
        {hayFiltros && <button onClick={() => onFiltroChange('_reset', null)} style={{ ...inp, cursor: 'pointer', alignSelf: 'flex-end' }}>Limpiar</button>}
        {loadingR && <span style={{ fontSize: 11, color: 'var(--ink3)', alignSelf: 'flex-end', paddingBottom: 8 }}>Actualizando...</span>}
      </div>

      {/* Razones de no respuesta */}
      {razonesNoResp.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '1px solid #fca5a5', borderRadius: 'var(--r2)', padding: '14px 18px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            📋 Razones de no-respuesta — {razonesNoResp.reduce((s, f) => s + Number(f.cantidad), 0)} registros
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {razonesNoResp.map((f, i) => (
              <div key={i} style={{ background: 'var(--danger-light)', borderRadius: 'var(--r)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#c0392b', fontWeight: 600 }}>{f.valor_texto}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', fontFamily: 'Syne' }}>{f.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
        {[['resumen','Resumen'],['preguntas','Por pregunta'],['encuestadores','Encuestadores']].map(([v, label]) => (
          <button key={v} onClick={() => setVista(v)} style={{
            padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontFamily: 'DM Sans', marginBottom: -1,
            fontWeight: vista === v ? 700 : 400,
            color: vista === v ? 'var(--accent)' : 'var(--ink3)',
            borderBottom: vista === v ? '2px solid var(--accent)' : '2px solid transparent',
          }}>{label}</button>
        ))}
      </div>

      {vista === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
          {preguntas.filter(p => !p.clave_base || p.clave_base === 'edad' || p.clave_base === 'sexo').slice(0, 4).map((p, i) => (
            <PreguntaChart key={p.id} pregunta={p} filas={filasPorPregunta[String(p.id)] || []} paletaIdx={i} />
          ))}
        </div>
      )}

      {vista === 'preguntas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {preguntas.filter(p => p.clave_base !== 'participa').map((p, i) => (
            <PreguntaChart key={p.id} pregunta={p} filas={filasPorPregunta[String(p.id)] || []} paletaIdx={i} />
          ))}
        </div>
      )}

      {vista === 'encuestadores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onFiltroChange('equipo_id', null)}
                style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${!filtros.equipo_id ? 'var(--accent)' : 'var(--border2)'}`, background: !filtros.equipo_id ? 'var(--accent-light)' : 'var(--paper)', color: !filtros.equipo_id ? 'var(--accent)' : 'var(--ink3)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Todos
              </button>
              {equipos.map(eq => (
                <button key={eq.id} onClick={() => onFiltroChange('equipo_id', eq.id)}
                  style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${filtros.equipo_id === eq.id ? 'var(--accent)' : 'var(--border2)'}`, background: filtros.equipo_id === eq.id ? 'var(--accent-light)' : 'var(--paper)', color: filtros.equipo_id === eq.id ? 'var(--accent)' : 'var(--ink3)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                  {eq.nombre}
                </button>
              ))}
            </div>
          )}
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>Encuestador</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>Equipo</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>Sesiones</th>
                </tr>
              </thead>
              <tbody>
                {encuestadoresFiltrados.map((enc, i) => (
                  <tr key={enc.encuestador_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--paper)' : 'var(--surface)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{enc.nombre_completo}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--ink3)' }}>{enc.equipo_nombre || '—'}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--accent)', textAlign: 'right' }}>{enc.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EncuestaDetalle() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { perfil } = useAuth()

  const [encuesta,      setEncuesta]      = useState(null)
  const [preguntas,     setPreguntas]     = useState([])
  const [resumen,       setResumen]       = useState(null)
  const [respuestas,    setRespuestas]    = useState([])
  const [encuestadores, setEncuestadores] = useState([])
  const [equipos,       setEquipos]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadingR,      setLoadingR]      = useState(false)
  const [error,         setError]         = useState('')

  const [filtroEquipo,      setFiltroEquipo]      = useState(null)
  const [filtroEncuestador, setFiltroEncuestador] = useState(null)
  const [filtroDesde,       setFiltroDesde]       = useState(null)
  const [filtroHasta,       setFiltroHasta]       = useState(null)

  const filtrosKey = `${filtroEquipo || ''}-${filtroEncuestador || ''}-${filtroDesde || ''}-${filtroHasta || ''}`
  const hayFiltros = filtroEquipo || filtroEncuestador || filtroDesde || filtroHasta
  const filtros    = { equipo_id: filtroEquipo, encuestador_id: filtroEncuestador, fecha_desde: filtroDesde, fecha_hasta: filtroHasta }

  useEffect(() => {
    if (perfil?.organizacion_id && id) fetchBase()
  }, [id, perfil?.organizacion_id])

  // Realtime — escuchar nuevas sesiones y actualizar contadores + gráficos sin recargar estructura
  useEffect(() => {
    if (!id || !perfil?.organizacion_id) return

    let debounce = null

    async function recargarRespuestas() {
      // Siempre ir a la DB — ignorar cache para actualizaciones en tiempo real
      try {
        const { data } = await supabase.rpc('get_encuesta_full', {
          p_encuesta_id: id,
          p_org_id: perfil.organizacion_id,
          p_equipo_id: null, p_encuestador_id: null,
          p_fecha_desde: null, p_fecha_hasta: null,
        })
        if (data && !data.error) {
          // Solo actualizar resumen y respuestas — NO encuesta ni preguntas (no cambian)
          if (data.resumen)     setResumen(data.resumen)
          if (data.respuestas)  setRespuestas(data.respuestas)
          if (data.encuestadores) setEncuestadores(data.encuestadores)
          // Actualizar cache también
          cacheClear(`enc_base:${id}`)
          cacheClear(`enc_resp:${id}:base`)
          cacheSet(`enc_resp:${id}:base`, data.respuestas || [], 60_000)
        }
      } catch (e) { console.error('[realtime reload]', e) }
    }

    const channel = supabase
      .channel(`encuesta-live-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sesiones_respuesta',
      }, () => {
        // Debounce 800ms para no recargar por cada respuesta de un batch
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(recargarRespuestas, 800)
      })
      .subscribe((status) => {
        console.log('[realtime encuesta-detalle]', status)
      })

    // Polling cada 20s como fallback (más agresivo que 30s)
    const interval = setInterval(recargarRespuestas, 20_000)

    return () => {
      if (debounce) clearTimeout(debounce)
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [id, perfil?.organizacion_id])

  const debounceRef = useRef(null)
  useEffect(() => {
    if (!encuesta || encuesta.estado_produccion !== 'publicada') return
    if (!hayFiltros) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRespuestas(), 300)
    return () => clearTimeout(debounceRef.current)
  }, [filtrosKey, encuesta?.id])

  async function fetchBase() {
    const cacheKey = `enc_base:${id}`
    const cached   = cacheGet(cacheKey)
    if (cached) {
      setEncuesta(cached.encuesta); setPreguntas(cached.preguntas)
      setResumen(cached.resumen);   setEncuestadores(cached.encuestadores)
      setEquipos(cached.equipos);   setRespuestas(cacheGet(`enc_resp:${id}:base`) || [])
      setLoading(false); return
    }
    setLoading(true); setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: id, p_org_id: perfil.organizacion_id,
      })
      if (rpcErr) throw rpcErr
      if (!data || data.error === 'not_found') { navigate('/encuestas'); return }
      const payload = {
        encuesta: data.encuesta, preguntas: data.preguntas || [],
        resumen: data.resumen || null, encuestadores: data.encuestadores || [], equipos: data.equipos || [],
      }
      cacheSet(cacheKey, payload, 300_000)
      const respBase = data.respuestas || []
      cacheSet(`enc_resp:${id}:base`, respBase, 300_000)
      setEncuesta(payload.encuesta); setPreguntas(payload.preguntas)
      setResumen(payload.resumen);   setEncuestadores(payload.encuestadores)
      setEquipos(payload.equipos);   setRespuestas(respBase)
    } catch (e) { console.error(e); setError(e.message) }
    setLoading(false)
  }

  async function fetchRespuestas() {
    if (!id) return
    const cacheKey = `enc_resp:${id}:${filtrosKey}`
    const cached   = cacheGet(cacheKey)
    if (cached) { setRespuestas(cached); return }
    setLoadingR(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: id, p_org_id: perfil.organizacion_id,
        p_equipo_id: filtroEquipo || null, p_encuestador_id: filtroEncuestador || null,
        p_fecha_desde: filtroDesde || null, p_fecha_hasta: filtroHasta || null,
      })
      if (rpcErr) throw rpcErr
      const result = data?.respuestas || []
      if (result.length > 0) cacheSet(cacheKey, result, 300_000)
      setRespuestas(result)
    } catch (e) { console.error('fetchRespuestas:', e) }
    setLoadingR(false)
  }

  function handleFiltroChange(campo, valor) {
    if (campo === '_reset') {
      setFiltroEquipo(null); setFiltroEncuestador(null); setFiltroDesde(null); setFiltroHasta(null)
      const base = cacheGet(`enc_resp:${id}:base`)
      if (base) setRespuestas(base)
      return
    }
    if (campo === 'equipo_id')      { setFiltroEquipo(valor); setFiltroEncuestador(null); return }
    if (campo === 'encuestador_id') { setFiltroEncuestador(valor); return }
    if (campo === 'fecha_desde')    { setFiltroDesde(valor); return }
    if (campo === 'fecha_hasta')    { setFiltroHasta(valor); return }
  }

  if (loading) return (
    <div className={styles.page}>
      <Topbar title="Encuesta" back={{ label: 'Volver', onClick: () => navigate('/encuestas') }} />
      <div className={styles.content} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spinner center size="lg" />
      </div>
    </div>
  )
  if (!encuesta) return null

  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente

  return (
    <div className={styles.page}>
      <Topbar
        title={encuesta.nombre}
        back={{ label: 'Encuestas', onClick: () => navigate('/encuestas') }}
        badge={{ label: cfg.label, color: cfg.color, bg: cfg.bg }}
        action={encuesta.estado_produccion === 'publicada' ? {
  label: '↻ Actualizar',
  onClick: () => {
    cacheClear(`enc_base:${id}`)
    cacheClear(`enc_resp:${id}`)
    fetchBase()
  }
} : null}
      />
      <div className={styles.content}>
        {error && <div style={{ padding: '10px 16px', background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: 'var(--r)', fontSize: 13, color: '#c0392b', marginBottom: 12 }}>Error: {error}</div>}
        {encuesta.estado_produccion === 'publicada'
          ? <VistaResultados preguntas={preguntas} resumen={resumen} respuestas={respuestas}
              encuestadores={encuestadores} equipos={equipos} filtros={filtros}
              onFiltroChange={handleFiltroChange} loadingR={loadingR} />
          : <VistaProduccion encuesta={encuesta} preguntas={preguntas} />
        }
      </div>
    </div>
  )
}