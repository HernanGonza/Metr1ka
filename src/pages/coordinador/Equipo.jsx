import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from '../admin/Page.module.css'

function Avatar({ nombre }) {
  const initials = (nombre || '?').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--ink3)', minWidth: 90 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function EquipoCoord() {
  const { perfil }  = useAuth()
  const [equipo,     setEquipo]     = useState(null)
  const [encuestadores, setEncuestadores] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expandido,  setExpandido]  = useState(null)

  useEffect(() => {
    if (!perfil?.id) return
    async function load() {
      const { data: ec } = await supabase
        .from('equipo_coordinadores')
        .select('equipo_id, equipos(id, nombre, geofencing_activo)')
        .eq('coordinador_id', perfil.id)
        .single()

      if (!ec) { setLoading(false); return }
      setEquipo(ec.equipos)

      const { data: encs } = await supabase
        .from('equipo_encuestadores')
        .select(`
          encuestador_id,
          perfiles(
            id, nombre_completo, telefono, dni,
            localidad, provincia, activo, creado_en
          )
        `)
        .eq('equipo_id', ec.equipo_id)

      // Respuestas por encuestador (total histórico)
      const ids = (encs || []).map(e => e.encuestador_id)
      let stats = {}
      if (ids.length) {
        const { data: asg } = await supabase
          .from('asignaciones_encuesta')
          .select('id, encuestador_id')
          .in('encuestador_id', ids)
        if (asg?.length) {
          const { data: ses } = await supabase
            .from('sesiones_respuesta')
            .select('asignacion_id, completada_en')
            .in('asignacion_id', asg.map(a => a.id))
          const asgMap = Object.fromEntries(asg.map(a => [a.id, a.encuestador_id]))
          ;(ses || []).forEach(s => {
            const eid = asgMap[s.asignacion_id]
            if (!eid) return
            stats[eid] = stats[eid] || { total: 0, completadas: 0 }
            stats[eid].total++
            if (s.completada_en) stats[eid].completadas++
          })
        }
      }

      setEncuestadores(encs?.map(e => ({ ...e, stats: stats[e.encuestador_id] || { total: 0, completadas: 0 } })) || [])
      setLoading(false)
    }
    load()
  }, [perfil?.id])

  if (loading) return <div className={styles.page}><Spinner center size="lg" /></div>

  const activos   = encuestadores.filter(e => e.perfiles?.activo !== false)
  const inactivos = encuestadores.filter(e => e.perfiles?.activo === false)

  return (
    <div className={styles.page}>
      <Topbar title="Mi equipo" />
      <div className={styles.content}>

        {/* Header del equipo */}
        {equipo && (
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink3)', marginBottom: 4 }}>Equipo asignado</div>
              <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{equipo.nombre}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--accent-light)', borderRadius: 'var(--r)' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{activos.length}</div>
                <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600 }}>Activos</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: 'var(--ink3)' }}>{inactivos.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>Inactivos</div>
              </div>
            </div>
          </div>
        )}

        {encuestadores.length === 0 && (
          <div className={styles.empty}>
            <p>No hay encuestadores en tu equipo todavía.</p>
          </div>
        )}

        {/* Lista encuestadores activos */}
        {activos.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink3)', marginBottom: 10 }}>
              Encuestadores activos — {activos.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activos.map((e, i) => {
                const p = e.perfiles
                const isOpen = expandido === e.encuestador_id
                return (
                  <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                    <div
                      onClick={() => setExpandido(isOpen ? null : e.encuestador_id)}
                      style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    >
                      <Avatar nombre={p?.nombre_completo} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{p?.nombre_completo || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>
                          {p?.localidad ? `${p.localidad}${p.provincia ? `, ${p.provincia}` : ''}` : 'Sin ubicación'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Syne' }}>{e.stats.completadas}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink3)' }}>encuestas</div>
                        </div>
                        <div style={{ fontSize: 16, color: 'var(--ink3)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</div>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <InfoRow label="Teléfono" value={p?.telefono} />
                        <InfoRow label="DNI" value={p?.dni} />
                        <InfoRow label="Localidad" value={p?.localidad} />
                        <InfoRow label="Provincia" value={p?.provincia} />
                        <InfoRow label="En el sistema desde" value={p?.creado_en ? new Date(p.creado_en).toLocaleDateString('es-AR') : null} />
                        <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--paper)', borderRadius: 'var(--r)', display: 'flex', gap: 20 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne', color: 'var(--accent)' }}>{e.stats.completadas}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>Completadas</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne', color: 'var(--ink2)' }}>{e.stats.total - e.stats.completadas}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)' }}>En curso</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Inactivos */}
        {inactivos.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink3)', marginBottom: 10 }}>
              Inactivos — {inactivos.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inactivos.map((e, i) => (
                <div key={i} style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                  <Avatar nombre={e.perfiles?.nombre_completo} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{e.perfiles?.nombre_completo || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)' }}>Inactivo</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}