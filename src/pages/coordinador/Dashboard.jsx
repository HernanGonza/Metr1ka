import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from '../admin/Page.module.css'

export default function DashboardCoord() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!perfil?.id) return
    async function load() {
      // Equipo del coordinador
      const { data: ec } = await supabase
        .from('equipo_coordinadores')
        .select('equipo_id, equipos(nombre)')
        .eq('coordinador_id', perfil.id)
        .single()

      if (!ec) { setLoading(false); return }
      const equipo_id = ec.equipo_id

      // Encuestadores del equipo
      const { data: encs } = await supabase
        .from('equipo_encuestadores')
        .select('encuestador_id, perfiles(nombre_completo, activo)')
        .eq('equipo_id', equipo_id)

      // Encuestas asignadas al equipo
      const { data: ees } = await supabase
        .from('encuestas_equipo')
        .select('encuesta_id, encuestas(nombre, descripcion, estado_produccion, activo)')
        .eq('equipo_id', equipo_id)

      // Respuestas del equipo (últimas 7 días)
      const hace7 = new Date(Date.now() - 7*24*60*60*1000).toISOString()
      const encIds = (ees || []).map(e => e.encuesta_id)
      let sesiones = []
      if (encIds.length) {
        const encIds_members = (encs || []).map(e => e.encuestador_id)
        const { data: asg } = await supabase
          .from('asignaciones_encuesta')
          .select('id')
          .in('encuestador_id', encIds_members.length ? encIds_members : ['none'])
        if (asg?.length) {
          const { data: ses } = await supabase
            .from('sesiones_respuesta')
            .select('id, completada_en, iniciada_en')
            .in('asignacion_id', asg.map(a => a.id))
            .gte('iniciada_en', hace7)
          sesiones = ses || []
        }
      }

      setData({
        equipo: ec.equipos,
        equipo_id,
        encuestadores: encs || [],
        encuestas: ees || [],
        sesiones_semana: sesiones,
      })
      setLoading(false)
    }
    load()
  }, [perfil?.id])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = perfil?.nombre_completo?.split(' ')[0] || 'Coordinador'

  if (loading) return <div className={styles.page}><Spinner center size="lg" /></div>

  const activos  = data?.encuestadores?.filter(e => e.perfiles?.activo !== false).length ?? 0
  const encsActivas = data?.encuestas?.filter(e => e.encuestas?.activo && e.encuestas?.estado_produccion === 'publicada').length ?? 0
  const sesHoy   = data?.sesiones_semana?.filter(s => {
    const d = new Date(s.iniciada_en)
    const hoy = new Date()
    return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()
  }).length ?? 0

  const kpis = [
    { label: 'Encuestadores', value: data?.encuestadores?.length ?? 0, sub: `${activos} activos`, color: 'var(--accent)', bg: 'var(--accent-light)' },
    { label: 'Encuestas asignadas', value: data?.encuestas?.length ?? 0, sub: `${encsActivas} activas`, color: '#0369a1', bg: 'var(--info-light)' },
    { label: 'Respuestas hoy', value: sesHoy, sub: `${data?.sesiones_semana?.length ?? 0} esta semana`, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  ]

  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>

        {/* Saludo */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            {data?.equipo?.nombre ?? 'Mi equipo'}
          </div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--ink)', letterSpacing: -.5 }}>
            {saludo}, {nombre} 👋
          </h2>
          <p style={{ color: 'var(--ink3)', fontSize: 14, marginTop: 4 }}>
            Aquí tenés el estado actual de tu equipo.
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: k.bg, borderRadius: 'var(--r2)', padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Encuestadores del equipo */}
        {data?.encuestadores?.length > 0 && (
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Encuestadores del equipo</div>
              <button onClick={() => navigate('/coord/equipo')}
                style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Ver todos →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
              {data.encuestadores.slice(0, 6).map((e, i) => {
                const activo = e.perfiles?.activo !== false
                const initials = (e.perfiles?.nombre_completo || '?').split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
                return (
                  <div key={i} style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                    borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                    opacity: activo ? 1 : 0.6
                  }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: activo ? 'var(--accent-light)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: activo ? 'var(--accent2)' : 'var(--ink3)', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{e.perfiles?.nombre_completo || '—'}</div>
                      <div style={{ fontSize: 11, color: activo ? 'var(--accent2)' : 'var(--ink3)', fontWeight: 600 }}>
                        {activo ? '● Activo' : '○ Inactivo'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Encuestas asignadas */}
        {data?.encuestas?.length > 0 && (
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Encuestas asignadas</div>
              <button onClick={() => navigate('/coord/encuestas')}
                style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Ver todas →
              </button>
            </div>
            {data.encuestas.map((ee, i) => {
              const enc = ee.encuestas
              if (!enc) return null
              const estadoMap = {
                publicada:    { label: 'Publicada',    color: '#1a472a', bg: 'var(--accent-light)' },
                en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: 'var(--info-light)' },
                para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
                pendiente:    { label: 'Pendiente',    color: '#b45309', bg: 'var(--warning-light)' },
              }
              const cfg = estadoMap[enc.estado_produccion] || estadoMap.pendiente
              return (
                <div key={i} style={{ padding: '14px 20px', borderBottom: i < data.encuestas.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{enc.nombre}</div>
                    {enc.descripcion && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{enc.descripcion}</div>}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {!data && (
          <div className={styles.empty}>
            <p>No tenés ningún equipo asignado todavía.</p>
            <p style={{ fontSize: 13 }}>Contactá al administrador para que te asigne a un equipo.</p>
          </div>
        )}

      </div>
    </div>
  )
}