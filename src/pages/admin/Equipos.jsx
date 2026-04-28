import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

function EquipoModal({ equipo, onClose, onSaved, orgId }) {
  const [nombre, setNombre] = useState(equipo?.nombre || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre del equipo *</label>
            <input 
              value={nombre} 
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Equipo Norte" 
              required 
              disabled={saving} 
            />
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

// ==================== NUEVO MODAL: Gestionar Miembros ====================
function GestionarMiembrosModal({ equipo, onClose, onSaved, orgId }) {
  const [coordinadores, setCoordinadores] = useState([])
  const [encuestadores, setEncuestadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadMembers() {
      setLoading(true)
      const [coordRes, encRes] = await Promise.all([
        supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .eq('organizacion_id', orgId)
          .eq('rol', 'coordinador')
          .eq('activo', true)
          .order('nombre_completo'),
        supabase
          .from('perfiles')
          .select('id, nombre_completo')
          .eq('organizacion_id', orgId)
          .eq('rol', 'encuestador')
          .eq('activo', true)
          .order('nombre_completo')
      ])

      setCoordinadores(coordRes.data || [])
      setEncuestadores(encRes.data || [])
      setLoading(false)
    }
    loadMembers()
  }, [orgId])

  const currentCoordIds = equipo.equipo_coordinadores?.map(c => c.coordinador_id) || []
  const currentEncIds = equipo.equipo_encuestadores?.map(e => e.encuestador_id) || []

  async function toggleCoordinador(coordinadorId) {
    setSaving(true)
    try {
      if (currentCoordIds.includes(coordinadorId)) {
        await supabase
          .from('equipo_coordinadores')
          .delete()
          .eq('equipo_id', equipo.id)
          .eq('coordinador_id', coordinadorId)
      } else {
        await supabase
          .from('equipo_coordinadores')
          .insert({ equipo_id: equipo.id, coordinador_id: coordinadorId })
      }
      onSaved()
    } catch (err) {
      alert('Error al actualizar coordinador')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEncuestador(encuestadorId) {
    setSaving(true)
    try {
      if (currentEncIds.includes(encuestadorId)) {
        await supabase
          .from('equipo_encuestadores')
          .delete()
          .eq('equipo_id', equipo.id)
          .eq('encuestador_id', encuestadorId)
      } else {
        await supabase
          .from('equipo_encuestadores')
          .insert({ equipo_id: equipo.id, encuestador_id: encuestadorId })
      }
      onSaved()
    } catch (err) {
      alert('Error al actualizar encuestador')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} style={{ maxWidth: '540px' }}>
        <div className={styles.modalHeader}>
          <h3>Gestionar miembros — {equipo.nombre}</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <Spinner center size="lg" />
          ) : (
            <>
              {/* Coordinadores */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--ink2)' }}>Coordinadores</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {coordinadores.length === 0 ? (
                    <p style={{ color: 'var(--ink3)', fontSize: 13 }}>No hay coordinadores activos en la organización.</p>
                  ) : (
                    coordinadores.map(c => {
                      const isInTeam = currentCoordIds.includes(c.id)
                      return (
                        <div key={c.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: isInTeam ? 'var(--accent-light)' : 'var(--surface)',
                          border: `1.5px solid ${isInTeam ? 'var(--accent)' : 'var(--border2)'}`,
                          borderRadius: 'var(--r)',
                        }}>
                          <span style={{ fontSize: 14 }}>{c.nombre_completo}</span>
                          <button
                            onClick={() => toggleCoordinador(c.id)}
                            disabled={saving}
                            style={{
                              padding: '6px 14px',
                              fontSize: 13,
                              fontWeight: 600,
                              background: isInTeam ? 'var(--danger)' : 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--r)',
                              cursor: 'pointer'
                            }}
                          >
                            {isInTeam ? 'Quitar' : 'Agregar'}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Encuestadores */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--ink2)' }}>Encuestadores</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {encuestadores.length === 0 ? (
                    <p style={{ color: 'var(--ink3)', fontSize: 13 }}>No hay encuestadores activos en la organización.</p>
                  ) : (
                    encuestadores.map(e => {
                      const isInTeam = currentEncIds.includes(e.id)
                      return (
                        <div key={e.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: isInTeam ? 'var(--accent-light)' : 'var(--surface)',
                          border: `1.5px solid ${isInTeam ? 'var(--accent)' : 'var(--border2)'}`,
                          borderRadius: 'var(--r)',
                        }}>
                          <span style={{ fontSize: 14 }}>{e.nombre_completo}</span>
                          <button
                            onClick={() => toggleEncuestador(e.id)}
                            disabled={saving}
                            style={{
                              padding: '6px 14px',
                              fontSize: 13,
                              fontWeight: 600,
                              background: isInTeam ? 'var(--danger)' : 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--r)',
                              cursor: 'pointer'
                            }}
                          >
                            {isInTeam ? 'Quitar' : 'Agregar'}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.modalActions}>
          <button onClick={onClose} disabled={saving}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ====================== COMPONENTE PRINCIPAL ======================
export default function Equipos() {
  const { perfil } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)           // para crear/editar equipo
  const [gestionarModal, setGestionarModal] = useState(null) // nuevo estado

  const fetchData = useCallback(async () => {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select(`
          *,
          equipo_coordinadores (
            coordinador_id,
            perfiles!equipo_coordinadores_coordinador_id_fkey (nombre_completo)
          ),
          equipo_encuestadores (
            encuestador_id,
            perfiles!equipo_encuestadores_encuestador_id_fkey (nombre_completo)
          )
        `)
        .eq('organizacion_id', perfil.organizacion_id)
        .order('nombre')

      if (error) throw error
      setEquipos(data || [])
    } catch (err) {
      console.error('Error cargando equipos:', err)
    } finally {
      setLoading(false)
    }
  }, [perfil?.organizacion_id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este equipo? Esta acción no se puede deshacer.')) return
    try {
      await supabase.from('equipos').delete().eq('id', id)
      fetchData()
    } catch {
      alert('Error al eliminar el equipo')
    }
  }

  return (
    <div className={styles.page}>
      <Topbar 
        title="Equipos" 
        action={{ label: '+ Nuevo equipo', onClick: () => setModal('nuevo') }} 
      />

      {/* Modal Editar / Crear Equipo */}
      {modal && (
        <EquipoModal
          equipo={modal === 'nuevo' ? null : modal}
          orgId={perfil?.organizacion_id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData() }}
        />
      )}

      {/* Modal Gestionar Miembros */}
      {gestionarModal && (
        <GestionarMiembrosModal
          equipo={gestionarModal}
          orgId={perfil?.organizacion_id}
          onClose={() => setGestionarModal(null)}
          onSaved={() => { setGestionarModal(null); fetchData() }}
        />
      )}

      <div className={styles.content}>
        {loading ? <Spinner center size="lg" /> : equipos.length === 0 ? (
          <div className={styles.empty}>
            <p>No tenes equipos todavía.</p>
            <button 
              onClick={() => setModal('nuevo')}
              style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}
            >
              Crear primer equipo
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {equipos.map(eq => (
              <div key={eq.id} className={styles.encuestaCard} style={{ cursor: 'default' }}>
  <div className={styles.encuestaHeader}>
    <h4 style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>{eq.nombre}</h4>
  </div>

  {/* Contadores */}
  <div style={{ 
    display: 'flex', 
    gap: 16, 
    margin: '12px 0 20px 0', 
    fontSize: 13.5, 
    color: 'var(--ink3)' 
  }}>
    <span><strong>{eq.equipo_coordinadores?.length ?? 0}</strong> coordinadores</span>
    <span><strong>{eq.equipo_encuestadores?.length ?? 0}</strong> encuestadores</span>
  </div>

  {/* Sección Coordinadores */}
  {eq.equipo_coordinadores?.length > 0 && (
    <div style={{ marginBottom: 20 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 10, 
        marginBottom: 10 
      }}>
        <div style={{ 
          height: 3, 
          background: '#0369a1', 
          flex: 1, 
          borderRadius: 3 
        }} />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: '#0369a1',
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Coordinadores
        </span>
        <div style={{ 
          height: 3, 
          background: '#0369a1', 
          flex: 1, 
          borderRadius: 3 
        }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {eq.equipo_coordinadores.map((rel, i) => (
          <div 
            key={i} 
            className={styles.pill}
            style={{
              background: '#dbeafe',
              color: '#1e40af',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: 13.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: '1px solid #bfdbfe'
            }}
          >
            {rel.perfiles?.nombre_completo || 'Sin nombre'}
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Sección Encuestadores */}
  {eq.equipo_encuestadores?.length > 0 && (
    <div style={{ marginBottom: 20 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 10, 
        marginBottom: 10 
      }}>
        <div style={{ 
          height: 3, 
          background: '#d97706', 
          flex: 1, 
          borderRadius: 3 
        }} />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 700, 
          color: '#d97706',
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Encuestadores
        </span>
        <div style={{ 
          height: 3, 
          background: '#d97706', 
          flex: 1, 
          borderRadius: 3 
        }} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {eq.equipo_encuestadores.map((rel, i) => (
          <div 
            key={i} 
            className={styles.pill}
            style={{
              background: '#fef3c7',
              color: '#92400e',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: 13.5,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: '1px solid #fcd34d'
            }}
          >
            {rel.perfiles?.nombre_completo || 'Sin nombre'}
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Mensaje sin miembros */}
  {eq.equipo_coordinadores?.length === 0 && eq.equipo_encuestadores?.length === 0 && (
    <div style={{ 
      padding: '20px', 
      background: 'var(--surface)', 
      borderRadius: 'var(--r)', 
      textAlign: 'center',
      color: 'var(--ink3)',
      fontSize: 14,
      margin: '20px 0'
    }}>
      Este equipo aún no tiene miembros asignados.
    </div>
  )}

  {/* Acciones */}
  <div style={{ 
  marginTop: 'auto', 
  paddingTop: 20,
  display: 'flex', 
  justifyContent: 'center', 
  gap: 10,
  flexWrap: 'wrap'
}}>
  <button 
    onClick={() => setModal(eq)}
    style={{ 
      padding: '6px 13px', 
      background: 'var(--surface)', 
      color: 'var(--ink2)', 
      border: '1.5px solid var(--border2)', 
      borderRadius: 'var(--r)', 
      fontSize: 12.5, 
      fontWeight: 600, 
      cursor: 'pointer', 
      fontFamily: 'DM Sans',
      minWidth: '78px'
    }}
  >
    Editar
  </button>
  
  <button 
    onClick={() => setGestionarModal(eq)}
    style={{ 
      padding: '6px 13px', 
      background: 'var(--accent-light)', 
      color: 'var(--accent2)', 
      border: '1.5px solid var(--accent2)', 
      borderRadius: 'var(--r)', 
      fontSize: 12.5, 
      fontWeight: 600, 
      cursor: 'pointer', 
      fontFamily: 'DM Sans',
      minWidth: '88px'
    }}
  >
    Gestionar
  </button>

  <button 
    onClick={() => handleDelete(eq.id)}
    style={{ 
      padding: '6px 13px', 
      background: 'none', 
      color: 'var(--danger)', 
      border: '1.5px solid var(--danger)', 
      borderRadius: 'var(--r)', 
      fontSize: 12.5, 
      fontWeight: 600, 
      cursor: 'pointer', 
      fontFamily: 'DM Sans',
      minWidth: '78px'
    }}
  >
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