import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

export default function SuperadminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const [orgs, users, encuestas, suscripciones] = await Promise.all([
        supabase.from('organizaciones').select('id, activo', { count: 'exact' }),
        supabase.from('perfiles').select('id, rol', { count: 'exact' }),
        supabase.from('encuestas').select('id, estado_produccion', { count: 'exact' }),
        supabase.from('suscripciones').select('id, estado, plan'),
      ])

      const orgsData = orgs.data || []
      const encuestasData = encuestas.data || []
      const suscData = suscripciones.data || []

      setStats({
        orgsTotal:    orgsData.length,
        orgsActivas:  orgsData.filter(o => o.activo).length,
        usersTotal:   users.count || 0,
        encuestasTotal:    encuestasData.length,
        encuestasPendientes: encuestasData.filter(e => e.estado_produccion === 'pendiente').length,
        encuestasPublicadas: encuestasData.filter(e => e.estado_produccion === 'publicada').length,
        suscActivas:  suscData.filter(s => s.estado === 'activa').length,
        suscVencidas: suscData.filter(s => s.estado === 'vencida').length,
      })
      setLoading(false)
    }
    fetchStats()
  }, [])

  const cards = stats ? [
    { label: 'Organizaciones activas', value: stats.orgsActivas, sub: `${stats.orgsTotal} total`, icon: '🏢', to: '/superadmin/organizaciones', color: '#1a472a' },
    { label: 'Usuarios en el sistema', value: stats.usersTotal, sub: 'todos los roles', icon: '👤', to: '/superadmin/usuarios', color: '#0369a1' },
    { label: 'Encuestas pendientes', value: stats.encuestasPendientes, sub: `${stats.encuestasPublicadas} publicadas`, icon: '📋', to: '/superadmin/encuestas', color: '#b45309' },
    { label: 'Suscripciones activas', value: stats.suscActivas, sub: stats.suscVencidas > 0 ? `${stats.suscVencidas} vencidas ⚠️` : 'todo al día', icon: '💳', to: '/superadmin/suscripciones', color: stats.suscVencidas > 0 ? '#c0392b' : '#1a472a' },
  ] : []

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin</div>
          <h1 className="sa-title">Dashboard</h1>
        </div>
      </div>

      <div className="sa-content">
        {loading ? <Spinner center size="lg" /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
              {cards.map((c, i) => (
                <Link key={i} to={c.to} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20, cursor: 'pointer', transition: 'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 22 }}>{c.icon}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>{c.label}</span>
                    </div>
                    <div style={{ fontFamily: 'Syne', fontSize: 36, fontWeight: 800, color: c.color, letterSpacing: -1 }}>{c.value}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>{c.sub}</div>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="sa-card">
                <div className="sa-card-header">
                  <div className="sa-card-title">Accesos rápidos</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Nueva organización', to: '/superadmin/organizaciones/nueva', icon: '🏢' },
                    { label: 'Nueva encuesta', to: '/superadmin/encuestas/nueva', icon: '📋' },
                    { label: 'Invitar usuario', to: '/superadmin/usuarios/invitar', icon: '👤' },
                  ].map((a, i) => (
                    <Link key={i} to={a.to} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--surface)', textDecoration: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 500, transition: 'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                    >
                      <span>{a.icon}</span> {a.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="sa-card">
                <div className="sa-card-header">
                  <div className="sa-card-title">Estado de producción</div>
                  <Link to="/superadmin/encuestas" style={{ fontSize: 12, color: 'var(--accent2)', textDecoration: 'none', fontWeight: 600 }}>Ver kanban →</Link>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Pendientes',    value: stats?.encuestasPendientes || 0, color: '#b45309', bg: '#fef3c7' },
                    { label: 'En proceso',    value: 0, color: '#0369a1', bg: '#e0f2fe' },
                    { label: 'Para revisar',  value: 0, color: '#7c3aed', bg: '#f3e8ff' },
                    { label: 'Publicadas',    value: stats?.encuestasPublicadas || 0, color: '#1a472a', bg: '#d8f3dc' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: s.bg }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: s.color }}>{s.label}</span>
                      <span style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}