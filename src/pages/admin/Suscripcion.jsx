import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

const PLAN_INFO = {
  arranque:   { label: 'Arranque',   encuestas: 3,    encuestadores: 15,   color: '#0369a1', bg: '#e0f2fe', icon: '🌱' },
  estandar:   { label: 'Estándar',   encuestas: 10,   encuestadores: 60,   color: '#7c3aed', bg: '#f3e8ff', icon: '⭐' },
  territorio: { label: 'Territorio', encuestas: '∞',  encuestadores: '∞',  color: '#1a472a', bg: '#d8f3dc', icon: '🏆' },
}
const ESTADO_INFO = {
  activa:     { label: 'Activa',     color: '#1a472a', bg: '#d8f3dc' },
  trial:      { label: 'Trial',      color: '#0369a1', bg: '#e0f2fe' },
  vencida:    { label: 'Vencida',    color: '#c0392b', bg: '#fdecea' },
  suspendida: { label: 'Suspendida', color: '#b45309', bg: '#fef3c7' },
}
const PLANES = [
  { key: 'arranque',   label: 'Arranque',   desc: '3 encuestas · hasta 15 encuestadores',   icon: '🌱' },
  { key: 'estandar',  label: 'Estándar',   desc: '10 encuestas · hasta 60 encuestadores',  icon: '⭐' },
  { key: 'territorio',label: 'Territorio', desc: 'Encuestas ilimitadas · sin límite',       icon: '🏆' },
]

export default function Suscripcion() {
  const { perfil } = useAuth()
  const [susc, setSusc]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!perfil?.organizacion_id) return
      const { data } = await supabase
        .from('suscripciones')
        .select('*')
        .eq('organizacion_id', perfil.organizacion_id)
        .maybeSingle()
      setSusc(data)
      setLoading(false)
    }
    load()
  }, [perfil?.organizacion_id])

  if (loading) return (
    <div className={styles.page}>
      <Topbar title="Suscripción" />
      <div className={styles.content}><Spinner center size="lg" /></div>
    </div>
  )

  const plan   = susc ? PLAN_INFO[susc.plan]   : null
  const estado = susc ? ESTADO_INFO[susc.estado] : null
  const hoy    = new Date()
  const vence  = susc?.fecha_vencimiento ? new Date(susc.fecha_vencimiento) : null
  const dias   = vence ? Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24)) : null
  const urgente = dias !== null && dias >= 0 && dias <= 14
  const vencida = susc?.estado === 'vencida' || (dias !== null && dias < 0)

  return (
    <div className={styles.page}>
      <Topbar title="Suscripción" />
      <div className={styles.content}>

        {/* Alerta de vencimiento */}
        {(urgente || vencida) && (
          <div style={{ padding: '16px 20px', background: vencida ? '#fdecea' : '#fef3c7', borderRadius: 'var(--r2)', borderLeft: `4px solid ${vencida ? 'var(--danger)' : '#fcd34d'}`, display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 24 }}>
            <span style={{ fontSize: 24 }}>{vencida ? '🚫' : '⚠️'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: vencida ? 'var(--danger)' : '#b45309', marginBottom: 4 }}>
                {vencida ? 'Tu suscripción venció' : `Tu suscripción vence en ${dias} día${dias !== 1 ? 's' : ''}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.5 }}>
                Para renovar o actualizar tu plan, contactanos a{' '}
                <a href="mailto:hola@metr1ka.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>hola@metr1ka.com</a>
                {' '}o hacé clic en el botón de abajo.
              </div>
            </div>
          </div>
        )}

        {/* Plan actual */}
        {!susc ? (
          <div style={{ padding: 24, background: 'var(--surface)', borderRadius: 'var(--r2)', fontSize: 14, color: 'var(--ink3)', textAlign: 'center' }}>
            No hay información de suscripción. Contactá a soporte.
          </div>
        ) : (
          <>
            <div style={{ background: plan?.bg, border: `2px solid ${plan?.color}`, borderRadius: 'var(--r2)', padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: plan?.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Plan actual</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{plan?.icon}</span>
                    <span style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: plan?.color, letterSpacing: -1 }}>{plan?.label}</span>
                  </div>
                </div>
                <span style={{ padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: estado?.bg, color: estado?.color }}>
                  {estado?.label}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Encuestas incluidas', value: plan?.encuestas },
                  { label: 'Encuestadores máx.', value: plan?.encuestadores },
                  { label: 'Vencimiento', value: vence ? vence.toLocaleDateString('es-AR') : '—' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,.65)', borderRadius: 'var(--r)', padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: plan?.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Barra de tiempo */}
              {dias !== null && !vencida && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: plan?.color, fontWeight: 600, marginBottom: 6 }}>
                    <span>Tiempo restante</span>
                    <span>{dias} días</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,.4)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: 6, borderRadius: 3,
                      background: plan?.color,
                      width: `${Math.min(100, Math.max(2, (dias / 365) * 100))}%`,
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Monto si está cargado */}
            {susc.monto && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--ink2)', fontWeight: 600 }}>Valor del plan</span>
                <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                  ${Number(susc.monto).toLocaleString('es-AR')} / mes
                </span>
              </div>
            )}
          </>
        )}

        {/* Comparativa de planes */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, marginBottom: 14, letterSpacing: -.5 }}>Planes disponibles</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {PLANES.map(p => {
              const info  = PLAN_INFO[p.key]
              const actual = susc?.plan === p.key
              return (
                <div key={p.key} style={{ background: actual ? info.bg : '#fff', border: `2px solid ${actual ? info.color : 'var(--border)'}`, borderRadius: 'var(--r2)', padding: '18px 20px', transition: 'all .15s' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{p.icon}</div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: actual ? info.color : 'var(--ink)', marginBottom: 4 }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12 }}>{p.desc}</div>
                  {actual && (
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: info.color, color: '#fff' }}>Tu plan actual</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA contacto / futura pasarela */}
        <div style={{ background: 'var(--accent)', borderRadius: 'var(--r2)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 6 }}>
              {vencida ? '¿Necesitás renovar?' : '¿Querés cambiar de plan?'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
              Contactanos y te asesoramos. Próximamente podrás gestionar tu suscripción desde acá.
            </div>
          </div>
          <a
            href="mailto:hola@metr1ka.com?subject=Suscripción METR1KA"
            style={{ padding: '12px 22px', background: '#fff', color: 'var(--accent)', borderRadius: 'var(--r)', fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'DM Sans', flexShrink: 0 }}
          >
            Contactar
          </a>
        </div>

      </div>
    </div>
  )
}