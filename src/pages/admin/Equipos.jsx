import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

function EquipoModal({ equipo, onClose, onSaved, orgId }) {
  const [form, setForm] = useState({
    nombre: equipo?.nombre || '',
    geofencing_activo: equipo?.geofencing_activo || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const payload = { nombre: form.nombre, geofencing_activo: form.geofencing_activo, organizacion_id: orgId }
    const { error: err } = equipo
      ? await supabase.from('equipos').update(payload).eq('id', equipo.id)
      : await supabase.from('equipos').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>{equipo ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre del equipo *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Equipo Norte" required />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1.5px solid var(--border2)' }}>
            <input
              type="checkbox" id="geofencing" checked={form.geofencing_activo}
              onChange={e => setForm(f => ({ ...f, geofencing_activo: e.target.checked }))}
              style={{ marginTop: 2, accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }}
            />
            <label htmlFor="geofencing" style={{ cursor: 'pointer' }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Activar geofencing</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
                Permitirá definir un área geográfica para este equipo. Los encuestadores que salgan del área tendrán la app desactivada automáticamente.
              </div>
            </label>
          </div>
          {form.geofencing_activo && (
            <div style={{ padding: '10px 14px', background: '#fef9e7', borderRadius: 'var(--r)', fontSize: 13, color: '#b45309', borderLeft: '3px solid #fcd34d' }}>
              📍 Podrás dibujar el área en el mapa una vez creado el equipo, desde la pantalla de detalle.
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Guardando...' : equipo ? 'Guardar cambios' : 'Crear equipo'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Equipos() {
  const { perfil } = useAuth()
  const [equipos, setEquipos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // null | 'nuevo' | equipo

  async function fetchData() {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    const { data: eqs } = await supabase
      .from('equipos')
      .select('*, equipo_coordinadores(count), equipo_encuestadores(count)')
      .eq('organizacion_id', perfil.organizacion_id)
      .order('nombre')
    setEquipos(eqs || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [perfil?.organizacion_id])

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este equipo? Esta acción no se puede deshacer.')) return
    await supabase.from('equipos').delete().eq('id', id)
    fetchData()
  }

  return (
    <div className={styles.page}>
      <Topbar title="Equipos" action={{ label: '+ Nuevo equipo', onClick: () => setModal('nuevo') }} />

      {modal && (
        <EquipoModal
          equipo={modal === 'nuevo' ? null : modal}
          orgId={perfil?.organizacion_id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData() }}
        />
      )}

      <div className={styles.content}>
        {loading ? <Spinner center size="lg" /> : (
          equipos.length === 0 ? (
            <div className={styles.empty}>
              <p>No tenés equipos todavía.</p>
              <button onClick={() => setModal('nuevo')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                Crear primer equipo
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {equipos.map(eq => (
                <div key={eq.id} className={styles.encuestaCard} style={{ cursor: 'default' }}>
                  <div className={styles.encuestaHeader}>
                    <h4 style={{ fontSize: 16 }}>{eq.nombre}</h4>
                    {eq.geofencing_activo && (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#d8f3dc', color: '#1a472a', whiteSpace: 'nowrap' }}>
                        📍 Geo
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, margin: '10px 0', fontSize: 13, color: 'var(--ink3)' }}>
                    <span>👔 {eq.equipo_coordinadores?.[0]?.count ?? 0} coordinadores</span>
                    <span>👤 {eq.equipo_encuestadores?.[0]?.count ?? 0} encuestadores</span>
                  </div>
                  <div className={styles.encuestaActions}>
                    <button onClick={() => setModal(eq)} style={{ padding: '6px 14px', background: 'var(--surface)', color: 'var(--ink2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      Editar
                    </button>
                    <button onClick={() => handleDelete(eq.id)} style={{ padding: '6px 14px', background: 'none', color: 'var(--danger)', border: '1.5px solid var(--danger)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}