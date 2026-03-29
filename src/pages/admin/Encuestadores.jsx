import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

function InviteModal({ onClose, onSaved, orgId, session }) {
  const [email, setEmail]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('El email es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('https://zjphrjcpkzlmdpqhjypq.supabase.co/functions/v1/invite-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, rol: 'encuestador' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al invitar')
      onSaved(); onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Invitar encuestador</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Email del encuestador *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="encuestador@email.com" required />
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink3)' }}>
            Le llegará un email para completar su registro. Podrá usar la app móvil una vez registrado.
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

function AsignarEquipoModal({ encuestador, equipos, equipoActual, onClose, onSaved }) {
  const [selected, setSelected] = useState(equipoActual || '')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    try {
      // Quitar del equipo actual si existe
      if (equipoActual) {
        await supabase.from('equipo_encuestadores').delete().eq('encuestador_id', encuestador.id)
      }
      // Asignar al nuevo equipo
      if (selected) {
        await supabase.from('equipo_encuestadores').insert({ encuestador_id: encuestador.id, equipo_id: selected })
      }
      onSaved(); onClose()
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Asignar equipo — {encuestador.nombre_completo}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ fontSize: 13, color: 'var(--ink3)', margin: 0 }}>Un encuestador solo puede pertenecer a un equipo a la vez.</p>
          <div className={styles.formGroup}>
            <label>Equipo</label>
            <select value={selected} onChange={e => setSelected(e.target.value)} className={styles.select}>
              <option value="">Sin equipo</option>
              {equipos.map(eq => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
            </select>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button onClick={onClose} disabled={saving}>Cancelar</button>
            <button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Encuestadores() {
  const { perfil } = useAuth()
  const [encuestadores, setEncuestadores] = useState([])
  const [equipos, setEquipos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [asignando, setAsignando]   = useState(null)
  const [session, setSession]       = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
  }, [])

  async function fetchData() {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    const [eRes, eqRes] = await Promise.all([
      supabase.from('perfiles')
        .select('*, equipo_encuestadores(equipo_id, equipos(nombre))')
        .eq('rol', 'encuestador')
        .eq('organizacion_id', perfil.organizacion_id)
        .order('nombre_completo'),
      supabase.from('equipos').select('id, nombre').eq('organizacion_id', perfil.organizacion_id).order('nombre'),
    ])
    setEncuestadores(eRes.data || [])
    setEquipos(eqRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [perfil?.organizacion_id])

  async function toggleActivo(enc) {
    await supabase.from('perfiles').update({ activo: !enc.activo }).eq('id', enc.id)
    fetchData()
  }

  const COLORS = ['#d8f3dc','#e0f2fe','#fef3c7','#f3e8ff','#fce7f3','#ecfdf5']
  const TEXT_COLORS = ['#1a472a','#0369a1','#b45309','#7c3aed','#be185d','#047857']
  const initials = (n) => (n || '').split(' ').slice(0,2).map(x => x[0]).join('').toUpperCase()

  // Stats
  const total   = encuestadores.length
  const activos = encuestadores.filter(e => e.activo).length
  const sinEquipo = encuestadores.filter(e => !e.equipo_encuestadores?.length).length

  return (
    <div className={styles.page}>
      <Topbar title="Encuestadores" action={{ label: '+ Invitar', onClick: () => setShowInvite(true) }} />

      {showInvite && session && (
        <InviteModal orgId={perfil?.organizacion_id} session={session} onClose={() => setShowInvite(false)} onSaved={() => { setShowInvite(false); fetchData() }} />
      )}
      {asignando && (
        <AsignarEquipoModal
          encuestador={asignando}
          equipos={equipos}
          equipoActual={asignando.equipo_encuestadores?.[0]?.equipo_id || ''}
          onClose={() => setAsignando(null)}
          onSaved={() => { setAsignando(null); fetchData() }}
        />
      )}

      <div className={styles.content}>
        {total > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total', value: total, color: 'var(--accent)', bg: 'var(--accent-light)' },
              { label: 'Activos', value: activos, color: '#0369a1', bg: '#e0f2fe' },
              { label: 'Sin equipo', value: sinEquipo, color: sinEquipo > 0 ? '#b45309' : '#1a472a', bg: sinEquipo > 0 ? '#fef3c7' : 'var(--accent-light)' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 'var(--r2)', padding: '16px 20px' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: s.color, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? <Spinner center size="lg" /> : (
          encuestadores.length === 0 ? (
            <div className={styles.empty}>
              <p>No hay encuestadores todavía.</p>
              <button onClick={() => setShowInvite(true)} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                Invitar primer encuestador
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {encuestadores.map((enc, i) => {
                const ci = i % COLORS.length
                const equipoNombre = enc.equipo_encuestadores?.[0]?.equipos?.nombre
                return (
                  <div key={enc.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: COLORS[ci], color: TEXT_COLORS[ci], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {initials(enc.nombre_completo)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{enc.nombre_completo || 'Sin nombre'}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {equipoNombre
                          ? <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--accent-light)', color: 'var(--accent2)' }}>{equipoNombre}</span>
                          : <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>⚠ Sin equipo</span>
                        }
                        {!enc.activo && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#fdecea', color: 'var(--danger)' }}>Inactivo</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => setAsignando(enc)} style={{ padding: '6px 12px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        Equipo
                      </button>
                      <button onClick={() => toggleActivo(enc)} style={{ padding: '6px 12px', background: 'none', color: enc.activo ? 'var(--danger)' : 'var(--accent2)', border: `1.5px solid ${enc.activo ? 'var(--danger)' : 'var(--accent2)'}`, borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        {enc.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}