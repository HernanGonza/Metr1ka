import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import styles from './Page.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
}

function FiltroBar({ equipos, encuestadores, filtros, onChange }) {
  return (
    <div className={styles.filtroCard}>
      <div className={styles.filtroGrid}>
        <div className={styles.filtroGroup}>
          <label>Equipo</label>
          <select
            value={filtros.equipo_id || ''}
            onChange={e => onChange({ ...filtros, equipo_id: e.target.value || null, encuestador_id: null })}
            className={styles.select}
          >
            <option value="">Todos los equipos</option>
            {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
          </select>
        </div>
        <div className={styles.filtroGroup}>
          <label>Encuestador</label>
          <select
            value={filtros.encuestador_id || ''}
            onChange={e => onChange({ ...filtros, encuestador_id: e.target.value || null })}
            className={styles.select}
            disabled={!filtros.equipo_id}
          >
            <option value="">Todos</option>
            {encuestadores
              .filter(enc => !filtros.equipo_id || enc.equipo_id === filtros.equipo_id)
              .map(enc => <option key={enc.id} value={enc.id}>{enc.nombre_completo}</option>)
            }
          </select>
        </div>
        <div className={styles.filtroGroup}>
          <label>Desde</label>
          <input type="date" value={filtros.fecha_desde || ''} onChange={e => onChange({ ...filtros, fecha_desde: e.target.value || null })} className={styles.input} />
        </div>
        <div className={styles.filtroGroup}>
          <label>Hasta</label>
          <input type="date" value={filtros.fecha_hasta || ''} onChange={e => onChange({ ...filtros, fecha_hasta: e.target.value || null })} className={styles.input} />
        </div>
        <div className={styles.filtroActions}>
          <button onClick={() => onChange({})} style={{ padding: '8px 16px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricaCard({ label, value, sub, color }) {
  return (
    <div className={styles.metricaCard} style={{ borderLeft: `4px solid ${color}` }}>
      <div className={styles.metricaLabel}>{label}</div>
      <div className={styles.metricaValue} style={{ color }}>{value}</div>
      {sub && <div className={styles.metricaSub}>{sub}</div>}
    </div>
  )
}

function PreguntaChart({ pregunta, respuestas }) {
  const { tipo } = pregunta
  const opciones = pregunta.opciones_pregunta || []

  const datos = useMemo(() => {
    if (tipo === 'texto_libre') return null
    const conteo = {}

    if (tipo === 'si_no') {
      conteo['Sí'] = respuestas.filter(r => r.valor_booleano === true).length
      conteo['No'] = respuestas.filter(r => r.valor_booleano === false).length
    } else if (tipo === 'escala') {
      for (let i = 1; i <= 10; i++) {
        conteo[i] = respuestas.filter(r => r.valor_numero === i).length
      }
    } else {
      respuestas.forEach(r => {
        const opt = opciones.find(o => o.id === r.opcion_id)
        if (opt) conteo[opt.texto] = (conteo[opt.texto] || 0) + 1
      })
    }

    const labels = Object.keys(conteo)
    const values = Object.values(conteo)
    const total = values.reduce((a, b) => a + b, 0)
    if (total === 0) return null

    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: '#1a472a',
        borderRadius: 4,
        borderSkipped: false,
      }],
      total,
    }
  }, [respuestas, opciones, tipo])

  if (tipo === 'texto_libre') {
    const textos = respuestas.filter(r => r.valor_texto?.trim())
    return (
      <div className={styles.preguntaCard}>
        <h4 className={styles.preguntaTitulo}>{pregunta.texto}</h4>
        {textos.length === 0
          ? <p className={styles.sinDatos}>Sin respuestas aún</p>
          : (
            <div className={styles.respuestasTexto}>
              {textos.slice(0, 20).map((r, i) => (
                <div key={i} className={styles.respuestaTextoItem}>{r.valor_texto}</div>
              ))}
              {textos.length > 20 && <div className={styles.verMas}>+ {textos.length - 20} más</div>}
            </div>
          )
        }
      </div>
    )
  }

  if (!datos) return (
    <div className={styles.preguntaCard}>
      <h4 className={styles.preguntaTitulo}>{pregunta.texto}</h4>
      <p className={styles.sinDatos}>Sin respuestas aún</p>
    </div>
  )

  return (
    <div className={styles.preguntaCard}>
      <h4 className={styles.preguntaTitulo}>{pregunta.texto}</h4>
      <div style={{ height: 220 }}>
        <Bar
          data={datos}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => `${ctx.parsed.y} (${Math.round(ctx.parsed.y / datos.total * 100)}%)`,
                }
              }
            },
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true, ticks: { stepSize: 1 } },
            },
          }}
        />
      </div>
    </div>
  )
}

