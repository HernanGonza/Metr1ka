import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { cacheGet, cacheSet } from '../../lib/cache'
import styles from './Page.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
}

function PreguntaChart({ pregunta, filas }) {
  const { tipo } = pregunta
  const opciones = pregunta.opciones_pregunta || []

  const datos = useMemo(() => {
    if (tipo === 'texto_libre') return null
    const conteo = {}
    if (tipo === 'si_no') {
      conteo['Sí'] = filas.filter(f => f.valor_booleano === true).reduce((s, f) => s + Number(f.cantidad), 0)
      conteo['No'] = filas.filter(f => f.valor_booleano === false).reduce((s, f) => s + Number(f.cantidad), 0)
    } else if (tipo === 'escala') {
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
    const values = Object.values(conteo)
    const total  = values.reduce((a, b) => a + b, 0)
    if (total === 0) return null
    return { labels: Object.keys(conteo), datasets: [{ data: values, backgroundColor: '#1a472a', borderRadius: 4, borderSkipped: false }], total }
  }, [filas, opciones, tipo])

  const card = { background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }

  if (tipo === 'texto_libre') {
    const textos = filas.filter(f => f.valor_texto?.trim())
    const total  = textos.reduce((s, f) => s + Number(f.cantidad), 0)
    return (
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{pregunta.texto}</div>
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{total} respuestas</div>
        {textos.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Sin respuestas aún</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
              {textos.slice(0, 20).map((f, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--r)', color: 'var(--ink2)' }}>
                  "{f.valor_texto}"
                </div>
              ))}
              {textos.length > 20 && <div style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center' }}>+ {textos.length - 20} más</div>}
            </div>
        }
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{pregunta.texto}</div>
      {!datos
        ? <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Sin respuestas aún</div>
        : <>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>{datos.total} respuestas</div>
            <div style={{ height: 180 }}>
              <Bar data={datos} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} (${Math.round(ctx.parsed.y / datos.total * 100)}%)` } } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              }} />
            </div>
          </>
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
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 6 }}>Descripción</div>
          <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{encuesta.descripcion}</div>
        </div>
      )}
      {preguntas.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
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
    respuestas.forEach(f => { if (map[String(f.pregunta_id)]) map[String(f.pregunta_id)].push(f) })
    return map
  }, [respuestas, preguntas])

  const encuestadoresFiltrados = useMemo(() =>
    filtros.equipo_id ? encuestadores.filter(e => e.equipo_id === filtros.equipo_id) : encuestadores,
    [encuestadores, filtros.equipo_id]
  )

  const kpis = [
    { label: 'Respuestas',       value: resumen?.total_sesiones   || 0, color: 'var(--accent)' },
    { label: 'Encuestadores',    value: resumen?.encuestadores    || 0, color: '#0369a1' },
    { label: 'Equipos activos',  value: resumen?.equipos          || 0, color: '#7c3aed' },
    { label: 'Última respuesta', value: resumen?.ultima_respuesta ? new Date(resumen.ultima_respuesta).toLocaleDateString('es-AR') : '—', color: '#b45309' },
  ]

  const hayFiltros = filtros.equipo_id || filtros.encuestador_id || filtros.fecha_desde || filtros.fecha_hasta
  const inp = { padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {preguntas.slice(0, 4).map(p => <PreguntaChart key={p.id} pregunta={p} filas={filasPorPregunta[String(p.id)] || []} />)}
        </div>
      )}

      {vista === 'preguntas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {preguntas.map(p => <PreguntaChart key={p.id} pregunta={p} filas={filasPorPregunta[String(p.id)] || []} />)}
        </div>
      )}

      {vista === 'encuestadores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onFiltroChange('equipo_id', null)}
                style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${!filtros.equipo_id ? 'var(--accent)' : 'var(--border2)'}`, background: !filtros.equipo_id ? 'var(--accent-light)' : '#fff', color: !filtros.equipo_id ? 'var(--accent)' : 'var(--ink3)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Todos
              </button>
              {equipos.map(eq => (
                <button key={eq.id} onClick={() => onFiltroChange('equipo_id', eq.id)}
                  style={{ padding: '5px 12px', borderRadius: 100, border: `1.5px solid ${filtros.equipo_id === eq.id ? 'var(--accent)' : 'var(--border2)'}`, background: filtros.equipo_id === eq.id ? 'var(--accent-light)' : '#fff', color: filtros.equipo_id === eq.id ? 'var(--accent)' : 'var(--ink3)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                  {eq.nombre}
                </button>
              ))}
            </div>
          )}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
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
                  <tr key={enc.encuestador_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--surface)' }}>
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

  const debounceRef = useRef(null)
  useEffect(() => {
    if (!encuesta || encuesta.estado_produccion !== 'publicada') return
    if (!hayFiltros) return // sin filtros ya tenemos las respuestas de fetchBase
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchRespuestas(), 300)
    return () => clearTimeout(debounceRef.current)
  }, [filtrosKey, encuesta?.id])

  async function fetchBase() {
    const cacheKey = `enc_base:${id}`
    const cached   = cacheGet(cacheKey)
    if (cached) {
      setEncuesta(cached.encuesta)
      setPreguntas(cached.preguntas)
      setResumen(cached.resumen)
      setEncuestadores(cached.encuestadores)
      setEquipos(cached.equipos)
      setRespuestas(cacheGet(`enc_resp:${id}:base`) || [])
      setLoading(false)
      return
    }
    setLoading(true); setError('')
    try {
      // Una sola RPC — 1 conexión en vez de 5
      const { data, error: rpcErr } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: id,
        p_org_id:      perfil.organizacion_id,
      })
      if (rpcErr) throw rpcErr
      if (!data || data.error === 'not_found') { navigate('/encuestas'); return }

      const payload = {
        encuesta:      data.encuesta,
        preguntas:     data.preguntas     || [],
        resumen:       data.resumen       || null,
        encuestadores: data.encuestadores || [],
        equipos:       data.equipos       || [],
      }
      cacheSet(cacheKey, payload, 300_000)
      const respBase = data.respuestas || []
      cacheSet(`enc_resp:${id}:base`, respBase, 300_000)

      setEncuesta(payload.encuesta)
      setPreguntas(payload.preguntas)
      setResumen(payload.resumen)
      setEncuestadores(payload.encuestadores)
      setEquipos(payload.equipos)
      setRespuestas(respBase)
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
        p_encuesta_id:    id,
        p_org_id:         perfil.organizacion_id,
        p_equipo_id:      filtroEquipo      || null,
        p_encuestador_id: filtroEncuestador || null,
        p_fecha_desde:    filtroDesde       || null,
        p_fecha_hasta:    filtroHasta       || null,
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
      setFiltroEquipo(null); setFiltroEncuestador(null)
      setFiltroDesde(null);  setFiltroHasta(null)
      // volver a respuestas base
      const respBase = cacheGet(`enc_resp:${id}:base`)
      if (respBase) setRespuestas(respBase)
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
        action={encuesta.estado_produccion === 'publicada' ? { label: '↻ Actualizar', onClick: () => { cacheSet(`enc_base:${id}`, null, 0); fetchBase() } } : null}
      />
      <div className={styles.content}>
        {error && <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--r)', fontSize: 13, color: '#c0392b', marginBottom: 12 }}>Error: {error}</div>}
        {encuesta.estado_produccion === 'publicada'
          ? <VistaResultados
              preguntas={preguntas} resumen={resumen}
              respuestas={respuestas} encuestadores={encuestadores}
              equipos={equipos} filtros={filtros}
              onFiltroChange={handleFiltroChange} loadingR={loadingR}
            />
          : <VistaProduccion encuesta={encuesta} preguntas={preguntas} />
        }
      </div>
    </div>
  )
}