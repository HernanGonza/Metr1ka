import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

const PALETA = ['#1a472a','#0369a1','#7c3aed','#b45309','#be185d','#047857','#2d6a4f','#0284c7']

const KPI_OPCIONES = [
  { key: 'total_sesiones',   label: 'Total de respuestas' },
  { key: 'encuestadores',    label: 'Encuestadores activos' },
  { key: 'equipos',          label: 'Equipos participantes' },
  { key: 'ultima_respuesta', label: 'Última respuesta' },
  { key: 'promedio_escala',  label: 'Promedio general (escalas)' },
]

function generarHTML(encuesta, preguntas, respuestas, resumen, configReporte) {
  const { kpisSeleccionados, preguntasSeleccionadas } = configReporte
  const filasPorPregunta = {}
  preguntas.forEach(p => { filasPorPregunta[String(p.id)] = [] })
  respuestas.forEach(f => { if (filasPorPregunta[String(f.pregunta_id)]) filasPorPregunta[String(f.pregunta_id)].push(f) })

  // Calcular promedio de escalas
  const filasEscala = respuestas.filter(f => f.tipo === 'escala' && f.valor_numero != null)
  const promedioEscala = filasEscala.length
    ? (filasEscala.reduce((s, f) => s + Number(f.valor_numero) * Number(f.cantidad), 0) /
       filasEscala.reduce((s, f) => s + Number(f.cantidad), 0)).toFixed(1)
    : '—'

  const kpiValues = {
    total_sesiones:   resumen?.total_sesiones || 0,
    encuestadores:    resumen?.encuestadores || 0,
    equipos:          resumen?.equipos || 0,
    ultima_respuesta: resumen?.ultima_respuesta ? new Date(resumen.ultima_respuesta).toLocaleDateString('es-AR') : '—',
    promedio_escala:  promedioEscala,
  }

  const kpisHTML = kpisSeleccionados.map((k, i) => {
    const kpi = KPI_OPCIONES.find(o => o.key === k)
    return `
      <div class="kpi" style="border-top-color:${PALETA[i % PALETA.length]}">
        <div class="kpi-valor" style="color:${PALETA[i % PALETA.length]}">${kpiValues[k]}</div>
        <div class="kpi-label">${kpi?.label || k}</div>
      </div>`
  }).join('')

  const preguntasFiltradas = preguntas.filter(p => preguntasSeleccionadas.includes(p.id))

  const preguntasHTML = preguntasFiltradas.map((p, idx) => {
    const filas = filasPorPregunta[String(p.id)] || []
    const color = PALETA[idx % PALETA.length]

    if (p.tipo === 'texto_libre') {
      const textos = filas.filter(f => f.valor_texto?.trim()).slice(0, 8)
      return `
        <div class="pregunta">
          <div class="pregunta-header" style="border-left-color:${color}">
            <div class="pregunta-titulo">${idx + 1}. ${p.texto}</div>
            <span class="tipo-badge">Texto libre</span>
          </div>
          ${textos.length === 0
            ? '<p class="sin-datos">Sin respuestas</p>'
            : textos.map(f => `<div class="texto-resp" style="border-left-color:${color}">"${f.valor_texto}"</div>`).join('')
          }
        </div>`
    }

    const opciones = p.opciones_pregunta || []
    const conteo = {}
    if (p.tipo === 'si_no') {
      conteo['Sí'] = filas.filter(f => f.valor_booleano === true).reduce((s, f) => s + Number(f.cantidad), 0)
      conteo['No'] = filas.filter(f => f.valor_booleano === false).reduce((s, f) => s + Number(f.cantidad), 0)
    } else if (p.tipo === 'escala') {
      for (let i = 1; i <= 10; i++) {
        const fila = filas.find(f => Number(f.valor_numero) === i)
        conteo[String(i)] = fila ? Number(fila.cantidad) : 0
      }
    } else {
      opciones.forEach(op => {
        const fila = filas.find(f => String(f.opcion_id) === String(op.id))
        conteo[op.texto] = fila ? Number(fila.cantidad) : 0
      })
    }
    const total = Object.values(conteo).reduce((a, b) => a + b, 0)

    if (total === 0) return `
      <div class="pregunta">
        <div class="pregunta-header" style="border-left-color:${color}">
          <div class="pregunta-titulo">${idx + 1}. ${p.texto}</div>
        </div>
        <p class="sin-datos">Sin respuestas aún</p>
      </div>`

    const tipo_label = { si_no: 'Sí / No', escala: 'Escala 1-10', opcion_multiple: 'Opción múltiple' }[p.tipo] || p.tipo
    const barras = Object.entries(conteo).map(([label, val]) => {
      const pct = total > 0 ? Math.round(val / total * 100) : 0
      return `
        <div class="barra-row">
          <div class="barra-label">${label}</div>
          <div class="barra-track"><div class="barra-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="barra-pct">${pct}% <span class="barra-n">(${val})</span></div>
        </div>`
    }).join('')

    return `
      <div class="pregunta">
        <div class="pregunta-header" style="border-left-color:${color}">
          <div class="pregunta-titulo">${idx + 1}. ${p.texto}</div>
          <span class="tipo-badge">${tipo_label} · ${total} respuestas</span>
        </div>
        <div class="barras">${barras}</div>
      </div>`
  }).join('')

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte — ${encuesta.nombre}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1a1a1a; background:#fff; padding:40px; font-size:13px; }
  .header { border-bottom:3px solid #1a472a; padding-bottom:20px; margin-bottom:28px; }
  .logo { font-size:10px; font-weight:700; letter-spacing:2px; color:#1a472a; text-transform:uppercase; margin-bottom:10px; }
  h1 { font-size:22px; font-weight:800; color:#1a472a; margin-bottom:4px; line-height:1.2; }
  .meta { font-size:12px; color:#777; margin-top:6px; display:flex; gap:16px; flex-wrap:wrap; }
  .meta span { display:flex; align-items:center; gap:4px; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:14px; margin-bottom:28px; }
  .kpi { background:#fafaf8; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; border-top:3px solid; }
  .kpi-valor { font-size:26px; font-weight:800; margin-bottom:3px; }
  .kpi-label { font-size:10px; color:#666; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .seccion-titulo { font-size:14px; font-weight:700; color:#1a472a; margin-bottom:14px; padding-bottom:8px; border-bottom:2px solid #e5e7eb; }
  .pregunta { margin-bottom:22px; padding:16px 18px; border:1px solid #e5e7eb; border-radius:10px; page-break-inside:avoid; }
  .pregunta-header { padding-left:10px; border-left:3px solid; margin-bottom:12px; }
  .pregunta-titulo { font-size:13px; font-weight:700; margin-bottom:4px; }
  .tipo-badge { font-size:10px; color:#888; background:#f3f4f6; padding:2px 8px; border-radius:100px; display:inline-block; }
  .barra-row { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
  .barra-label { font-size:11px; width:130px; flex-shrink:0; color:#444; }
  .barra-track { flex:1; height:16px; background:#f3f4f6; border-radius:4px; overflow:hidden; }
  .barra-fill { height:100%; border-radius:4px; min-width:2px; transition:width 0.3s; }
  .barra-pct { font-size:11px; font-weight:700; width:70px; text-align:right; }
  .barra-n { font-weight:400; color:#aaa; }
  .texto-resp { font-size:11px; padding:7px 10px; background:#fafaf8; border-left:3px solid; margin-bottom:5px; border-radius:0 4px 4px 0; color:#555; }
  .sin-datos { font-size:12px; color:#bbb; font-style:italic; }
  .footer { margin-top:36px; padding-top:14px; border-top:1px solid #e5e7eb; font-size:10px; color:#bbb; display:flex; justify-content:space-between; }
  @media print { body { padding:20px; } .pregunta { page-break-inside:avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">METR1KA · Reporte de encuesta</div>
    <h1>${encuesta.nombre}</h1>
    <div class="meta">
      ${encuesta.descripcion ? `<span>📋 ${encuesta.descripcion}</span>` : ''}
      <span>📅 Generado el ${fecha}</span>
    </div>
  </div>
  <div class="kpis">${kpisHTML}</div>
  <div class="seccion-titulo">Resultados por pregunta (${preguntasFiltradas.length} de ${preguntas.length})</div>
  ${preguntasHTML}
  <div class="footer">
    <span>METR1KA — encuestasenfoquemisiones.vercel.app</span>
    <span>${fecha}</span>
  </div>
</body>
</html>`
}

export default function Reportes() {
  const { perfil } = useAuth()
  const [encuestas,  setEncuestas]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)   // encuesta seleccionada
  const [loadingEnc, setLoadingEnc] = useState(false)
  const [data,       setData]       = useState(null)   // resultado de get_encuesta_full
  const [generando,  setGenerando]  = useState(false)

  // Config del reporte
  const [kpisSeleccionados,     setKpisSeleccionados]     = useState(['total_sesiones','encuestadores','equipos','ultima_respuesta'])
  const [preguntasSeleccionadas, setPreguntasSeleccionadas] = useState([])
  const [filtroEquipo,          setFiltroEquipo]          = useState('')
  const [filtroEncuestador,     setFiltroEncuestador]     = useState('')
  const [filtroDesde,           setFiltroDesde]           = useState('')
  const [filtroHasta,           setFiltroHasta]           = useState('')

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
    setData(d)
    setPreguntasSeleccionadas((d?.preguntas || []).map(p => p.id))
    setLoadingEnc(false)
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
    setData(d)
    setLoadingEnc(false)
  }

  function toggleKpi(key) {
    setKpisSeleccionados(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function togglePregunta(id) {
    setPreguntasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function generarPDF() {
    if (!data || !selected) return
    setGenerando(true)
    try {
      const html = generarHTML(
        data.encuesta || selected,
        data.preguntas || [],
        data.respuestas || [],
        data.resumen || null,
        { kpisSeleccionados, preguntasSeleccionadas }
      )
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); setGenerando(false) }, 600)
    } catch (e) {
      console.error(e); setGenerando(false)
    }
  }

  const equipos      = useMemo(() => {
    const map = {}
    ;(data?.encuestadores || []).forEach(e => { if (e.equipo_id) map[e.equipo_id] = e.equipo_nombre })
    return Object.entries(map).map(([id, nombre]) => ({ id, nombre }))
  }, [data?.encuestadores])

  const encuestadoresFiltrados = useMemo(() =>
    filtroEquipo
      ? (data?.encuestadores || []).filter(e => e.equipo_id === filtroEquipo)
      : (data?.encuestadores || []),
    [data?.encuestadores, filtroEquipo]
  )

  const inp = { padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', background: '#fff', width: '100%' }

  return (
    <div className={styles.page}>
      <Topbar title="Reportes" />
      <div className={styles.content}>

        {loading ? <Spinner center size="lg" /> : encuestas.length === 0 ? (
          <div className={styles.empty}><p>No hay encuestas publicadas todavía.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Selección de encuesta */}
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 10 }}>1 · Seleccioná una encuesta</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {encuestas.map(enc => (
                  <button key={enc.id} onClick={() => cargarEncuesta(enc)} style={{
                    padding: '10px 14px', borderRadius: 'var(--r)',
                    border: `1.5px solid ${selected?.id === enc.id ? 'var(--accent)' : 'var(--border2)'}`,
                    background: selected?.id === enc.id ? 'var(--accent-light)' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: selected?.id === enc.id ? 'var(--accent)' : 'var(--ink)' }}>{enc.nombre}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{new Date(enc.creado_en).toLocaleDateString('es-AR')}</span>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <>
                {/* Filtros */}
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 12 }}>2 · Filtros de datos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
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
                  <button onClick={aplicarFiltros} disabled={loadingEnc} style={{ marginTop: 12, padding: '7px 16px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    {loadingEnc ? 'Cargando...' : 'Aplicar filtros'}
                  </button>
                </div>

                {loadingEnc && <div style={{ textAlign: 'center', padding: 20 }}><Spinner size="md" /></div>}

                {data && !loadingEnc && (
                  <>
                    {/* KPIs */}
                    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 10 }}>3 · KPIs a incluir en el reporte</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {KPI_OPCIONES.map(k => (
                          <button key={k.key} onClick={() => toggleKpi(k.key)} style={{
                            padding: '5px 12px', borderRadius: 100, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer',
                            border: `1.5px solid ${kpisSeleccionados.includes(k.key) ? 'var(--accent)' : 'var(--border2)'}`,
                            background: kpisSeleccionados.includes(k.key) ? 'var(--accent-light)' : '#fff',
                            color: kpisSeleccionados.includes(k.key) ? 'var(--accent)' : 'var(--ink3)',
                            fontWeight: kpisSeleccionados.includes(k.key) ? 700 : 400,
                          }}>{k.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Preguntas */}
                    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>4 · Preguntas a incluir</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setPreguntasSeleccionadas((data.preguntas || []).map(p => p.id))} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>Todas</button>
                          <button onClick={() => setPreguntasSeleccionadas([])} style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>Ninguna</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(data.preguntas || []).map((p, i) => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r)', background: preguntasSeleccionadas.includes(p.id) ? 'var(--accent-light)' : 'var(--surface)', cursor: 'pointer', border: `1px solid ${preguntasSeleccionadas.includes(p.id) ? '#b7e4c7' : 'transparent'}` }}>
                            <input type="checkbox" checked={preguntasSeleccionadas.includes(p.id)} onChange={() => togglePregunta(p.id)} style={{ accentColor: 'var(--accent)', width: 14, height: 14, flexShrink: 0 }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETA[i % PALETA.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: preguntasSeleccionadas.includes(p.id) ? 600 : 400 }}>{p.texto}</span>
                            <span style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto' }}>{p.tipo}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Preview stats */}
                    <div style={{ background: 'var(--accent-light)', border: '1px solid #b7e4c7', borderRadius: 'var(--r2)', padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, color: 'var(--accent2)' }}>
                        <strong>{kpisSeleccionados.length}</strong> KPIs · <strong>{preguntasSeleccionadas.length}</strong> preguntas · <strong>{data.resumen?.total_sesiones || 0}</strong> respuestas
                      </div>
                      <button
                        onClick={generarPDF}
                        disabled={generando || kpisSeleccionados.length === 0 || preguntasSeleccionadas.length === 0}
                        style={{
                          padding: '9px 22px', background: 'var(--accent)', color: '#fff',
                          border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 700,
                          cursor: generando ? 'wait' : 'pointer', fontFamily: 'DM Sans',
                          opacity: (kpisSeleccionados.length === 0 || preguntasSeleccionadas.length === 0) ? 0.5 : 1,
                        }}
                      >
                        {generando ? '⏳ Generando...' : '⬇ Generar PDF'}
                      </button>
                    </div>
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