import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

function EquipoModal({ equipo, onClose, onSaved, orgId }) {
  const [nombre, setNombre] = useState(equipo?.nombre || '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const payload = { nombre, organizacion_id: orgId }
      const { error: err } = equipo
        ? await supabase.from('equipos').update(payload).eq('id', equipo.id)
        : await supabase.from('equipos').insert(payload)
      if (err) throw err
      onSaved(); onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>{equipo ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>x</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre del equipo *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Equipo Norte" required disabled={saving} />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : equipo ? 'Guardar cambios' : 'Crear equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Equipos() {
  const { perfil } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)

  const fetchData = useCallback(async () => {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('*, equipo_coordinadores(count), equipo_encuestadores(count)')
        .eq('organizacion_id', perfil.organizacion_id)
        .order('nombre')
      if (error) throw error
      setEquipos(data || [])
    } catch (err) {
      console.error('Error cargando equipos:', err)
    } finally { setLoading(false) }
  }, [perfil?.organizacion_id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este equipo? Esta accion no se puede deshacer.')) return
    try {
      await supabase.from('equipos').delete().eq('id', id)
      fetchData()
    } catch { alert('Error al eliminar el equipo') }
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
        {loading ? <Spinner center size="lg" /> : equipos.length === 0 ? (
          <div className={styles.empty}>
            <p>No tenes equipos todavia.</p>
            <button onClick={() => setModal('nuevo')}
              style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
              Crear primer equipo
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {equipos.map(eq => (
              <div key={eq.id} className={styles.encuestaCard} style={{ cursor: 'default' }}>
                <div className={styles.encuestaHeader}>
                  <h4 style={{ fontSize: 16 }}>{eq.nombre}</h4>
                </div>
                <div style={{ display: 'flex', gap: 14, margin: '10px 0', fontSize: 13, color: 'var(--ink3)' }}>
                  <span>Coordinadores: {eq.equipo_coordinadores?.[0]?.count ?? 0}</span>
                  <span>Encuestadores: {eq.equipo_encuestadores?.[0]?.count ?? 0}</span>
                </div>
                <div className={styles.encuestaActions}>
                  <button onClick={() => setModal(eq)}
                    style={{ padding: '6px 14px', background: 'var(--surface)', color: 'var(--ink2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(eq.id)}
                    style={{ padding: '6px 14px', background: 'none', color: 'var(--danger)', border: '1.5px solid var(--danger)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}