import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import Chart from 'chart.js/auto'
import styles from './Page.module.css'
import { BarChart2, PieChart, FileText, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Zap, Plus, Trash2, MapPin } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const PALETA = ['#1a472a','#0369a1','#7c3aed','#b45309','#be185d','#047857','#2d6a4f','#0284c7','#dc2626','#d97706']

/* ── Componente de gráfico individual ── */
function MiniChart({ pregunta, filas, tipo = 'bar', color = '#1a472a' }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  const datos = useMemo(() => {
    if (!filas?.length) return null
    const conteo = {}
    if (pregunta.tipo === 'si_no') {
      filas.forEach(f => {
        const key = f.valor_texto === 'Sí' || f.valor_booleano === true ? 'Sí' : 'No'
        conteo[key] = (conteo[key] || 0) + Number(f.cantidad)
      })
    } else if (pregunta.tipo === 'escala') {
      filas.forEach(f => {
        if (f.valor_numero) conteo[String(f.valor_numero)] = Number(f.cantidad)
      })
    } else if (pregunta.tipo === 'opcion_multiple') {
      ;(pregunta.opciones_pregunta || []).forEach(op => {
        const f = filas.find(r => r.opcion_id === op.id || r.valor_texto === op.texto || r.opcion_texto === op.texto)
        conteo[op.texto] = f ? Number(f.cantidad) : 0
      })
    }
    return conteo
  }, [filas, pregunta])

  useEffect(() => {
    if (!ref.current || !datos) return
    if (chartRef.current) chartRef.current.destroy()
    const labels = Object.keys(datos)
    const values = Object.values(datos)
    const total  = values.reduce((a, b) => a + b, 0)
    const isPie  = tipo === 'pie' || tipo === 'doughnut'

    chartRef.current = new Chart(ref.current.getContext('2d'), {
      type: isPie ? 'doughnut' : tipo === 'horizontal' ? 'bar' : 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: isPie ? PALETA.slice(0, labels.length) : color,
          borderRadius: isPie ? 0 : 5,
          borderSkipped: false,
          borderWidth: isPie ? 2 : 0,
          borderColor: isPie ? '#fff' : undefined,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: tipo === 'horizontal' ? 'y' : 'x',
        plugins: {
          legend: { display: isPie, position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = total ? Math.round(ctx.raw / total * 100) : 0
                return ` ${ctx.raw} respuestas (${pct}%)`
              }
            }
          }
        },
        scales: isPie ? {} : {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 30 } },
          y: { display: tipo !== 'horizontal', beginAtZero: true, ticks: { font: { size: 10 } } },
        }
      }
    })
    return () => chartRef.current?.destroy()
  }, [datos, tipo, color])

  if (!datos || Object.values(datos).every(v => v === 0)) {
    return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink4)', fontSize: 13 }}>Sin datos</div>
  }

  return <div style={{ height: 140 }}><canvas ref={ref} /></div>
}

