import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

function InviteModal({ onClose, onSaved, session, rolInicial }) {
  const [form, setForm]     = useState({ email: '', rol: rolInicial || 'coordinador' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim()) { setError('El email es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('https://zjphrjcpkzlmdpqhjypq.supabase.co/functions/v1/invite-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: form.email, rol: form.rol }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al invitar')
      onSaved(); onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  const esCoord = form.rol === 'coordinador'

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Invitar {esCoord ? 'coordinador' : 'gestor'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={`${esCoord ? 'coordinador' : 'gestor'}@email.com`} required />
          </div>
          <div style={{ padding: '10px 14px', background: esCoord ? 'var(--info-light)' : 'rgba(124,58,237,0.1)', borderRadius: 'var(--r)', fontSize: 13, color: esCoord ? '#0369a1' : '#7c3aed' }}>
            {esCoord
              ? 'El coordinador gestionará un equipo en campo desde la app móvil y el panel web.'
              : 'El gestor tiene el mismo acceso que el admin pero sin gestión de suscripción.'}
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Invitando...' : 'Enviar invitación'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AsignarEquipoModal({ perfil: miembro, equipos, onClose, onSaved }) {
  const equiposAsignados = miembro.equipo_coordinadores?.map(ec => ec.equipo_id) || []
  const [selected, setSelected] = useState(new Set(equiposAsignados))
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function toggle(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      for (const equipoId of equiposAsignados) {
        if (!selected.has(equipoId)) {
          await supabase.from('equipo_coordinadores').delete()
            .eq('coordinador_id', miembro.id).eq('equipo_id', equipoId)
        }
      }
      for (const equipoId of selected) {
        if (!equiposAsignados.includes(equipoId)) {
          await supabase.from('equipo_coordinadores').insert({ coordinador_id: miembro.id, equipo_id: equipoId })
        }
      }
      onSaved(); onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Asignar equipos — {miembro.nombre_completo}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {equipos.length === 0
            ? <p style={{ color: 'var(--ink3)', fontSize: 14 }}>No hay equipos creados todavía.</p>
            : (
              <div className={styles.equiposList}>
                {equipos.map(eq => (
                  <div key={eq.id} className={`${styles.equipoItem} ${selected.has(eq.id) ? styles.equipoItemSelected : ''}`} onClick={() => toggle(eq.id)}>
                    <input type="checkbox" checked={selected.has(eq.id)} onChange={() => toggle(eq.id)} />
                    <span>{eq.nombre}</span>
                  </div>
                ))}
              </div>
            )
          }
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button onClick={onClose} disabled={saving}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || equipos.length === 0}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const COLORS      = ['#d8f3dc','var(--info-light)','var(--warning-light)','rgba(124,58,237,0.1)','#fce7f3','var(--accent-light)']
const TEXT_COLORS = ['#1a472a','#0369a1','#b45309','#7c3aed','#be185d','#047857']
const initials    = (n) => (n || '').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase()

function TarjetaMiembro({ m, i, equipos, onAsignar, onToggleActivo, puedeGestionar }) {
  const ci = i % COLORS.length
  const equiposNombre = m.equipo_coordinadores?.map(ec => ec.equipos?.nombre).filter(Boolean) || []
  const esCoord = m.rol === 'coordinador'
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: COLORS[ci], color: TEXT_COLORS[ci], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
        {initials(m.nombre_completo)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{m.nombre_completo || 'Sin nombre'}</div>
        <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 1 }}>{m.email || '—'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {esCoord
            ? equiposNombre.length > 0
              ? equiposNombre.map((eq, j) => <span key={j} style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--accent-light)', color: 'var(--accent2)' }}>{eq}</span>)
              : <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, background: 'var(--surface2)', color: 'var(--ink3)' }}>Sin equipo</span>
            : null
          }
          {!m.activo && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: 'var(--danger-light)', color: 'var(--danger)' }}>Inactivo</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {esCoord && (
          <button onClick={() => onAsignar(m)} style={{ padding: '6px 12px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Equipos
          </button>
        )}
        {puedeGestionar && (
          <button onClick={() => onToggleActivo(m)} style={{ padding: '6px 12px', background: 'none', color: m.activo ? 'var(--danger)' : 'var(--accent2)', border: `1.5px solid ${m.activo ? 'var(--danger)' : 'var(--accent2)'}`, borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            {m.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Coordinadores() {
  const { perfil } = useAuth()
  const [miembros,  setMiembros]  = useState([])
  const [equipos,   setEquipos]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [invitando, setInvitando] = useState(null)
  const [asignando, setAsignando] = useState(null)
  const [session,   setSession]   = useState(null)

  const esGestor = perfil?.rol === 'gestor'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  async function fetchData() {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    const [mRes, eqRes] = await Promise.all([
      supabase.from('perfiles')
        .select('*, equipo_coordinadores(equipo_id, equipos(nombre))')
        .in('rol', ['coordinador', 'gestor'])
        .eq('organizacion_id', perfil.organizacion_id)
        .order('nombre_completo'),
      supabase.from('equipos').select('id, nombre').eq('organizacion_id', perfil.organizacion_id).order('nombre'),
    ])
    setMiembros(mRes.data || [])
    setEquipos(eqRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [perfil?.organizacion_id])

  async function toggleActivo(m) {
    await supabase.from('perfiles').update({ activo: !m.activo }).eq('id', m.id)
    fetchData()
  }

  const coordinadores = miembros.filter(m => m.rol === 'coordinador')
  const gestores      = miembros.filter(m => m.rol === 'gestor')

  const statsCoord = [
    { label: 'Total',      value: coordinadores.length,                                                 color: '#0369a1', bg: 'var(--info-light)' },
    { label: 'Activos',    value: coordinadores.filter(m => m.activo !== false).length,                 color: 'var(--accent)', bg: 'var(--accent-light)' },
    { label: 'Con equipo', value: coordinadores.filter(m => m.equipo_coordinadores?.length > 0).length, color: '#047857', bg: 'var(--accent-light)' },
    { label: 'Sin equipo', value: coordinadores.filter(m => !m.equipo_coordinadores?.length).length,    color: '#b45309', bg: 'var(--warning-light)' },
  ]

  const statsGestor = [
    { label: 'Total',     value: gestores.length,                                color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
    { label: 'Activos',   value: gestores.filter(m => m.activo !== false).length, color: 'var(--accent)', bg: 'var(--accent-light)' },
    { label: 'Inactivos', value: gestores.filter(m => m.activo === false).length, color: 'var(--danger)', bg: 'var(--danger-light)' },
  ]

  const seccion = (titulo, descripcion, colorBadge, bgBadge, stats, lista, rolInvitar, idx0, puedeInvitar, puedeGestionar) => (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: bgBadge, color: colorBadge }}>{titulo}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink3)' }}>{descripcion}</p>
        </div>
        {puedeInvitar && (
          <button
            onClick={() => setInvitando(rolInvitar)}
            style={{ padding: '7px 16px', background: colorBadge, color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0 }}
          >
            + Invitar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ padding: '14px 18px', borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none', background: s.bg }}>
            <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
            No hay {titulo.toLowerCase()} todavía.
          </div>
        ) : (
          lista.map((m, i) => (
            <TarjetaMiembro
              key={m.id} m={m} i={idx0 + i}
              equipos={equipos}
              onAsignar={setAsignando}
              onToggleActivo={toggleActivo}
              puedeGestionar={puedeGestionar}
            />
          ))
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <Topbar title="Coordinadores y Gestores" />

      {invitando && session && (
        <InviteModal
          session={session}
          rolInicial={invitando}
          onClose={() => setInvitando(null)}
          onSaved={() => { setInvitando(null); fetchData() }}
        />
      )}
      {asignando && (
        <AsignarEquipoModal
          perfil={asignando}
          equipos={equipos}
          onClose={() => setAsignando(null)}
          onSaved={() => { setAsignando(null); fetchData() }}
        />
      )}

      <div className={styles.content}>
        {loading ? <Spinner center size="lg" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {seccion(
              'Coordinadores',
              'Gestionan equipos en campo. Acceden desde la app móvil y el panel web.',
              '#0369a1', 'var(--info-light)',
              statsCoord, coordinadores, 'coordinador', 0,
              true,    // gestor SÍ puede invitar coordinadores
              true     // gestor SÍ puede desactivar coordinadores
            )}
            {seccion(
              'Gestores',
              'Acceso completo al panel web. Mismo nivel que admin, sin gestión de suscripción.',
              '#7c3aed', 'rgba(124,58,237,0.1)',
              statsGestor, gestores, 'gestor', coordinadores.length,
              !esGestor,  // gestor NO puede invitar gestores
              !esGestor   // gestor NO puede desactivar gestores
            )}
          </div>
        )}
      </div>
    </div>
  )
}