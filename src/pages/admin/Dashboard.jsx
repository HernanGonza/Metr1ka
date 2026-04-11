import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import Chart from 'chart.js/auto'
import styles from './Page.module.css'

function MiniBarChart({ data, labels }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !data.length) return
    const c = new Chart(ref.current.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: '#1a472a', borderRadius: 4, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: () => '' } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
          y: { display: false, beginAtZero: true },
        },
      },
    })
    return () => c.destroy()
  }, [data])
  return <canvas ref={ref} />
}

function KpiCard({ label, value, sub, color = 'var(--accent)', icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{sub}</div>}
    </div>
  )
}

function EncuestaRow({ enc, onClick }) {
  const total = enc.sesiones_count || 0
  const meta  = 300
  const pct   = Math.min(100, Math.round((total / meta) * 100))
  const cfg = {
    publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
    en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
    para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
    pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  }[enc.estado_produccion] || { label: enc.estado_produccion, color: '#64748b', bg: '#f1f5f9' }

  return (
    <div onClick={onClick}
      style={{ padding: '14px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', cursor: 'pointer', transition: 'box-shadow .15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: enc.estado_produccion === 'publicada' ? 10 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enc.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{enc.equipos_count || 0} equipo{enc.equipos_count !== 1 ? 's' : ''}</div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{cfg.label}</span>
      </div>
      {enc.estado_produccion === 'publicada' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ color: 'var(--ink3)' }}>Respuestas</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{total} <span style={{ color: 'var(--ink3)', fontWeight: 400 }}>de {meta} previstas</span></span>
          </div>
          <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: 5, background: 'var(--accent)', borderRadius: 3, width: `${pct}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 4, fontWeight: 600 }}>{pct}%</div>
        </>
      )}
    </div>
  )
}

function EncuestadorRow({ enc, rank }) {
  const colores = ['#1a472a','#0369a1','#7c3aed','#b45309','#0891b2','#059669']
  const bg = colores[(rank - 1) % colores.length]
  const iniciales = enc.nombre_completo?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, background: rank <= 3 ? '#fef3c7' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: rank <= 3 ? '#b45309' : 'var(--ink3)', flexShrink: 0 }}>{rank}</div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{iniciales}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enc.nombre_completo}</div>
        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{enc.equipo_nombre || 'Sin equipo'}</div>
      </div>
      <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>{enc.total}</div>
    </div>
  )
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()
  const orgId      = perfil?.organizacion_id

  const [loading,   setLoading]   = useState(true)
  const [kpis,      setKpis]      = useState({ enc_activas: 0, enc_total: 0 })
  const [encuestas, setEncuestas] = useState([])
  const [porDia,    setPorDia]    = useState([])
  const [topEnc,    setTopEnc]    = useState([])
  const [hoy,       setHoy]       = useState(0)

  useEffect(() => { if (orgId) fetchAll() }, [orgId])

  // Auto-refresh cada 30s + realtime si está disponible
  useEffect(() => {
    if (!orgId) return

    // Polling como fallback confiable
    const interval = setInterval(() => fetchAll(), 30000)

    // Realtime como complemento
    const channel = supabase
      .channel(`dashboard-admin-${orgId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sesiones_respuesta',
      }, () => fetchAll())
      .subscribe((status) => {
        console.log('[realtime dashboard]', status)
      })

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [orgId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [kpisRes, encRes, diasRes, topRes] = await Promise.all([
        supabase.rpc('get_dashboard_kpis',         { p_org_id: orgId }),
        supabase.rpc('get_encuestas_con_sesiones',  { p_org_id: orgId }),
        supabase.rpc('get_sesiones_por_dia',        { p_org_id: orgId, p_dias: 7 }),
        supabase.rpc('get_top_encuestadores',       { p_org_id: orgId, p_dias: 7, p_limit: 6 }),
      ])

      if (kpisRes.data)  setKpis(kpisRes.data)
      if (encRes.data)   setEncuestas(encRes.data)
      if (topRes.data)   setTopEnc(topRes.data)

      if (diasRes.data) {
        // Rellenar los 7 días aunque no haya datos
        const map = {}
        diasRes.data.forEach(d => { map[d.dia] = parseInt(d.total) })
        const dias = []
        const hoyIso = new Date().toISOString().slice(0, 10)
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i)
          const iso = d.toISOString().slice(0, 10)
          dias.push({ label: d.toLocaleDateString('es-AR', { weekday: 'short' }), value: map[iso] || 0 })
        }
        setHoy(map[hoyIso] || 0)
        setPorDia(dias)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const encPublicadas = encuestas.filter(e => e.estado_produccion === 'publicada')
  const encOtras      = encuestas.filter(e => e.estado_produccion !== 'publicada')
  const totalResp     = encPublicadas.reduce((s, e) => s + (parseInt(e.sesiones_count) || 0), 0)

  if (loading) return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Spinner center size="lg" />
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
          <KpiCard icon="📋" label="Encuestas activas"     value={kpis.enc_activas}                        sub="publicadas"     color="var(--accent)" />
          <KpiCard icon="✅" label="Total respuestas"      value={totalResp.toLocaleString('es-AR')}        sub="todas las enc." color="#0369a1" />
          <KpiCard icon="📅" label="Respuestas hoy"        value={hoy}                                      sub="del día"        color="#7c3aed" />
          <KpiCard icon="👤" label="Encuestadores activos" value={topEnc.length}                            sub="últimos 7 días" color="#b45309" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {porDia.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Respuestas por día — últimos 7 días</div>
                <div style={{ height: 80 }}>
                  <MiniBarChart data={porDia.map(d => d.value)} labels={porDia.map(d => d.label)} />
                </div>
              </div>
            )}

            {encPublicadas.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Encuestas en campo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {encPublicadas.map(enc => <EncuestaRow key={enc.id} enc={enc} onClick={() => navigate(`/encuestas/${enc.id}`)} />)}
                </div>
              </div>
            )}

            {encOtras.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>En producción</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {encOtras.map(enc => <EncuestaRow key={enc.id} enc={enc} onClick={() => navigate(`/encuestas/${enc.id}`)} />)}
                </div>
              </div>
            )}

            {encuestas.length === 0 && (
              <div className={styles.empty}>
                <p>Todavía no tenés encuestas.</p>
                <button onClick={() => navigate('/encuestas')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                  Ir a encuestas
                </button>
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Top encuestadores</div>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 14 }}>Últimos 7 días</div>
            {topEnc.length === 0
              ? <div style={{ fontSize: 13, color: 'var(--ink3)', textAlign: 'center', padding: '20px 0' }}>Sin actividad esta semana</div>
              : topEnc.map((enc, i) => <EncuestadorRow key={enc.encuestador_id} enc={enc} rank={i + 1} />)
            }
          </div>
        </div>
      </div>
    </div>
  )
}