export default function EncuestaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { perfil } = useAuth()

  const [encuesta,     setEncuesta]     = useState(null)
  const [preguntas,    setPreguntas]    = useState([])
  const [respuestas,   setRespuestas]   = useState([])
  const [equipos,      setEquipos]      = useState([])
  const [encuestadores,setEncuestadores]= useState([])
  const [filtros,      setFiltros]      = useState({})
  const [loading,      setLoading]      = useState(true)
  const [vista,        setVista]        = useState('resumen')

  useEffect(() => {
    async function load() { await fetchData() }
    load()
  }, [id, perfil?.organizacion_id])

  useEffect(() => {
    if (preguntas.length > 0) {
      async function load() { await fetchData() }
      load()
    }
  }, [filtros])

  async function fetchData() {
    if (!perfil?.organizacion_id || !id) return
    setLoading(true)
    try {
      // Encuesta
      const { data: encData } = await supabase
        .from('encuestas').select('*')
        .eq('id', id).eq('organizacion_id', perfil.organizacion_id)
        .single()
      if (!encData) { navigate('/encuestas'); return }
      setEncuesta(encData)

      // Preguntas con opciones
      const { data: pregData } = await supabase
        .from('preguntas').select('*, opciones_pregunta(id, texto, orden)')
        .eq('encuesta_id', id).order('orden')
      setPreguntas(pregData || [])

      // Equipos
      const { data: eqData } = await supabase
        .from('equipos').select('id, nombre')
        .eq('organizacion_id', perfil.organizacion_id)
      setEquipos(eqData || [])

      // Encuestadores con equipo
      const { data: encuestadoresData } = await supabase
        .from('perfiles').select('id, nombre_completo')
        .eq('rol', 'encuestador')
        .eq('organizacion_id', perfil.organizacion_id)

      const conEquipo = await Promise.all(
        (encuestadoresData || []).map(async enc => {
          const { data: eq } = await supabase
            .from('equipo_encuestadores').select('equipo_id')
            .eq('encuestador_id', enc.id).maybeSingle()
          return { ...enc, equipo_id: eq?.equipo_id }
        })
      )
      setEncuestadores(conEquipo)

      // Respuestas
      const pregIds = (pregData || []).map(p => p.id)
      if (pregIds.length === 0) { setRespuestas([]); return }

      let query = supabase
        .from('respuestas')
        .select(`
          id, pregunta_id, valor_texto, valor_numero, valor_booleano, opcion_id,
          sesion:sesiones_respuesta(
            id, completada_en, latitud, longitud,
            asignacion:asignaciones_encuesta(
              encuestador_id,
              encuestador:perfiles(id, nombre_completo),
              encuestas_equipo(equipo_id, equipo:equipos(id, nombre))
            )
          )
        `)
        .in('pregunta_id', pregIds)

      if (filtros.fecha_desde) query = query.gte('sesion.completada_en', filtros.fecha_desde)
      if (filtros.fecha_hasta) query = query.lte('sesion.completada_en', `${filtros.fecha_hasta}T23:59:59`)

      const { data: respData } = await query
      setRespuestas(respData || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const respuestasPorPregunta = useMemo(() => {
    const agrupado = {}
    preguntas.forEach(p => { agrupado[p.id] = [] })
    respuestas.forEach(r => {
      if (agrupado[r.pregunta_id]) agrupado[r.pregunta_id].push(r)
    })
    return agrupado
  }, [respuestas, preguntas])

  if (loading || !encuesta) return (
    <div className={styles.page}>
      <div className={styles.content}><Spinner center size="lg" /></div>
    </div>
  )

  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente
  const totalSesiones = new Set(respuestas.map(r => r.sesion_id)).size
  const sesionesCompletadas = respuestas.filter(r => r.sesion?.completada_en).length
  const tasaCompletitud = totalSesiones > 0 ? Math.round(sesionesCompletadas / totalSesiones * 100) : 0
  const ultimaRespuesta = [...respuestas]
    .filter(r => r.sesion?.completada_en)
    .sort((a, b) => new Date(b.sesion.completada_en) - new Date(a.sesion.completada_en))[0]

  return (
    <div className={styles.page}>
      <Topbar
        title={encuesta.nombre}
        back={{ label: 'Encuestas', onClick: () => navigate('/encuestas') }}
        badge={{ label: cfg.label, color: cfg.color, bg: cfg.bg }}
      />

      <div className={styles.content}>
        <FiltroBar equipos={equipos} encuestadores={encuestadores} filtros={filtros} onChange={setFiltros} />

        {/* Tabs */}
        <div className={styles.tabs}>
          {['resumen', 'preguntas', 'mapa'].map(v => (
            <button key={v} className={`${styles.tab} ${vista === v ? styles.active : ''}`} onClick={() => setVista(v)}>
              {v === 'resumen' ? 'Resumen' : v === 'preguntas' ? 'Por pregunta' : 'Mapa'}
            </button>
          ))}
        </div>

        {vista === 'resumen' && (
          <>
            <div className={styles.metricasGrid}>
              <MetricaCard label="Completadas"       value={sesionesCompletadas} sub={`de ${totalSesiones} iniciadas`} color="var(--accent)" />
              <MetricaCard label="Completitud"       value={`${tasaCompletitud}%`} sub={tasaCompletitud > 80 ? 'Excelente' : tasaCompletitud > 50 ? 'Regular' : 'Baja'} color={tasaCompletitud > 80 ? '#1a472a' : tasaCompletitud > 50 ? '#b45309' : '#c0392b'} />
              <MetricaCard label="Última respuesta"  value={ultimaRespuesta ? new Date(ultimaRespuesta.sesion.completada_en).toLocaleDateString('es-AR') : '—'} sub={ultimaRespuesta ? new Date(ultimaRespuesta.sesion.completada_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''} color="#0369a1" />
              <MetricaCard label="Equipos con datos" value={new Set(respuestas.map(r => r.sesion?.asignacion?.encuestas_equipo?.equipo_id).filter(Boolean)).size} sub="equipos activos" color="#7c3aed" />
            </div>
            <div className={styles.graficosGrid}>
              {preguntas.slice(0, 4).map(p => (
                <PreguntaChart key={p.id} pregunta={p} respuestas={respuestasPorPregunta[p.id] || []} />
              ))}
            </div>
          </>
        )}

        {vista === 'preguntas' && (
          <div className={styles.listaPreguntas}>
            {preguntas.map(p => (
              <PreguntaChart key={p.id} pregunta={p} respuestas={respuestasPorPregunta[p.id] || []} />
            ))}
          </div>
        )}

        {vista === 'mapa' && (
          <div className={styles.mapaCard}>
            <div className={styles.mapaPlaceholder}>
              <span style={{ fontSize: 32, marginBottom: 12 }}>🗺️</span>
              <p style={{ fontWeight: 600, margin: 0 }}>Mapa de respuestas</p>
              <p className={styles.mapaHint}>Integración con Leaflet — próximamente</p>
              <div className={styles.pins}>
                {respuestas
                  .filter(r => r.sesion?.latitud && r.sesion?.longitud)
                  .slice(0, 20)
                  .map((r, i) => (
                    <div key={i} className={styles.pin} style={{
                      left: `${((r.sesion.longitud + 58) / 20) * 100}%`,
                      top:  `${((r.sesion.latitud  + 29) / 10) * 100}%`,
                    }} />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}