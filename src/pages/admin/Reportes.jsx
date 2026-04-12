import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import Chart from 'chart.js/auto'
import styles from './Page.module.css'
import { BarChart2, PieChart, FileText, Download, Filter, RefreshCw, ChevronDown, ChevronUp, Zap, Plus, Trash2 } from 'lucide-react'

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

/* ── Widget de comparación entre dos preguntas ── */
function Comparacion({ preguntas, respuestasMap, onRemove, index }) {
  const [pregA, setPregA] = useState('')
  const [pregB, setPregB] = useState('')

  const pA = preguntas.find(p => p.id === pregA)
  const pB = preguntas.find(p => p.id === pregB)
  const filasA = pregA ? (respuestasMap[pregA] || []) : []
  const filasB = pregB ? (respuestasMap[pregB] || []) : []

  const comparables = preguntas.filter(p => ['si_no','escala','opcion_multiple'].includes(p.tipo) && p.clave_base !== 'participa')

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETA[index % PALETA.length] }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Comparación {index + 1}
          </span>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', padding: 4, borderRadius: 6 }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pregunta A</label>
          <select value={pregA} onChange={e => setPregA(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'DM Sans', outline: 'none' }}>
            <option value="">Seleccionar...</option>
            {comparables.map(p => <option key={p.id} value={p.id}>{p.texto.slice(0,50)}</option>)}
          </select>
          {pA && <div style={{ marginTop: 10 }}><MiniChart pregunta={pA} filas={filasA} color={PALETA[index * 2 % PALETA.length]} /></div>}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pregunta B</label>
          <select value={pregB} onChange={e => setPregB(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'DM Sans', outline: 'none' }}>
            <option value="">Seleccionar...</option>
            {comparables.map(p => <option key={p.id} value={p.id}>{p.texto.slice(0,50)}</option>)}
          </select>
          {pB && <div style={{ marginTop: 10 }}><MiniChart pregunta={pB} filas={filasB} color={PALETA[(index * 2 + 1) % PALETA.length]} /></div>}
        </div>
      </div>
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
function generarHTML(encuesta, preguntas, respuestas, resumen, filtros) {
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

/* ── PANTALLA PRINCIPAL ── */
export default function Reportes() {
  const { perfil } = useAuth()
  const [encuestas,   setEncuestas]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [loadingEnc,  setLoadingEnc]  = useState(false)
  const [data,        setData]        = useState(null)
  const [generando,   setGenerando]   = useState(false)
  const [vistaActiva, setVistaActiva] = useState('dashboard')
  const [comparaciones, setComparaciones] = useState([{ id: 1 }])

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
    setSelected(enc); setData(null); setLoadingEnc(true)
    setFiltroEquipo(''); setFiltroEncuestador(''); setFiltroDesde(''); setFiltroHasta('')
    const { data: d } = await supabase.rpc('get_encuesta_full', {
      p_encuesta_id: enc.id, p_org_id: perfil.organizacion_id,
    })
    setData(d); setLoadingEnc(false)
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

  function generarPDF() {
    if (!data || !selected) return
    setGenerando(true)
    const html = generarHTML(data.encuesta || selected, data.preguntas || [], data.respuestas || [], data.resumen || null, {})
    const win = window.open('', '_blank')
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => { win.print(); setGenerando(false) }, 600)
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
        action={data ? { label: generando ? '⏳ Generando...' : '⬇ Exportar PDF', onClick: generarPDF } : null} />
      <div className={styles.content}>

        {loading ? <Spinner center size="lg" /> : encuestas.length === 0 ? (
          <div className={styles.empty}><p>No hay encuestas publicadas todavía.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Selector de encuesta */}
            <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Encuesta</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {encuestas.map(enc => (
                  <button key={enc.id} onClick={() => cargarEncuesta(enc)} style={{
                    padding: '8px 16px', borderRadius: 'var(--r)', cursor: 'pointer',
                    fontFamily: 'DM Sans', fontSize: 13, fontWeight: selected?.id === enc.id ? 700 : 500,
                    border: `1.5px solid ${selected?.id === enc.id ? 'var(--accent)' : 'var(--border2)'}`,
                    background: selected?.id === enc.id ? 'var(--accent-light)' : 'var(--surface)',
                    color: selected?.id === enc.id ? 'var(--accent)' : 'var(--ink2)',
                    transition: 'all .15s',
                  }}>{enc.nombre}</button>
                ))}
              </div>
            </div>

            {selected && (
              <>
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
                      {[['dashboard','📊 Dashboard'],['preguntas','📋 Por pregunta'],['comparar','🔀 Comparar'],['encuestadores','👥 Encuestadores']].map(([v, label]) => (
                        <button key={v} onClick={() => setVistaActiva(v)} style={tabStyle(vistaActiva === v)}>{label}</button>
                      ))}
                    </div>

                    {/* Vista Dashboard */}
                    {vistaActiva === 'dashboard' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                        {preguntas.filter(p => p.clave_base !== 'participa' && p.tipo !== 'texto_libre').slice(0, 6).map((p, i) => (
                          <div key={p.id} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>{p.texto}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 12 }}>
                              {respuestasMap[p.id]?.reduce((s,f) => s + Number(f.cantidad), 0) || 0} respuestas
                            </div>
                            <MiniChart pregunta={p} filas={respuestasMap[p.id] || []} tipo={p.tipo === 'si_no' ? 'doughnut' : p.tipo === 'opcion_multiple' ? 'horizontal' : 'bar'} color={PALETA[i % PALETA.length]} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vista Preguntas — todas */}
                    {vistaActiva === 'preguntas' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {preguntas.filter(p => p.clave_base !== 'participa').map((p, i) => (
                          <div key={p.id} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '20px', borderLeft: `3px solid ${PALETA[i % PALETA.length]}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{p.texto}</div>
                                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                                  {p.tipo} · {respuestasMap[p.id]?.reduce((s,f) => s + Number(f.cantidad), 0) || 0} respuestas
                                </div>
                              </div>
                            </div>
                            {p.tipo === 'texto_libre' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                                {(respuestasMap[p.id] || []).filter(f => f.valor_texto?.trim()).map((f, j) => (
                                  <div key={j} style={{ fontSize: 13, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--r)', borderLeft: `3px solid ${PALETA[i%PALETA.length]}`, color: 'var(--ink2)' }}>
                                    "{f.valor_texto}"
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <MiniChart pregunta={p} filas={respuestasMap[p.id] || []} tipo={p.tipo === 'si_no' ? 'doughnut' : 'bar'} color={PALETA[i % PALETA.length]} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vista Comparaciones */}
                    {vistaActiva === 'comparar' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--accent-light)', border: '1px solid #b7e4c7', borderRadius: 'var(--r2)', padding: '12px 16px', fontSize: 13, color: 'var(--accent2)', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Zap size={14} /> Comparaciones lado a lado. Seleccioná dos preguntas para comparar sus distribuciones.
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent2)' }}>💡 La IA podrá sugerir comparaciones relevantes cuando se integre en la VPS.</span>
                        </div>
                        {comparaciones.map((c, i) => (
                          <Comparacion key={c.id} preguntas={preguntas} respuestasMap={respuestasMap} index={i}
                            onRemove={() => setComparaciones(prev => prev.filter(x => x.id !== c.id))} />
                        ))}
                        <button onClick={() => setComparaciones(prev => [...prev, { id: Date.now() }])} style={{ padding: '10px', border: '1.5px dashed var(--border2)', borderRadius: 'var(--r2)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink3)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <Plus size={14} /> Agregar comparación
                        </button>
                      </div>
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
    </div>
  )
}