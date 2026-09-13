import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import ReportesAutomaticos from '../../components/ReportesAutomaticos'
import PreguntaChart from '../../components/PreguntaChart'
import MapaSesiones from '../../components/MapaSesiones'
import styles from './Page.module.css'

// Pantalla de resultados de una encuesta ONLINE — deliberadamente separada
// de EncuestaDetalle.jsx (encuestas de campo). Nadie se loguea para
// responder una encuesta online, así que no hay encuestadores, no hay
// equipos, y no hay zonas configuradas a mano: la única referencia
// geográfica es la ubicación aproximada por IP de cada respuesta. Reusa
// get_encuesta_full / get_respuestas_crudas (mismas RPCs que la pantalla de
// campo) porque ya sirven bien el resumen y el desglose por pregunta sin
// asumir encuestador/equipo — solo se dejan de usar get_stats_por_zona y
// las pestañas que no aplican.

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: 'var(--accent)', bg: 'var(--accent-light)' },
  completada:   { label: 'Completada',   color: 'var(--ink2)', bg: 'var(--surface2)' },
}

function fmtFecha(iso) {
  return iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
}

// Clave estable para agrupar/filtrar por ubicación — ciudad+país porque el
// mismo nombre de ciudad puede repetirse en países distintos.
function claveUbicacion(f) {
  return `${f.ciudad || ''}␟${f.pais || ''}`
}
function labelUbicacion(ciudad, pais) {
  if (!ciudad && !pais) return 'Ubicación desconocida'
  return [ciudad, pais].filter(Boolean).join(', ')
}

function BotonCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch { /* noop */ }
      }}
      style={{ padding: '3px 9px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'var(--paper)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)' }}>
      {copiado ? '✓ Copiado' : 'Copiar link'}
    </button>
  )
}