/* ── Vista Por Pregunta con selector de tipo de gráfico ── */
/* ── Tabla de resultados para preguntas de tipo matriz ── */
function MatrizTabla({ pregunta, filas, color }) {
  const filasDef   = (pregunta.config_matriz?.filas    || []).map(f => typeof f === 'string' ? f : f.texto)
  const columnasDef = (pregunta.config_matriz?.columnas || []).map(c => typeof c === 'string' ? c : c.texto)

  // Contar respuestas: cada respuesta es un JSON con { fila: columna }
  const conteo = {}
  filasDef.forEach(f => { conteo[f] = {}; columnasDef.forEach(c => { conteo[f][c] = 0 }) })

  filas.forEach(resp => {
    try {
      const val = typeof resp.valor_texto === 'string' ? JSON.parse(resp.valor_texto) : resp.valor_texto
      if (val && typeof val === 'object') {
        Object.entries(val).forEach(([fi, col]) => {
          // fi puede ser índice numérico o texto de fila
          const filaTexto = isNaN(Number(fi)) ? fi : filasDef[Number(fi)]
          if (filaTexto && conteo[filaTexto] && columnasDef.includes(col)) {
            conteo[filaTexto][col] = (conteo[filaTexto][col] || 0) + 1
          }
        })
      }
    } catch {}
  })

  if (!filasDef.length || !columnasDef.length) return (
    <div style={{ color: 'var(--ink3)', fontSize: 13 }}>Sin configuración de matriz</div>
  )

  const totalesFila = filasDef.map(f => columnasDef.reduce((s, c) => s + (conteo[f]?.[c] || 0), 0))
  const maxTotal = Math.max(...totalesFila, 1)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', minWidth: `${columnasDef.length * 80 + 180}px` }}>
        <thead>
          <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, width: 180 }} />
            {columnasDef.map(col => (
              <th key={col} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col}</th>
            ))}
            <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {filasDef.map((fila, fi) => {
            const totalFila = totalesFila[fi]
            return (
              <tr key={fi} style={{ borderBottom: '1px solid var(--border)', background: fi % 2 === 0 ? 'var(--paper)' : 'var(--surface)' }}>
                <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', verticalAlign: 'middle' }}>{fila}</td>
                {columnasDef.map(col => {
                  const n = conteo[fila]?.[col] || 0
                  const pct = totalFila > 0 ? Math.round(n / totalFila * 100) : 0
                  return (
                    <td key={col} style={{ padding: '9px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: n > 0 ? color : 'var(--ink3)' }}>{n}</div>
                      {n > 0 && <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 1 }}>{pct}%</div>}
                    </td>
                  )
                })}
                <td style={{ padding: '9px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <span style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 800, color: 'var(--ink2)' }}>{totalFila}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PorPregunta({ preguntas, respuestasMap }) {
  const [tiposGrafico, setTiposGrafico] = useState({})

  function setTipo(pregId, tipo) {
    setTiposGrafico(prev => ({ ...prev, [pregId]: tipo }))
  }

  const tiposDisponibles = (preg) => {
    if (preg.tipo === 'si_no') return [['doughnut','Dona'],['bar','Barras']]
    if (preg.tipo === 'opcion_multiple') return [['horizontal','Barras horiz.'],['bar','Barras vert.'],['doughnut','Dona']]
    if (preg.tipo === 'escala') return [['bar','Barras'],['horizontal','Barras horiz.']]
    return []
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {preguntas.filter(p => p.clave_base !== 'participa').map((p, i) => {
        const tipos = tiposDisponibles(p)
        const tipoActual = tiposGrafico[p.id] || (tipos[0]?.[0] ?? 'bar')
        const total = (respuestasMap[p.id] || []).reduce((s, f) => s + Number(f.cantidad), 0)
        return (
          <div key={p.id} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20, borderLeft: `3px solid ${PALETA[i % PALETA.length]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{p.texto}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                  {p.tipo} · {total} respuestas
                </div>
              </div>
              {tipos.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {tipos.map(([v, label]) => (
                    <button key={v} onClick={() => setTipo(p.id, v)}
                      style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'DM Sans', border: '1.5px solid', borderRadius: 'var(--r)', cursor: 'pointer', transition: 'all .15s',
                        borderColor: tipoActual === v ? PALETA[i % PALETA.length] : 'var(--border2)',
                        background:  tipoActual === v ? PALETA[i % PALETA.length] + '15' : 'var(--surface)',
                        color:       tipoActual === v ? PALETA[i % PALETA.length] : 'var(--ink3)',
                        fontWeight:  tipoActual === v ? 700 : 500,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {p.tipo === 'texto_libre' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {(respuestasMap[p.id] || []).filter(f => f.valor_texto?.trim()).map((f, j) => (
                  <div key={j} style={{ fontSize: 13, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--r)', borderLeft: `3px solid ${PALETA[i%PALETA.length]}`, color: 'var(--ink2)' }}>
                    "{f.valor_texto}"
                  </div>
                ))}
              </div>
            ) : p.tipo === 'matriz' ? (
              <MatrizTabla pregunta={p} filas={respuestasMap[p.id] || []} color={PALETA[i % PALETA.length]} />
            ) : (
              <MiniChart pregunta={p} filas={respuestasMap[p.id] || []} tipo={tipoActual} color={PALETA[i % PALETA.length]} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Cruce de datos entre dos preguntas en un único gráfico ── */
function GraficoCruce({ preguntas, sesiones, onRemove, onCruceChange, index }) {
  const [pregA, setPregA] = useState('')
  const [pregB, setPregB] = useState('')
  const [tipoGrafico, setTipoGrafico] = useState('stacked')
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const pA = preguntas.find(p => p.id === pregA)
  const pB = preguntas.find(p => p.id === pregB)
  const comparables = preguntas.filter(p =>
    ['si_no','escala','opcion_multiple'].includes(p.tipo) && p.clave_base !== 'participa'
  )

  const datosCruce = useMemo(() => {
    if (!pA || !pB || !sesiones?.length) return null

    if (tipoGrafico === 'scatter') {
      const pts = sesiones.map(s => {
        const va = s.respuestas?.[pA.id]
        const vb = s.respuestas?.[pB.id]
        const na = parseFloat(va)
        const nb = parseFloat(vb)
        return isNaN(na) || isNaN(nb) ? null : { x: na, y: nb }
      }).filter(Boolean)
      return pts.length ? { tipo: 'scatter', puntos: pts } : null
    }

    const valoresA = [...new Set(sesiones.map(s => s.respuestas?.[pA.id]).filter(Boolean))].sort()
    const valoresB = [...new Set(sesiones.map(s => s.respuestas?.[pB.id]).filter(Boolean))].sort()
    if (!valoresA.length || !valoresB.length) return null

    const matriz = {}
    valoresA.forEach(va => {
      matriz[va] = {}
      valoresB.forEach(vb => { matriz[va][vb] = 0 })
    })
    sesiones.forEach(s => {
      const va = s.respuestas?.[pA.id]
      const vb = s.respuestas?.[pB.id]
      if (va && vb && matriz[va] !== undefined) {
        matriz[va][vb] = (matriz[va][vb] || 0) + 1
      }
    })
    return { tipo: 'bar', labelsX: valoresA, seriesY: valoresB, matriz }
  }, [pA?.id, pB?.id, tipoGrafico, sesiones])

  // El canvas siempre está en el DOM — si lo condicionamos, el ref llega null cuando se monta
  useEffect(() => {
    if (!chartRef.current || !datosCruce) return
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null }
    const ctx = chartRef.current.getContext('2d')

    if (datosCruce.tipo === 'scatter') {
      chartInst.current = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: `${pA.texto.slice(0,25)} vs ${pB.texto.slice(0,25)}`,
            data: datosCruce.puntos,
            backgroundColor: PALETA[index % PALETA.length] + 'cc',
            pointRadius: 6, pointHoverRadius: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => `(${c.parsed.x}, ${c.parsed.y})` } }
          },
          scales: {
            x: { title: { display: true, text: pA.texto.slice(0,45), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
            y: { title: { display: true, text: pB.texto.slice(0,45), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          }
        }
      })
    } else {
      const { labelsX, seriesY, matriz } = datosCruce
      const stacked = tipoGrafico === 'stacked'
      chartInst.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labelsX,
          datasets: seriesY.map((vb, i) => ({
            label: vb,
            data: labelsX.map(va => matriz[va]?.[vb] || 0),
            backgroundColor: PALETA[i % PALETA.length],
            borderRadius: stacked ? 0 : 4,
            borderSkipped: false,
          }))
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 }, padding: 12, boxWidth: 12 } } },
          scales: {
            x: { stacked, title: { display: true, text: pA.texto.slice(0,50), font: { size: 11 } }, grid: { display: false } },
            y: { stacked, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
          }
        }
      })
    }
  }, [datosCruce])

  // Notificar al padre cuando cambia el cruce para que pueda exportarlo
  useEffect(() => {
    if (onCruceChange) {
      onCruceChange({ pA, pB, datosCruce })
    }
  }, [pA?.id, pB?.id, datosCruce])

  // Cleanup solo al desmontar
  useEffect(() => {
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null } }
  }, [])

  const sel = { width: '100%', padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'DM Sans', outline: 'none' }

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETA[index % PALETA.length] }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Cruce {index + 1}
          </span>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', padding: 4, borderRadius: 6 }}>
          <Trash2 size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pregunta — eje X</label>
          <select value={pregA} onChange={e => setPregA(e.target.value)} style={sel}>
            <option value="">Seleccionar...</option>
            {comparables.map(p => <option key={p.id} value={p.id}>{p.texto.slice(0,55)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cruzar con</label>
          <select value={pregB} onChange={e => setPregB(e.target.value)} style={sel}>
            <option value="">Seleccionar...</option>
            {comparables.filter(p => p.id !== pregA).map(p => <option key={p.id} value={p.id}>{p.texto.slice(0,55)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</label>
          <select value={tipoGrafico} onChange={e => setTipoGrafico(e.target.value)} style={{ ...sel, width: 'auto', minWidth: 140 }}>
            <option value="stacked">Barras apiladas</option>
            <option value="grouped">Barras agrupadas</option>
            <option value="scatter">Dispersión</option>
          </select>
        </div>
      </div>

      {/* Canvas siempre en el DOM para que el ref esté disponible cuando cambia datosCruce */}
      <div style={{ height: 340, position: 'relative', display: datosCruce ? 'block' : 'none' }}>
        <canvas ref={chartRef} />
      </div>

      {!datosCruce && pA && pB && (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          Sin datos suficientes para este cruce.{tipoGrafico === 'scatter' ? ' Para dispersión ambas preguntas deben ser numéricas.' : ''}
        </div>
      )}
      {(!pA || !pB) && (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink3)', fontSize: 13, border: '1.5px dashed var(--border2)', borderRadius: 'var(--r)' }}>
          Seleccioná dos preguntas para ver el cruce de datos en un único gráfico
        </div>
      )}
    </div>
  )
}

/* ── Tabla de datos crudos con sort, filter y scroll propio ── */
function TablaDatosCrudos({ datosExport, loadingDatos, onActualizar, onExportarCSV }) {
  const [sortCol,   setSortCol]   = useState(null)
  const [sortDir,   setSortDir]   = useState('asc')
  const [filtroGlobal, setFiltroGlobal] = useState('')

  const columnas = datosExport?.columnas || []
  const filas    = datosExport?.filas    || []

  const filasFiltradas = useMemo(() => {
    let f = filas
    if (filtroGlobal.trim()) {
      const q = filtroGlobal.toLowerCase()
      f = f.filter(fila =>
        [fila.encuestador, fila.equipo, ...columnas.map(col => (fila.respuestas||{})[col.id])]
          .some(v => v && String(v).toLowerCase().includes(q))
      )
    }
    if (sortCol) {
      f = [...f].sort((a, b) => {
        const va = sortCol === 'encuestador' ? a.encuestador
          : sortCol === 'equipo' ? a.equipo
          : sortCol === 'lat' ? a.lat
          : sortCol === 'lng' ? a.lng
          : (a.respuestas||{})[sortCol]
        const vb = sortCol === 'encuestador' ? b.encuestador
          : sortCol === 'equipo' ? b.equipo
          : sortCol === 'lat' ? b.lat
          : sortCol === 'lng' ? b.lng
          : (b.respuestas||{})[sortCol]
        const na = parseFloat(va), nb = parseFloat(vb)
        const cmp = !isNaN(na) && !isNaN(nb)
          ? na - nb
          : String(va||'').localeCompare(String(vb||''), 'es')
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return f
  }, [filas, filtroGlobal, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const thStyle = (col) => ({
    position: 'sticky', top: 0, zIndex: 2,
    background: 'var(--surface)',
    padding: '9px 14px', textAlign: 'left',
    fontSize: 10, fontWeight: 700, color: sortCol === col ? 'var(--accent)' : 'var(--ink3)',
    textTransform: 'uppercase', letterSpacing: 0.5,
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    borderBottom: '2px solid var(--border)',
  })

  const sortIndicator = (col) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <div style={{
      /* Romper el max-width del contenedor padre con márgenes negativos */
      marginLeft: '-28px', marginRight: '-28px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Barra de herramientas */}
      <div style={{ padding: '12px 28px', background: 'var(--paper)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          placeholder="Buscar en todas las columnas..."
          value={filtroGlobal}
          onChange={e => setFiltroGlobal(e.target.value)}
          style={{ flex: 1, padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', maxWidth: 340 }}
        />
        {filtroGlobal && (
          <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{filasFiltradas.length} de {filas.length}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={onActualizar} disabled={loadingDatos}
            style={{ padding: '6px 12px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} /> Actualizar
          </button>
          <button onClick={onExportarCSV} disabled={!filas.length}
            style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={12} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      {loadingDatos ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner size="md" /></div>
      ) : !filas.length ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)', fontSize: 13 }}>
          No hay datos todavía. Hacé clic en Actualizar.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                {[['encuestador','Encuestador'],['equipo','Equipo'],['lat','Lat'],['lng','Lng']].map(([col, label]) => (
                  <th key={col} onClick={() => toggleSort(col)} style={thStyle(col)}>
                    {label}{sortIndicator(col)}
                  </th>
                ))}
                {columnas.map(col => (
                  <th key={col.id} onClick={() => toggleSort(col.id)} style={thStyle(col.id)}>
                    {col.texto}{sortIndicator(col.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((fila, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--paper)' : 'var(--surface)' }}>
                  <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{fila.encuestador || '—'}</td>
                  <td style={{ padding: '8px 14px', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>{fila.equipo || '—'}</td>
                  <td style={{ padding: '8px 14px', color: 'var(--ink3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fila.lat ? Number(fila.lat).toFixed(5) : '—'}</td>
                  <td style={{ padding: '8px 14px', color: 'var(--ink3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fila.lng ? Number(fila.lng).toFixed(5) : '—'}</td>
                  {columnas.map(col => {
                    const val = (fila.respuestas||{})[col.id]
                    // Si es una matriz (JSON), mostrar "Fila: Columna" resumido
                    let display = val || '—'
                    if (col.tipo === 'matriz' && val) {
                      try {
                        const parsed = typeof val === 'string' ? JSON.parse(val) : val
                        if (typeof parsed === 'object') {
                          const filasDef = (col.config_matriz?.filas || []).map(f => typeof f === 'string' ? f : f.texto)
                          display = Object.entries(parsed)
                            .map(([fi, respuesta]) => {
                              const filaTexto = isNaN(Number(fi)) ? fi : (filasDef[Number(fi)] || fi)
                              return `${filaTexto}: ${respuesta}`
                            }).join(' | ')
                        }
                      } catch { display = val }
                    }
                    return (
                      <td key={col.id} style={{ padding: '8px 14px', color: 'var(--ink2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={typeof display === 'string' ? display : ''}>
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {icon}{label}
      </div>
      <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── Exportar HTML/PDF ── */
function generarHTML(encuesta, preguntas, respuestas, resumen, cruces, datosCrudos, sesiones) {
  const filasPorPregunta = {}
  preguntas.forEach(p => { filasPorPregunta[String(p.id)] = [] })
  respuestas.forEach(f => { if (filasPorPregunta[String(f.pregunta_id)]) filasPorPregunta[String(f.pregunta_id)].push(f) })

  const promedioEscala = (() => {
    const fe = respuestas.filter(f => f.tipo === 'escala' && f.valor_numero != null)
    if (!fe.length) return '—'
    const suma = fe.reduce((s, f) => s + Number(f.valor_numero) * Number(f.cantidad), 0)
    const total = fe.reduce((s, f) => s + Number(f.cantidad), 0)
    return total ? (suma / total).toFixed(1) : '—'
  })()

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  const preguntasHTML = preguntas.filter(p => p.clave_base !== 'participa').map((p, idx) => {
    const filas = filasPorPregunta[String(p.id)] || []
    const color = PALETA[idx % PALETA.length]
    const opciones = p.opciones_pregunta || []
    const conteo = {}

    if (p.tipo === 'si_no') {
      filas.forEach(f => {
        const k = f.valor_texto === 'Sí' || f.valor_booleano === true ? 'Sí' : 'No'
        conteo[k] = (conteo[k] || 0) + Number(f.cantidad)
      })
    } else if (p.tipo === 'escala') {
      for (let i = 1; i <= 10; i++) {
        const f = filas.find(r => Number(r.valor_numero) === i)
        if (f) conteo[String(i)] = Number(f.cantidad)
      }
    } else if (p.tipo === 'opcion_multiple') {
      opciones.forEach(op => {
        const f = filas.find(r => r.opcion_id === op.id || r.valor_texto === op.texto || r.opcion_texto === op.texto)
        conteo[op.texto] = f ? Number(f.cantidad) : 0
      })
    } else if (p.tipo === 'texto_libre') {
      const textos = filas.filter(f => f.valor_texto?.trim()).slice(0, 6)
      return `<div class="preg"><div class="preg-h" style="border-color:${color}"><b>${p.texto}</b> <span class="badge">Texto libre</span></div>${textos.map(f => `<div class="txt" style="border-color:${color}">"${f.valor_texto}"</div>`).join('')}</div>`
    }

    const total = Object.values(conteo).reduce((a,b)=>a+b, 0)
    if (!total) return `<div class="preg"><div class="preg-h" style="border-color:${color}"><b>${p.texto}</b></div><p class="empty">Sin respuestas</p></div>`

    const barras = Object.entries(conteo).map(([l, v]) => {
      const pct = Math.round(v / total * 100)
      return `<div class="row"><span class="lbl">${l}</span><div class="track"><div class="fill" style="width:${pct}%;background:${color}"></div></div><span class="pct">${pct}% (${v})</span></div>`
    }).join('')

    return `<div class="preg"><div class="preg-h" style="border-color:${color}"><b>${p.texto}</b> <span class="badge">${p.tipo} · ${total} resp.</span></div><div class="barras">${barras}</div></div>`
  }).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte — ${encuesta.nombre}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:40px;font-size:13px}
.header{border-bottom:3px solid #1a472a;padding-bottom:20px;margin-bottom:28px}
h1{font-size:22px;font-weight:800;color:#1a472a;margin:8px 0 4px}
.meta{font-size:12px;color:#888;display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}
.kpi{background:#fafaf8;border:1px solid #e5e7eb;border-radius:10px;padding:14px;border-top:3px solid}
.kpi-v{font-size:26px;font-weight:800;margin-bottom:3px}.kpi-l{font-size:10px;color:#777;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.sec{font-size:13px;font-weight:700;color:#1a472a;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e5e7eb}
.preg{margin-bottom:20px;padding:16px;border:1px solid #e5e7eb;border-radius:10px;page-break-inside:avoid}
.preg-h{padding-left:10px;border-left:3px solid;margin-bottom:12px}.badge{font-size:10px;color:#888;background:#f3f4f6;padding:2px 8px;border-radius:100px}
.row{display:flex;align-items:center;gap:8px;margin-bottom:7px}.lbl{font-size:11px;width:120px;flex-shrink:0}
.track{flex:1;height:14px;background:#f3f4f6;border-radius:4px;overflow:hidden}.fill{height:100%;border-radius:4px}
.pct{font-size:11px;font-weight:700;width:80px;text-align:right}.txt{font-size:11px;padding:7px 10px;background:#fafaf8;border-left:3px solid;margin-bottom:5px;border-radius:0 4px 4px 0}
.empty{font-size:12px;color:#bbb;font-style:italic}
footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#bbb;display:flex;justify-content:space-between}
@media print{body{padding:20px}.preg{page-break-inside:avoid}}</style></head><body>
<div class="header"><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#1a472a;text-transform:uppercase">METR1KA · Reporte</div>
<h1>${encuesta.nombre}</h1>
<div class="meta"><span>📅 ${fecha}</span>${resumen?.total_sesiones ? `<span>📊 ${resumen.total_sesiones} respuestas</span>` : ''}</div></div>
<div class="kpis">
<div class="kpi" style="border-top-color:#1a472a"><div class="kpi-v" style="color:#1a472a">${resumen?.total_sesiones||0}</div><div class="kpi-l">Total respuestas</div></div>
<div class="kpi" style="border-top-color:#0369a1"><div class="kpi-v" style="color:#0369a1">${resumen?.encuestadores||0}</div><div class="kpi-l">Encuestadores</div></div>
<div class="kpi" style="border-top-color:#7c3aed"><div class="kpi-v" style="color:#7c3aed">${promedioEscala}</div><div class="kpi-l">Promedio escalas</div></div>
<div class="kpi" style="border-top-color:#b45309"><div class="kpi-v" style="color:#b45309">${resumen?.ultima_respuesta ? new Date(resumen.ultima_respuesta).toLocaleDateString('es-AR') : '—'}</div><div class="kpi-l">Última respuesta</div></div>
</div>
<div class="sec">Resultados por pregunta</div>
${preguntasHTML}
<footer><span>METR1KA — metr1ka.com</span><span>${fecha}</span></footer>
</body></html>`
}

/* ── Mapa de respuestas georreferenciadas con filtro por pregunta ── */
const PALETA_MAPA = [
  '#1a472a','#0369a1','#7c3aed','#b45309','#be185d',
  '#047857','#dc2626','#d97706','#0891b2','#6d28d9',
  '#059669','#c2410c','#1d4ed8','#db2777','#0284c7',
]

function MapaRespuestas({ sesiones, columnas }) {
  const mapRef      = useRef(null)
  const instRef     = useRef(null)
  const markersRef  = useRef(null)
  const [filtroCol, setFiltroCol] = useState('')
  const [capas,     setCapas]     = useState({})

  // Solo columnas de tipo opcion_multiple o si_no para filtrar
  const colsFiltro = useMemo(() =>
    (columnas || []).filter(c => ['opcion_multiple','si_no'].includes(c.tipo) && c.clave_base !== 'participa'),
    [columnas]
  )

  // Valores únicos de la columna seleccionada
  const valoresUnicos = useMemo(() => {
    if (!filtroCol) return []
    const vals = (sesiones || [])
      .map(s => s.respuestas?.[filtroCol])
      .filter(Boolean)
    return [...new Set(vals)].sort()
  }, [filtroCol, sesiones])

  // Inicializar capas cuando cambia la pregunta
  useEffect(() => {
    const estado = {}
    valoresUnicos.forEach(v => { estado[v] = true })
    setCapas(estado)
  }, [valoresUnicos.join('|')])

  const colorPorValor = useMemo(() => {
    const map = {}
    valoresUnicos.forEach((v, i) => { map[v] = PALETA_MAPA[i % PALETA_MAPA.length] })
    return map
  }, [valoresUnicos.join('|')])

  useEffect(() => {
    if (!mapRef.current) return
    if (!instRef.current) {
      instRef.current = L.map(mapRef.current, { zoomControl: true }).setView([-27.5, -55.8], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(instRef.current)
      markersRef.current = L.layerGroup().addTo(instRef.current)
    }

    markersRef.current.clearLayers()
    const puntos = (sesiones || []).filter(s => s.lat && s.lng)
    if (!puntos.length) return

    const visibles = []

    puntos.forEach(s => {
      const respuesta = filtroCol ? (s.respuestas?.[filtroCol] || null) : null
      const color = filtroCol
        ? (colorPorValor[respuesta] || '#9ca3af')
        : '#1a472a'

      // Ocultar si la capa está apagada
      if (filtroCol && respuesta && capas[respuesta] === false) return
      if (filtroCol && !respuesta) return // sin respuesta = ocultar

      visibles.push(s)

      const icono = L.divIcon({
        className: '',
        html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [13,13], iconAnchor: [6,6],
      })

      const popup = `<div style="font-family:DM Sans,sans-serif;font-size:12px;min-width:170px;line-height:1.6">
        <div style="font-weight:700;font-size:13px;margin-bottom:3px">${s.encuestador || '—'}</div>
        ${respuesta ? `<div style="display:inline-block;background:${color}22;color:${color};border:1.5px solid ${color}66;border-radius:100px;padding:2px 9px;font-size:11px;font-weight:700;margin-bottom:4px">${respuesta}</div><br>` : ''}
        <span style="color:#6b7280;font-size:11px">${s.equipo || ''}</span>
        <div style="color:#9ca3af;font-size:10px;margin-top:2px">${s.fecha ? new Date(s.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</div>
      </div>`

      L.marker([s.lat, s.lng], { icon: icono }).bindPopup(popup).addTo(markersRef.current)
    })

    if (visibles.length > 0) {
      const bounds = L.latLngBounds(visibles.map(s => [s.lat, s.lng]))
      instRef.current.fitBounds(bounds, { padding: [40,40], maxZoom: 16 })
    }
  }, [sesiones, filtroCol, capas, colorPorValor])

  useEffect(() => () => {
    if (instRef.current) { instRef.current.remove(); instRef.current = null }
  }, [])

  const puntos = (sesiones || []).filter(s => s.lat && s.lng)
  const sinGPS = (sesiones || []).length - puntos.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Barra de controles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>
            Colorear por respuesta a
          </label>
          <select value={filtroCol} onChange={e => { setFiltroCol(e.target.value); setCapas({}) }}
            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}>
            <option value="">— Todos los puntos (un color) —</option>
            {colsFiltro.map(c => (
              <option key={c.id} value={c.id}>{c.texto?.slice(0,68)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 2 }}>
          <MapPin size={14} color="var(--accent)" />
          <span style={{ color: 'var(--ink2)' }}><strong>{puntos.length}</strong> con GPS</span>
          {sinGPS > 0 && <span style={{ color: 'var(--ink4)' }}>· {sinGPS} sin GPS</span>}
        </div>
      </div>

      {/* Leyenda con toggle por respuesta */}
      {filtroCol && valoresUnicos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {valoresUnicos.map(v => {
            const color = colorPorValor[v] || '#9ca3af'
            const activo = capas[v] !== false
            const cant = (sesiones || []).filter(s => s.respuestas?.[filtroCol] === v && s.lat).length
            return (
              <button key={v} onClick={() => setCapas(p => ({ ...p, [v]: !activo }))}
                title={`${activo ? 'Ocultar' : 'Mostrar'} "${v}"`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px', borderRadius: 100, cursor: 'pointer',
                  fontFamily: 'DM Sans', fontSize: 12, transition: 'all .15s',
                  border: `1.5px solid ${activo ? color : 'var(--border)'}`,
                  background: activo ? `${color}15` : 'var(--surface)',
                  color: activo ? color : 'var(--ink3)', opacity: activo ? 1 : 0.5,
                }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: activo ? color : '#ccc', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{v}</span>
                <span style={{ fontWeight: 400, fontSize: 11, background: activo ? `${color}25` : 'var(--surface)', borderRadius: 100, padding: '0 5px' }}>{cant}</span>
              </button>
            )
          })}
          <button onClick={() => {
            const allOn = valoresUnicos.every(v => capas[v] !== false)
            const nuevo = {}
            valoresUnicos.forEach(v => { nuevo[v] = !allOn })
            setCapas(nuevo)
          }} style={{ padding: '5px 11px', borderRadius: 100, fontSize: 11, fontFamily: 'DM Sans', cursor: 'pointer', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--ink3)' }}>
            {valoresUnicos.every(v => capas[v] !== false) ? 'Ocultar todo' : 'Mostrar todo'}
          </button>
        </div>
      )}

      {/* Mapa */}
      {puntos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--ink3)', fontSize: 14, background: 'var(--paper)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
          📍 No hay respuestas con coordenadas GPS todavía
        </div>
      ) : (
        <div ref={mapRef} style={{ height: 520, borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflow: 'hidden' }} />
      )}
    </div>
  )
}

/* ── PANTALLA PRINCIPAL ── */
export default function Reportes() {
  const { perfil } = useAuth()
  const [encuestas,   setEncuestas]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [loadingEnc,  setLoadingEnc]  = useState(false)
  const [data,        setData]        = useState(null)
  const [generando,   setGenerando]   = useState(false)
  const [modalExport, setModalExport] = useState(false)
  const [exportConfig, setExportConfig] = useState({
    kpis:        true,
    preguntas:   {},   // { [pregunta_id]: true/false }
    cruces:      true,
    datosCrudos: false,
  })
  const [vistaActiva, setVistaActiva] = useState('dashboard')
  const [comparaciones, setComparaciones] = useState([{ id: 1 }])
  const [sesionesCruce, setSesionesCruce] = useState([])
  const [datosExport,  setDatosExport]  = useState(null)
  const [loadingDatos, setLoadingDatos] = useState(false)

  // Filtros
  const [filtroEquipo,      setFiltroEquipo]      = useState('')
  const [filtroEncuestador, setFiltroEncuestador] = useState('')
  const [filtroDesde,       setFiltroDesde]       = useState('')
  const [filtroHasta,       setFiltroHasta]       = useState('')
  const [filtrosAbiertos,   setFiltrosAbiertos]   = useState(false)

  useEffect(() => {
    if (!perfil?.organizacion_id) return
    supabase.from('encuestas')
      .select('id, nombre, descripcion, estado_produccion, creado_en')
      .eq('organizacion_id', perfil.organizacion_id)
      .eq('estado_produccion', 'publicada')
      .order('creado_en', { ascending: false })
      .then(({ data }) => { setEncuestas(data || []); setLoading(false) })
  }, [perfil?.organizacion_id])

  async function cargarEncuesta(enc) {
    setSelected(enc); setData(null); setLoadingEnc(true); setDatosExport(null); setSesionesCruce([])
    setFiltroEquipo(''); setFiltroEncuestador(''); setFiltroDesde(''); setFiltroHasta('')
    const [{ data: d }, { data: sc }] = await Promise.all([
      supabase.rpc('get_encuesta_full', { p_encuesta_id: enc.id, p_org_id: perfil.organizacion_id }),
      supabase.rpc('get_respuestas_por_sesion', { p_encuesta_id: enc.id, p_org_id: perfil.organizacion_id }),
    ])
    setData(d)
    setSesionesCruce(sc?.sesiones || [])
    setLoadingEnc(false)
  }

  // Cargar datos crudos automáticamente al entrar a la tab
  useEffect(() => {
    if ((vistaActiva === 'datos' || vistaActiva === 'mapa') && selected && !datosExport && !loadingDatos) {
      cargarDatosCrudos()
    }
  }, [vistaActiva, selected?.id])

  async function cargarDatosCrudos() {
    if (!selected) return
    setLoadingDatos(true)
    const { data: d } = await supabase.rpc('get_respuestas_crudas', {
      p_encuesta_id:    selected.id,
      p_org_id:         perfil.organizacion_id,
      p_equipo_id:      filtroEquipo      || null,
      p_encuestador_id: filtroEncuestador || null,
      p_fecha_desde:    filtroDesde       || null,
      p_fecha_hasta:    filtroHasta       || null,
    })
    setDatosExport(d)
    setLoadingDatos(false)
  }

  function exportarCSV() {
    if (!datosExport?.columnas || !datosExport?.filas) return
    const cols = datosExport.columnas
    const header = ['Sesion', 'Fecha', 'Encuestador', 'Equipo', 'Latitud', 'Longitud', ...cols.map(c => c.texto)]
    const rows = (datosExport.filas || []).map(f => [
      f.sesion_id,
      f.fecha ? new Date(f.fecha).toLocaleString('es-AR') : '',
      f.encuestador || '',
      f.equipo || '',
      f.lat || '',
      f.lng || '',
      ...cols.map(c => (f.respuestas || {})[c.id] || ''),
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `${selected.nombre.replace(/\s+/g,'_')}_datos.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function aplicarFiltros() {
    if (!selected) return
    setLoadingEnc(true)
    const { data: d } = await supabase.rpc('get_encuesta_full', {
      p_encuesta_id:    selected.id,
      p_org_id:         perfil.organizacion_id,
      p_equipo_id:      filtroEquipo      || null,
      p_encuestador_id: filtroEncuestador || null,
      p_fecha_desde:    filtroDesde       || null,
      p_fecha_hasta:    filtroHasta       || null,
    })
    setData(d); setLoadingEnc(false)
  }

  function generarPDF(cfg) {
    if (!data || !selected) return
    setGenerando(true)
    const pregsFiltradas = (data.preguntas || []).filter(p => cfg.preguntas[p.id])
    const crucesSel = cfg.cruces ? comparaciones : []
    const html = generarHTML(
      data.encuesta || selected,
      pregsFiltradas,
      data.respuestas || [],
      cfg.kpis ? (data.resumen || null) : null,
      crucesSel,
      cfg.datosCrudos ? datosExport : null,
      sesionesCruce,
    )
    const win = window.open('', '_blank')
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => { win.print(); setGenerando(false); setModalExport(false) }, 600)
  }

  const preguntas = data?.preguntas || []
  const respuestas = data?.respuestas || []
  const resumen = data?.resumen || {}
  const equipos = useMemo(() => {
    const map = {}
    ;(data?.encuestadores || []).forEach(e => { if (e.equipo_id) map[e.equipo_id] = e.equipo_nombre })
    return Object.entries(map).map(([id, nombre]) => ({ id, nombre }))
  }, [data?.encuestadores])

  const encuestadoresFiltrados = useMemo(() =>
    filtroEquipo ? (data?.encuestadores||[]).filter(e=>e.equipo_id===filtroEquipo) : (data?.encuestadores||[]),
    [data?.encuestadores, filtroEquipo]
  )

  const respuestasMap = useMemo(() => {
    const map = {}
    preguntas.forEach(p => { map[p.id] = [] })
    respuestas.forEach(f => { if (map[f.pregunta_id]) map[f.pregunta_id].push(f) })
    return map
  }, [preguntas, respuestas])

  const razonesNR = useMemo(() => {
    const pregParticipa = preguntas.find(p => p.clave_base === 'participa')
    if (!pregParticipa) return []
    return (respuestasMap[pregParticipa.id] || []).filter(f => f.valor_texto && f.valor_texto !== 'Sí')
  }, [preguntas, respuestasMap])

  const promedioEscala = useMemo(() => {
    const fe = respuestas.filter(f => f.tipo === 'escala' && f.valor_numero != null)
    if (!fe.length) return '—'
    const suma = fe.reduce((s, f) => s + Number(f.valor_numero) * Number(f.cantidad), 0)
    const total = fe.reduce((s, f) => s + Number(f.cantidad), 0)
    return total ? (suma / total).toFixed(1) : '—'
  }, [respuestas])

  const inp = { padding: '7px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', width: '100%', outline: 'none' }

  const tabStyle = (active) => ({
    padding: '7px 16px', border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans',
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--accent)' : 'var(--ink3)',
    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
    marginBottom: -1, transition: 'all .15s',
  })

  return (
    <div className={styles.page}>
      <Topbar title="Reportes"
        action={data ? { label: '⬇ Exportar PDF', onClick: () => {
          // Inicializar selección de preguntas con todas activas
          const cfg = {}
          ;(data?.preguntas || []).filter(p => p.clave_base !== 'participa').forEach(p => { cfg[p.id] = true })
          setExportConfig(prev => ({ ...prev, preguntas: cfg }))
          setModalExport(true)
        }} : null} />
      <div className={styles.content}>

        {loading ? <Spinner center size="lg" /> : encuestas.length === 0 ? (
          <div className={styles.empty}><p>No hay encuestas publicadas todavía.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Lista de encuestas — cards con dos acciones */}
            {!selected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                  Seleccioná una encuesta para ver sus reportes
                </div>
                {encuestas.map(enc => (
                  <div key={enc.id} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{enc.nombre}</div>
                      {enc.descripcion && <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 4 }}>{enc.descripcion}</div>}
                      <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Creada {new Date(enc.creado_en).toLocaleDateString('es-AR')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => { cargarEncuesta(enc); setVistaActiva('preguntas') }}
                        style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BarChart2 size={13} /> Gráficos
                      </button>
                      <button onClick={() => { cargarEncuesta(enc); setVistaActiva('datos') }}
                        style={{ padding: '7px 14px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={13} /> Datos crudos
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected && (
              <>
                {/* Header con botón Volver */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => { setSelected(null); setData(null); setDatosExport(null); setSesionesCruce([]) }}
                    style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--ink3)', fontFamily: 'DM Sans' }}>
                    ← Volver
                  </button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{selected.nombre}</span>
                </div>

                {/* Filtros */}
                <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                  <button onClick={() => setFiltrosAbiertos(o=>!o)} style={{ width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Filter size={14} color="var(--ink3)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1 }}>Filtros</span>
                      {(filtroEquipo||filtroEncuestador||filtroDesde||filtroHasta) && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 100, padding: '1px 7px' }}>Activos</span>}
                    </div>
                    {filtrosAbiertos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {filtrosAbiertos && (
                    <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, paddingTop: 14 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Equipo</label>
                          <select value={filtroEquipo} onChange={e => { setFiltroEquipo(e.target.value); setFiltroEncuestador('') }} style={inp}>
                            <option value="">Todos</option>
                            {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Encuestador</label>
                          <select value={filtroEncuestador} onChange={e => setFiltroEncuestador(e.target.value)} disabled={!filtroEquipo} style={inp}>
                            <option value="">Todos</option>
                            {encuestadoresFiltrados.map(e => <option key={e.encuestador_id} value={e.encuestador_id}>{e.nombre_completo}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Desde</label>
                          <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Hasta</label>
                          <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={inp} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={aplicarFiltros} disabled={loadingEnc} style={{ padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <RefreshCw size={12} /> Aplicar
                        </button>
                        {(filtroEquipo||filtroEncuestador||filtroDesde||filtroHasta) && (
                          <button onClick={() => { setFiltroEquipo(''); setFiltroEncuestador(''); setFiltroDesde(''); setFiltroHasta(''); aplicarFiltros() }} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)' }}>
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {loadingEnc ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spinner size="md" /></div>
                ) : data && (
                  <>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                      <KpiCard label="Total respuestas" value={resumen?.total_sesiones||0} color="var(--accent)" icon={<BarChart2 size={12} />} />
                      <KpiCard label="Encuestadores" value={resumen?.encuestadores||0} color="#0369a1" icon={<FileText size={12} />} />
                      <KpiCard label="Promedio escala" value={promedioEscala} color="#7c3aed" icon={<Zap size={12} />} />
                      <KpiCard label="Última respuesta" value={resumen?.ultima_respuesta ? new Date(resumen.ultima_respuesta).toLocaleDateString('es-AR') : '—'} color="#b45309" sub="fecha más reciente" />
                    </div>

                    {/* No respuestas */}
                    {razonesNR.length > 0 && (
                      <div style={{ background: 'var(--paper)', border: '1px solid #fca5a5', borderRadius: 'var(--r2)', padding: '14px 20px', borderLeft: '4px solid #ef4444' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#c0392b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                          📋 Razones de no-respuesta
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {razonesNR.map((f, i) => (
                            <div key={i} style={{ background: '#fef2f2', borderRadius: 'var(--r)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, color: '#c0392b', fontWeight: 600 }}>{f.valor_texto}</span>
                              <span style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: '#ef4444' }}>{f.cantidad}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', background: 'var(--paper)', borderRadius: 'var(--r2) var(--r2) 0 0', padding: '0 8px' }}>
                      {[
                        ['preguntas',    '📋 Por pregunta'],
                        ['comparar',     '🔀 Cruzar datos'],
                        ['mapa',         '🗺️ Mapa'],
                        ['encuestadores','👥 Encuestadores'],
                        ['datos',        '📁 Datos crudos'],
                      ].map(([v, label]) => (
                        <button key={v}
                          onClick={() => setVistaActiva(v)}
                          style={tabStyle(vistaActiva === v)}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Vista Preguntas — todas */}
                    {vistaActiva === 'preguntas' && (
                      <PorPregunta preguntas={preguntas} respuestasMap={respuestasMap} />
                    )}

                    {/* Vista Cruzar datos */}
                    {vistaActiva === 'comparar' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--accent-light)', border: '1px solid #b7e4c7', borderRadius: 'var(--r2)', padding: '12px 16px', fontSize: 13, color: 'var(--accent2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Zap size={14} /> Cruzá dos preguntas para ver cómo se distribuyen las respuestas de una según los valores de la otra en un único gráfico.
                        </div>
                        {comparaciones.map((comp, i) => (
                          <GraficoCruce key={comp.id} preguntas={preguntas} sesiones={sesionesCruce} index={i}
                            onRemove={() => setComparaciones(prev => prev.filter(x => x.id !== comp.id))}
                            onCruceChange={({ pA, pB, datosCruce }) => {
                              setComparaciones(prev => prev.map(x => x.id === comp.id
                                ? { ...x, _pA: pA, _pB: pB, _datos: datosCruce }
                                : x
                              ))
                            }} />
                        ))}
                        <button onClick={() => setComparaciones(prev => [...prev, { id: Date.now() }])} style={{ padding: '10px', border: '1.5px dashed var(--border2)', borderRadius: 'var(--r2)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink3)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Plus size={14} /> Agregar cruce
                        </button>
                      </div>
                    )}

                    {/* Vista Datos Crudos */}
                    {vistaActiva === 'datos' && (
                      <TablaDatosCrudos
                        datosExport={datosExport}
                        loadingDatos={loadingDatos}
                        onActualizar={cargarDatosCrudos}
                        onExportarCSV={exportarCSV}
                      />
                    )}

                    {/* Vista Mapa */}
                    {vistaActiva === 'mapa' && (
                      <MapaRespuestas
                        sesiones={datosExport?.filas || []}
                        columnas={datosExport?.columnas || []}
                      />
                    )}

                    {/* Vista Encuestadores */}
                    {vistaActiva === 'encuestadores' && (
                      <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                              {['Encuestador', 'Equipo', 'Respuestas'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(data.encuestadores || []).sort((a,b) => b.total - a.total).map((e, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)' }}>{e.nombre_completo}</td>
                                <td style={{ padding: '10px 16px', color: 'var(--ink3)' }}>{e.equipo_nombre}</td>
                                <td style={{ padding: '10px 16px' }}>
                                  <span style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{e.total}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de configuración de export */}
      {modalExport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.2)' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>⬇ Configurar exportación PDF</div>
              <button onClick={() => setModalExport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink3)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPIs */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={exportConfig.kpis} onChange={e => setExportConfig(p => ({ ...p, kpis: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Resumen general (KPIs)</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Total respuestas, encuestadores, promedios</div>
                </div>
              </label>

              {/* Preguntas */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Preguntas a incluir</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      const all = {}
                      preguntas.filter(p => p.clave_base !== 'participa').forEach(p => { all[p.id] = true })
                      setExportConfig(prev => ({ ...prev, preguntas: all }))
                    }} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>Todas</button>
                    <button onClick={() => {
                      const none = {}
                      preguntas.filter(p => p.clave_base !== 'participa').forEach(p => { none[p.id] = false })
                      setExportConfig(prev => ({ ...prev, preguntas: none }))
                    }} style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>Ninguna</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                  {preguntas.filter(p => p.clave_base !== 'participa').map((p, i) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 'var(--r)', background: exportConfig.preguntas[p.id] ? 'var(--accent-light)' : 'var(--surface)', border: `1px solid ${exportConfig.preguntas[p.id] ? 'var(--accent)' : 'var(--border)'}`, transition: 'all .1s' }}>
                      <input type="checkbox" checked={!!exportConfig.preguntas[p.id]}
                        onChange={e => setExportConfig(prev => ({ ...prev, preguntas: { ...prev.preguntas, [p.id]: e.target.checked } }))}
                        style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{p.texto}</div>
                        <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 2 }}>{p.tipo}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Cruces */}
              {comparaciones.length > 0 && sesionesCruce.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={exportConfig.cruces} onChange={e => setExportConfig(p => ({ ...p, cruces: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Gráficos cruzados</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{comparaciones.length} cruce{comparaciones.length !== 1 ? 's' : ''} configurado{comparaciones.length !== 1 ? 's' : ''} — se exportan como tablas de contingencia</div>
                  </div>
                </label>
              )}

              {/* Datos crudos */}
              {datosExport?.filas?.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={exportConfig.datosCrudos} onChange={e => setExportConfig(p => ({ ...p, datosCrudos: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Datos crudos</div>
                    <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{datosExport.filas.length} filas — tabla completa con georeferencia</div>
                  </div>
                </label>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalExport(false)}
                style={{ padding: '9px 18px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink2)' }}>
                Cancelar
              </button>
              <button onClick={() => generarPDF(exportConfig)} disabled={generando}
                style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                {generando ? '⏳ Generando...' : '⬇ Exportar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}