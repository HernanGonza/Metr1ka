import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import GeofencingModal from './GeofencingModal'
import styles from './Page.module.css'

function EquipoModal({ equipo, onClose, onSaved, orgId }) {
  const [form, setForm] = useState({
    nombre: equipo?.nombre || '',
    geofencing_activo: equipo?.geofencing_activo || false,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const payload = { nombre: form.nombre, geofencing_activo: form.geofencing_activo, organizacion_id: orgId }
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
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre del equipo *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Equipo Norte" required disabled={saving} />
          </div>
          <div onClick={() => !saving && setForm(f => ({ ...f, geofencing_activo: !f.geofencing_activo }))}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
              background: form.geofencing_activo ? 'var(--accent-light)' : 'var(--surface)',
              borderRadius: 'var(--r)',
              border: `1.5px solid ${form.geofencing_activo ? 'var(--accent2)' : 'var(--border2)'}`,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            <input type="checkbox" checked={form.geofencing_activo} onChange={() => {}} disabled={saving}
              style={{ marginTop: 3, accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: form.geofencing_activo ? 'var(--accent)' : 'var(--ink)' }}>
                📍 Activar geofencing del equipo
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
                Define una zona propia del equipo. Los encuestadores que salgan de todas sus zonas asignadas tendrán la app bloqueada.
              </div>
            </div>
          </div>
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
  const [equipos,   setEquipos]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)
  const [geoModal,  setGeoModal]  = useState(null)

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
    if (!window.confirm('¿Eliminar este equipo? Esta acción no se puede deshacer.')) return
    try {
      await supabase.from('equipos').delete().eq('id', id)
      fetchData()
    } catch (err) { alert('Error al eliminar el equipo') }
  }

  const tieneZonaDefinida = (eq) => {
    if (!eq?.area_geojson?.features) return false
    return eq.area_geojson.features.some(f => f.properties?.tipo === 'zona' || !f.properties?.tipo)
  }

  return (
    <div className={styles.page}>
      <Topbar title="Equipos" action={{ label: '+ Nuevo equipo', onClick: () => setModal('nuevo') }} />

      {modal && (
        <EquipoModal equipo={modal === 'nuevo' ? null : modal} orgId={perfil?.organizacion_id}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchData() }} />
      )}

      {geoModal && (
        <GeofencingModal
          equipo={geoModal}
          onClose={() => setGeoModal(null)}
          onSaved={() => { setGeoModal(null); fetchData() }}
          entityType="equipo"
          mode="zona-solo"
        />
      )}

      <div className={styles.content}>
        {loading ? <Spinner center size="lg" /> : equipos.length === 0 ? (
          <div className={styles.empty}>
            <p>No tenés equipos todavía.</p>
            <button onClick={() => setModal('nuevo')}
              style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
              Crear primer equipo
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {equipos.map(eq => {
              const tieneZona = tieneZonaDefinida(eq)
              return (
                <div key={eq.id} className={styles.encuestaCard} style={{ cursor: 'default' }}>
                  <div className={styles.encuestaHeader}>
                    <h4 style={{ fontSize: 16 }}>{eq.nombre}</h4>
                    {eq.geofencing_activo && (
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                        background: tieneZona ? 'var(--accent-light)' : '#fef3c7',
                        color: tieneZona ? 'var(--accent2)' : '#b45309', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {tieneZona ? '📍 Zona activa' : '⚠ Sin zona'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 14, margin: '10px 0', fontSize: 13, color: 'var(--ink3)' }}>
                    <span>👔 {eq.equipo_coordinadores?.[0]?.count ?? 0} coordinadores</span>
                    <span>👤 {eq.equipo_encuestadores?.[0]?.count ?? 0} encuestadores</span>
                  </div>
                  <div className={styles.encuestaActions}>
                    <button onClick={() => setModal(eq)}
                      title="Editar nombre y configuración del equipo"
                      style={{ padding: '6px 14px', background: 'var(--surface)', color: 'var(--ink2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      ✏️ Editar
                    </button>
                    {eq.geofencing_activo && (
                      <button onClick={() => setGeoModal(eq)}
                        title="Definir la zona geográfica del equipo para el control de ubicación en la app"
                        style={{ padding: '6px 14px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        📍 {tieneZona ? 'Editar zona' : 'Definir zona'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(eq.id)}
                      title="Eliminar el equipo permanentemente"
                      style={{ padding: '6px 14px', background: 'none', color: 'var(--danger)', border: '1.5px solid var(--danger)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}