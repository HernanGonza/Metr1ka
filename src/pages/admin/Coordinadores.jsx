import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

const ROL_LABEL = { coordinador: 'Coordinador', gestor: 'Gestor' }

function InviteModal({ onClose, onSaved, orgId, session }) {
  const [form, setForm]   = useState({ email: '', rol: 'coordinador' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim()) { setError('El email es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('https://zjphrjcpkzlmdpqhjypq.supabase.co/functions/v1/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: form.email, rol: form.rol, organizacion_id: orgId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al invitar')
      onSaved(); onClose()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Invitar colaborador</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="colaborador@email.com" required />
          </div>
          <div className={styles.formGroup}>
            <label>Rol</label>
            <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
              <option value="coordinador">Coordinador — gestiona un equipo en campo</option>
              <option value="gestor">Gestor — mismo acceso que admin sin suscripción</option>
            </select>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink3)' }}>
            Le llegará un email para completar su registro.
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
      // Quitar desvinculados
      for (const equipoId of equiposAsignados) {
        if (!selected.has(equipoId)) {
          await supabase.from('equipo_coordinadores').delete()
            .eq('coordinador_id', miembro.id).eq('equipo_id', equipoId)
        }
      }
      // Agregar nuevos
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
            ? <p style={{ color: 'var(--ink3)', fontSize: 14 }}>No hay equipos creados. Creá primero un equipo en la sección Equipos.</p>
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

export default function Coordinadores() {
  const { perfil, rol } = useAuth()
  const [miembros, setMiembros] = useState([])
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

  const initials = (nombre) => (nombre || '').split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()

  const COLORS = ['#d8f3dc', '#e0f2fe', '#fef3c7', '#f3e8ff', '#fce7f3', '#ecfdf5']
  const TEXT_COLORS = ['#1a472a', '#0369a1', '#b45309', '#7c3aed', '#be185d', '#047857']

  return (
    <div className={styles.page}>
      <Topbar title="Coordinadores y Gestores" action={{ label: '+ Invitar', onClick: () => setShowInvite(true) }} />

      {showInvite && session && (
        <InviteModal
          orgId={perfil?.organizacion_id}
          session={session}
          onClose={() => setShowInvite(false)}
          onSaved={() => { setShowInvite(false); fetchData() }}
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
          miembros.length === 0 ? (
            <div className={styles.empty}>
              <p>No hay coordinadores ni gestores todavía.</p>
              <button onClick={() => setShowInvite(true)} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                Invitar primer colaborador
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {miembros.map((m, i) => {
                const ci = i % COLORS.length
                const equiposAsignados = m.equipo_coordinadores?.map(ec => ec.equipos?.nombre).filter(Boolean) || []
                return (
                  <div key={m.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: COLORS[ci], color: TEXT_COLORS[ci], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {initials(m.nombre_completo)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.nombre_completo || 'Sin nombre'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{m.email || '—'}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: m.rol === 'gestor' ? '#f3e8ff' : '#e0f2fe', color: m.rol === 'gestor' ? '#7c3aed' : '#0369a1' }}>
                          {ROL_LABEL[m.rol]}
                        </span>
                        {equiposAsignados.length > 0
                          ? equiposAsignados.map((eq, j) => (
                            <span key={j} style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--accent-light)', color: 'var(--accent2)' }}>{eq}</span>
                          ))
                          : <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, background: 'var(--surface2)', color: 'var(--ink3)' }}>Sin equipo</span>
                        }
                        {!m.activo && <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#fdecea', color: 'var(--danger)' }}>Inactivo</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {m.rol === 'coordinador' && (
                        <button onClick={() => setAsignando(m)} style={{ padding: '6px 12px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                          Equipos
                        </button>
                      )}
                      <button onClick={() => toggleActivo(m)} style={{ padding: '6px 12px', background: 'none', color: m.activo ? 'var(--danger)' : 'var(--accent2)', border: `1.5px solid ${m.activo ? 'var(--danger)' : 'var(--accent2)'}`, borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        {m.activo ? 'Desactivar' : 'Activar'}
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