export default function EncuestaDetalleOnline() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { perfil } = useAuth()

  const [encuesta,   setEncuesta]   = useState(null)
  const [preguntas,  setPreguntas]  = useState([])
  const [resumen,    setResumen]    = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadingR,   setLoadingR]   = useState(false)
  const [error,      setError]      = useState('')

  const [crudo,        setCrudo]        = useState(null)
  const [loadingCrudo, setLoadingCrudo] = useState(false)

  // Filtro por ubicación (ciudad/país por IP) — pedido explícito: poder
  // aislar quién respondió desde el lugar esperado (ej. Posadas) de quien
  // respondió desde otro lado (ej. Candelaria), y también ver todo junto.
  // Sin selección = sin filtro = todo junto.
  const [ciudadesSel, setCiudadesSel] = useState([])
  const hayFiltroUbicacion = ciudadesSel.length > 0
  const toggleCiudad = (clave) => setCiudadesSel(sel => sel.includes(clave) ? sel.filter(c => c !== clave) : [...sel, clave])
  const limpiarUbicaciones = () => setCiudadesSel([])

  const [vista, setVista] = useState('resumen')
  const [filtroDesde, setFiltroDesde] = useState(null)
  const [filtroHasta, setFiltroHasta] = useState(null)
  const hayFiltros = filtroDesde || filtroHasta

  const [hayNuevos, setHayNuevos] = useState(false)
  const pendingRef = useRef(null)
  const totalRef   = useRef(0)

  useEffect(() => { totalRef.current = resumen?.total_participaron ?? 0 }, [resumen])

  // Sin cache local a propósito, a diferencia de EncuestaDetalle.jsx: esta
  // pantalla existe para monitorear respuestas que entran solas en vivo
  // (no hay una sesión de campo que "termina" y recién ahí se revisa), así
  // que cachear el resumen por 5 minutos solo generaba números viejos.
  async function fetchBase() {
    pendingRef.current = null
    setHayNuevos(false)
    setLoading(true); setError('')
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: id, p_org_id: perfil.organizacion_id,
      })
      if (rpcErr) throw rpcErr
      if (!data || data.error === 'not_found') { navigate('/encuestas'); return }
      setEncuesta(data.encuesta); setPreguntas(data.preguntas || [])
      setResumen(data.resumen || null); setRespuestas(data.respuestas || [])
    } catch (e) { console.error(e); setError(e.message) }
    setLoading(false)
  }

  useEffect(() => {
    if (perfil?.organizacion_id && id) { fetchBase(); cargarCrudo() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, perfil?.organizacion_id])

  // Realtime — mismo patrón que EncuestaDetalle.jsx: avisa que hay
  // respuestas nuevas sin pisar lo que el admin está mirando.
  useEffect(() => {
    if (!id || !perfil?.organizacion_id) return
    let debounce = null

    async function revisarNuevos() {
      try {
        const { data } = await supabase.rpc('get_encuesta_full', {
          p_encuesta_id: id, p_org_id: perfil.organizacion_id,
        })
        if (data && !data.error) {
          const nuevoTotal = data.resumen?.total_participaron ?? 0
          if (nuevoTotal !== totalRef.current) {
            pendingRef.current = data
            setHayNuevos(true)
          }
        }
      } catch (e) { console.error('[realtime online]', e) }
    }

    const channel = supabase
      .channel(`encuesta-online-live-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sesiones_respuesta' }, () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(revisarNuevos, 800)
      })
      .subscribe()

    const interval = setInterval(revisarNuevos, 20_000)
    return () => { if (debounce) clearTimeout(debounce); clearInterval(interval); supabase.removeChannel(channel) }
  }, [id, perfil?.organizacion_id])

  function aplicarNuevos() {
    const data = pendingRef.current
    if (data) {
      if (data.resumen) setResumen(data.resumen)
      if (data.respuestas) setRespuestas(data.respuestas)
      pendingRef.current = null
      setHayNuevos(false)
    } else {
      fetchBase()
    }
    cargarCrudo(filtroDesde, filtroHasta)
  }

  const debounceRef = useRef(null)
  useEffect(() => {
    if (!encuesta || !hayFiltros) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchRespuestasFiltradas()
      cargarCrudo(filtroDesde, filtroHasta)
    }, 300)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDesde, filtroHasta, encuesta?.id])

  async function fetchRespuestasFiltradas() {
    if (!id) return
    setLoadingR(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: id, p_org_id: perfil.organizacion_id,
        p_fecha_desde: filtroDesde || null, p_fecha_hasta: filtroHasta || null,
      })
      if (rpcErr) throw rpcErr
      setResumen(data?.resumen || null)
      setRespuestas(data?.respuestas || [])
    } catch (e) { console.error('fetchRespuestasFiltradas:', e) }
    setLoadingR(false)
  }

  function limpiarFiltros() {
    setFiltroDesde(null); setFiltroHasta(null)
    fetchBase()
    cargarCrudo()
  }

  // get_respuestas_crudas es la fuente para todo lo que necesita filtrar
  // por ubicación (get_encuesta_full no tiene ese filtro): la tabla de
  // ubicaciones, el mapa, y el desglose por pregunta cuando hay ciudades
  // tildadas (ver filasPorPreguntaFiltrado más abajo).
  async function cargarCrudo(desde = null, hasta = null) {
    if (!id || !perfil?.organizacion_id) return
    setLoadingCrudo(true)
    try {
      const { data } = await supabase.rpc('get_respuestas_crudas', {
        p_encuesta_id: id, p_org_id: perfil.organizacion_id,
        p_equipo_id: null, p_encuestador_id: null, p_fecha_desde: desde || null, p_fecha_hasta: hasta || null,
      })
      setCrudo(data || { columnas: [], filas: [] })
    } catch (e) { console.error('cargarCrudo:', e) }
    setLoadingCrudo(false)
  }

  const filasPorPregunta = useMemo(() => {
    const map = {}
    preguntas.forEach(p => { map[String(p.id)] = [] })
    respuestas.forEach(f => {
      if (!map[String(f.pregunta_id)]) map[String(f.pregunta_id)] = []
      map[String(f.pregunta_id)].push(f)
    })
    return map
  }, [respuestas, preguntas])

  const ubicaciones = useMemo(() => {
    const mapa = {}
    for (const f of crudo?.filas || []) {
      const clave = claveUbicacion(f)
      if (!mapa[clave]) mapa[clave] = { clave, ciudad: f.ciudad || null, pais: f.pais || null, total: 0 }
      mapa[clave].total++
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total)
  }, [crudo])

  const filasCrudoFiltradas = useMemo(() => {
    const filas = crudo?.filas || []
    if (!hayFiltroUbicacion) return filas
    const set = new Set(ciudadesSel)
    return filas.filter(f => set.has(claveUbicacion(f)))
  }, [crudo, ciudadesSel, hayFiltroUbicacion])

  // Reconstruye la misma forma que get_encuesta_full.respuestas (para poder
  // reusar PreguntaChart tal cual) a partir de get_respuestas_crudas, que
  // es la única de las dos RPCs con dato de ubicación por fila. texto_libre
  // no se agrupa por valor — una fila por respuesta, igual que sin filtro.
  // matriz queda afuera: get_respuestas_crudas colapsa sus varias filas en
  // una sola clave por sesión, así que el desglose filtrado quedaría
  // incompleto — para esas preguntas se sigue mostrando el total sin filtrar.
  const filasPorPreguntaFiltrado = useMemo(() => {
    if (!hayFiltroUbicacion) return null
    const map = {}
    // matriz no se puede reconstruir bien desde crudo (ver comentario
    // arriba) — se deja el total sin filtrar en vez de dejarla vacía.
    preguntas.forEach(p => { if (p.tipo === 'matriz') map[String(p.id)] = filasPorPregunta[String(p.id)] || [] })
    for (const fila of filasCrudoFiltradas) {
      for (const [pid, valorStr] of Object.entries(fila.respuestas || {})) {
        if (valorStr == null) continue
        const p = preguntas.find(pp => String(pp.id) === pid)
        if (!p || p.tipo === 'matriz') continue
        const arr = map[pid] || (map[pid] = [])
        if (p.tipo === 'texto_libre') {
          arr.push({ pregunta_id: pid, valor_texto: valorStr, cantidad: 1 })
        } else {
          const bucket = arr.find(b => b.valor_texto === valorStr)
          if (bucket) bucket.cantidad++
          else arr.push({ pregunta_id: pid, valor_texto: valorStr, valor_numero: p.tipo === 'escala' ? Number(valorStr) : null, cantidad: 1 })
        }
      }
    }
    return map
  }, [hayFiltroUbicacion, filasCrudoFiltradas, preguntas, filasPorPregunta])

  const filasPorPreguntaEfectivo = filasPorPreguntaFiltrado || filasPorPregunta

  // statsZona sintético de una sola fila — permite reusar ReportesAutomaticos
  // (resumen_ejecutivo suma completadas/total desde ahí) sin llamar a
  // get_stats_por_zona, que es 100% zona/campo.
  const statsZonaOnline = useMemo(() => resumen ? {
    por_zona: [{ zona_id: null, zona_nombre: 'Todas', total: resumen.total_sesiones || 0, completadas: resumen.total_participaron || 0, no_respuesta: resumen.total_no_respondieron || 0 }],
  } : null, [resumen])

  if (loading) return (
    <div className={styles.page}>
      <Topbar title="Encuesta online" back={{ label: 'Encuestas', onClick: () => navigate('/encuestas') }} />
      <div className={styles.content} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spinner center size="lg" />
      </div>
    </div>
  )
  if (!encuesta) return null

  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente
  // Sin "no respondieron" a propósito: a diferencia de una encuesta de
  // campo (donde esa cuenta sale de la pregunta "¿querés participar?"),
  // una online no tiene ese gate — el modal de términos ya lo reemplaza
  // (ver EncuestaBuilderOnline.jsx) — así que esa distinción no aplica acá.
  //
  // Con filtro de ubicación activo los KPIs se recalculan desde
  // filasCrudoFiltradas (get_encuesta_full no filtra por ciudad); sin
  // filtro se sigue usando `resumen` tal cual, que es el más completo.
  let totalKpi, tasaCompletitud, ultimaKpi
  if (hayFiltroUbicacion) {
    totalKpi = filasCrudoFiltradas.length
    const conRespuesta = filasCrudoFiltradas.filter(f => f.respuestas && Object.keys(f.respuestas).length > 0).length
    tasaCompletitud = totalKpi > 0 ? Math.round((conRespuesta / totalKpi) * 100) : null
    ultimaKpi = filasCrudoFiltradas.reduce((max, f) => (f.fecha && (!max || f.fecha > max)) ? f.fecha : max, null)
  } else {
    totalKpi = resumen?.total_sesiones || 0
    tasaCompletitud = resumen && resumen.total_sesiones > 0 ? Math.round((resumen.total_participaron / resumen.total_sesiones) * 100) : null
    ultimaKpi = resumen?.ultima_respuesta || null
  }

  const kpis = [
    { label: 'Respuestas',          value: totalKpi, color: 'var(--metric-a)' },
    { label: 'Tasa de completitud', value: tasaCompletitud != null ? `${tasaCompletitud}%` : '—', color: 'var(--metric-c)' },
    { label: 'Última respuesta',    value: ultimaKpi ? new Date(ultimaKpi).toLocaleDateString('es-AR') : '—', color: 'var(--metric-d)' },
  ]

  const columnasMapa = preguntas.filter(p => ['opcion_multiple', 'si_no'].includes(p.tipo) && p.clave_base !== 'participa')
  const inp = { padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--paper)' }

  return (
    <div className={styles.page}>
      <Topbar
        title={encuesta.nombre}
        back={{ label: 'Encuestas', onClick: () => navigate('/encuestas') }}
        badge={{ label: cfg.label, color: cfg.color, bg: cfg.bg }}
        action={['publicada', 'completada'].includes(encuesta.estado_produccion) ? {
          label: hayNuevos ? '🔴 Actualizar (hay respuestas nuevas)' : '↻ Actualizar',
          onClick: aplicarNuevos,
        } : null}
      />
      <div className={styles.content}>
        {error && <div style={{ padding: '10px 16px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>Error: {error}</div>}

        {/* Header — dominio y ventana de publicación */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🌐</span>
            {encuesta.subdominio ? (
              <>
                <a href={`https://${encuesta.subdominio}.metr1ka.com`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: 'var(--accent2)', textDecoration: 'none' }}>
                  {encuesta.subdominio}.metr1ka.com
                </a>
                <BotonCopiar texto={`https://${encuesta.subdominio}.metr1ka.com`} />
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--ink3)', fontStyle: 'italic' }}>Sin dominio asignado</span>
            )}
          </div>
          {(encuesta.publicar_desde || encuesta.publicar_hasta) && (
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
              ⏱ {fmtFecha(encuesta.publicar_desde) || 'sin inicio'} → {fmtFecha(encuesta.publicar_hasta) || 'sin cierre'}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 500, color: (k.value === 0 || k.value === '0') ? 'var(--metric-zero)' : k.color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filtro de fechas */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Desde</label>
            <input type="date" value={filtroDesde || ''} onChange={e => setFiltroDesde(e.target.value || null)} style={inp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)' }}>Hasta</label>
            <input type="date" value={filtroHasta || ''} onChange={e => setFiltroHasta(e.target.value || null)} style={inp} />
          </div>
          {hayFiltros && <button onClick={limpiarFiltros} style={{ ...inp, cursor: 'pointer', alignSelf: 'flex-end' }}>Limpiar</button>}
          {loadingR && <span style={{ fontSize: 11, color: 'var(--ink3)', alignSelf: 'flex-end', paddingBottom: 8 }}>Actualizando...</span>}
        </div>

        {/* Filtro de ubicación activo — visible en cualquier pestaña */}
        {hayFiltroUbicacion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 'var(--r)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>📍 Filtrando por ubicación:</span>
            {ciudadesSel.map(clave => {
              const u = ubicaciones.find(x => x.clave === clave)
              return (
                <span key={clave} style={{ fontSize: 12, background: '#fff', border: '1px solid var(--accent2)', color: 'var(--accent2)', borderRadius: 100, padding: '2px 6px 2px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {u ? labelUbicacion(u.ciudad, u.pais) : 'Ubicación desconocida'}
                  <button onClick={() => toggleCiudad(clave)} aria-label="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              )
            })}
            <button onClick={limpiarUbicaciones} style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'DM Sans' }}>Ver todas juntas</button>
          </div>
        )}

        {/* Tabs — sin Encuestadores / Por zona / Equipos */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {[['resumen', 'Resumen'], ['preguntas', 'Por pregunta'], ['ubicaciones', '📍 Ubicaciones'], ['mapa', '🗺️ Mapa'], ['analisis', '📊 Análisis y reportes']].map(([v, label]) => (
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
              <PreguntaChart key={p.id} pregunta={p} filas={filasPorPreguntaEfectivo[String(p.id)] || []} paletaIdx={i} />
            ))}
          </div>
        )}

        {vista === 'preguntas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {preguntas.filter(p => p.clave_base !== 'participa').map((p, i) => (
              <PreguntaChart key={p.id} pregunta={p} filas={filasPorPreguntaEfectivo[String(p.id)] || []} paletaIdx={i} />
            ))}
          </div>
        )}

        {vista === 'ubicaciones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
              Ubicación aproximada según la IP de cada respuesta. Tildá una o más para aislarlas del resto — sin nada tildado se ve todo junto.
            </div>
            {loadingCrudo && !crudo ? <Spinner center /> : (
              <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', width: 36 }} />
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ubicación</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Respuestas</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ubicaciones.map((u, i) => {
                      const seleccionada = ciudadesSel.includes(u.clave)
                      const totalGeneral = crudo?.filas?.length || 0
                      return (
                        <tr key={u.clave} onClick={() => toggleCiudad(u.clave)}
                          style={{ borderBottom: '1px solid var(--border)', background: seleccionada ? 'var(--accent-light)' : i % 2 === 0 ? 'var(--paper)' : 'var(--surface)', cursor: 'pointer' }}>
                          <td style={{ padding: '8px 14px' }}>
                            <input type="checkbox" checked={seleccionada} onChange={() => toggleCiudad(u.clave)} onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', width: 14, height: 14, accentColor: 'var(--accent)' }} />
                          </td>
                          <td style={{ padding: '8px 14px', fontWeight: seleccionada ? 700 : 400, color: seleccionada ? 'var(--accent2)' : 'var(--ink)' }}>{labelUbicacion(u.ciudad, u.pais)}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums' }}>{u.total}</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--ink3)' }}>{totalGeneral > 0 ? Math.round(u.total / totalGeneral * 100) : 0}%</td>
                        </tr>
                      )
                    })}
                    {ubicaciones.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)' }}>Todavía no hay respuestas con ubicación.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {vista === 'mapa' && (
          <MapaSesiones
            sesiones={filasCrudoFiltradas}
            columnas={columnasMapa}
            loading={loadingCrudo}
            variant="online"
            disclaimer="Ubicación aproximada según IP — puede no reflejar el lugar exacto del respondente."
          />
        )}

        {vista === 'analisis' && (
          <>
            {hayFiltroUbicacion && (
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 12 }}>
                ℹ️ El filtro de ubicación no aplica acá todavía — estos reportes se calculan sobre todas las respuestas.
              </div>
            )}
            <ReportesAutomaticos
              encuesta={encuesta} preguntas={preguntas}
              statsZona={statsZonaOnline}
              tipoEncuesta="online"
            />
          </>
        )}
      </div>
    </div>
  )
}
