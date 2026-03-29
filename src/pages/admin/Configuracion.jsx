import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

const PLAN_INFO = {
  arranque:  { label: 'Arranque',  encuestas: 3,  encuestadores: 15, color: '#0369a1', bg: '#e0f2fe' },
  estandar:  { label: 'Estándar', encuestas: 10, encuestadores: 60, color: '#7c3aed', bg: '#f3e8ff' },
  territorio:{ label: 'Territorio', encuestas: '∞', encuestadores: '∞', color: '#1a472a', bg: '#d8f3dc' },
}
const ESTADO_INFO = {
  activa:     { label: 'Activa',     color: '#1a472a', bg: '#d8f3dc' },
  trial:      { label: 'Trial',      color: '#0369a1', bg: '#e0f2fe' },
  vencida:    { label: 'Vencida',    color: '#c0392b', bg: '#fdecea' },
  suspendida: { label: 'Suspendida', color: '#b45309', bg: '#fef3c7' },
}

export default function Configuracion() {
  const { perfil, rol } = useAuth()
  const [suscripcion, setSuscripcion] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSusc() {
      if (!perfil?.organizacion_id) return
      const { data } = await supabase
        .from('suscripciones')
        .select('*')
        .eq('organizacion_id', perfil.organizacion_id)
        .single()
      setSuscripcion(data)
      setLoading(false)
    }
    fetchSusc()
  }, [perfil?.organizacion_id])

  // Solo admin ve la suscripción — gestor no
  const esAdmin = rol === 'admin'

  if (loading) return (
    <div className={styles.page}>
      <Topbar title="Configuración" />
      <div className={styles.content}><Spinner center size="lg" /></div>
    </div>
  )

  const plan     = suscripcion ? PLAN_INFO[suscripcion.plan] : null
  const estado   = suscripcion ? ESTADO_INFO[suscripcion.estado] : null
  const hoy      = new Date()
  const vence    = suscripcion?.fecha_vencimiento ? new Date(suscripcion.fecha_vencimiento) : null
  const dias     = vence ? Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24)) : null
  const urgente  = dias !== null && dias <= 7
  const vencida  = suscripcion?.estado === 'vencida' || (dias !== null && dias < 0)

  return (
    <div className={styles.page}>
      <Topbar title="Configuración" />
      <div className={styles.content}>

        {/* ── SUSCRIPCIÓN (solo admin) ── */}
        {esAdmin && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: -.5 }}>
              Suscripción
            </h2>

            {!suscripcion ? (
              <div style={{ padding: '24px', background: '#fef3c7', borderRadius: 'var(--r2)', fontSize: 14, color: '#b45309', borderLeft: '4px solid #fcd34d' }}>
                No hay información de suscripción. Contactá a soporte.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Alerta de vencimiento */}
                {(urgente || vencida) && (
                  <div style={{ padding: '14px 18px', background: vencida ? '#fdecea' : '#fef3c7', borderRadius: 'var(--r2)', borderLeft: `4px solid ${vencida ? 'var(--danger)' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{vencida ? '🚫' : '⚠️'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: vencida ? 'var(--danger)' : '#b45309' }}>
                        {vencida ? 'Tu suscripción venció' : `Tu suscripción vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 2 }}>
                        Contactá a <a href="mailto:hola@metr1ka.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>hola@metr1ka.com</a> para renovar.
                      </div>
                    </div>
                  </div>
                )}

                {/* Card de plan */}
                <div style={{ background: plan?.bg || 'var(--surface)', borderRadius: 'var(--r2)', padding: '20px 24px', border: `2px solid ${plan?.color || 'var(--border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: plan?.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Plan actual</div>
                      <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: plan?.color, letterSpacing: -1 }}>{plan?.label}</div>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: estado?.bg, color: estado?.color }}>
                      {estado?.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {[
                      { label: 'Encuestas incluidas', value: plan?.encuestas },
                      { label: 'Encuestadores', value: plan?.encuestadores },
                      { label: 'Vencimiento', value: vence ? vence.toLocaleDateString('es-AR') : '—' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,.7)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: plan?.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Días restantes si está activa */}
                {dias !== null && dias >= 0 && !vencida && (
                  <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 600, marginBottom: 8 }}>Tiempo restante</div>
                    <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{
                        height: 8, borderRadius: 4,
                        background: dias <= 7 ? 'var(--danger)' : dias <= 30 ? '#b45309' : 'var(--accent)',
                        width: `${Math.min(100, Math.max(2, (dias / 365) * 100))}%`,
                        transition: 'width .3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                      <strong style={{ color: dias <= 7 ? 'var(--danger)' : 'var(--ink)' }}>{dias} días</strong> hasta el vencimiento
                    </div>
                  </div>
                )}

                {/* Contacto */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>¿Querés cambiar de plan o renovar?</div>
                    <div style={{ fontSize: 13, color: 'var(--ink3)' }}>Contactanos y te ayudamos.</div>
                  </div>
                  <a href="mailto:hola@metr1ka.com" style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
                    Contactar
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIGURACIÓN GENERAL (todos) ── */}
        <div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: -.5 }}>
            Mi cuenta
          </h2>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
            {[
              { label: 'Nombre completo', value: perfil?.nombre_completo },
              { label: 'Teléfono', value: perfil?.telefono || '—' },
              { label: 'Organización', value: perfil?.organizaciones?.nombre || '—' },
              { label: 'Rol', value: rol === 'admin' ? 'Admin' : rol === 'gestor' ? 'Gestor' : rol },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>{item.label}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{item.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}