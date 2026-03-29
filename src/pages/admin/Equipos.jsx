import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

// ── Lazy load leaflet + geoman ──
async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

// ── Modal crear/editar equipo ──
function EquipoModal({ equipo, onClose, onSaved, orgId }) {
  const [form, setForm] = useState({
    nombre: equipo?.nombre || '',
    geofencing_activo: equipo?.geofencing_activo || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
          <div
            onClick={() => setForm(f => ({ ...f, geofencing_activo: !f.geofencing_activo }))}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: form.geofencing_activo ? 'var(--accent-light)' : 'var(--surface)', borderRadius: 'var(--r)', border: `1.5px solid ${form.geofencing_activo ? 'var(--accent2)' : 'var(--border2)'}`, cursor: 'pointer', transition: 'all .15s' }}
          >
            <input type="checkbox" checked={form.geofencing_activo} onChange={() => {}} style={{ marginTop: 3, accentColor: 'var(--accent)', width: 16, height: 16, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, color: form.geofencing_activo ? 'var(--accent)' : 'var(--ink)' }}>
                📍 Activar geofencing
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>
                Permite definir un área geográfica. Los encuestadores que salgan del área tendrán la app bloqueada automáticamente.
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

// ── Modal de geofencing con Leaflet-Geoman (SOLUCIÓN FINAL) ──
function GeofencingModal({ equipo, onClose, onSaved }) {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const drawnLayers = useRef([])
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [tienePol, setTienePol] = useState(false)
  const [modo, setModo] = useState('idle')

  // ✅ Función para actualizar estado
  function actualizarEstado() {
    const count = drawnLayers.current.filter(l => l && l._leaflet_id).length
    setTienePol(count > 0)
    return count
  }

  // ✅ Función para inicializar PM en una capa (si no lo tiene)
  function asegurarPM(layer) {
    if (!layer) return false
    if (layer.pm) return true
    
    if (mapInst.current && mapInst.current.pm) {
      console.warn('Capa sin pm, intentando recuperar...')
      return false
    }
    return false
  }

  useEffect(() => {
    let mounted = true

    async function setup() {
      if (!mapRef.current || mapInst.current) return

      try {
        const L = await initMapLibs()
        if (!mounted) return

        const defaultCenter = [-27.3671, -55.8974]
        const map = L.map(mapRef.current, {
          center: equipo?.area_geojson ? getCenter(equipo.area_geojson) : defaultCenter,
          zoom: equipo?.area_geojson ? 14 : 13,
          zoomControl: true,
          attributionControl: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map)

        // ✅ Configurar Geoman
        map.pm.setLang('es')
        map.pm.setGlobalOptions({
          snappable: true,
          snapDistance: 20,
          allowSelfIntersection: false,
          templineStyle: { color: '#1a472a', dashArray: '5,5' },
          hintlineStyle: { color: '#1a472a', dashArray: '5,5' },
          pathOptions: { 
            color: '#1a472a', 
            fillColor: '#1a472a', 
            fillOpacity: 0.18, 
            weight: 3,
            interactive: true
          }
        })

        // ✅ OCULTAR toolbar de Geoman
        map.pm.removeControls({
          drawMarker: true, drawCircle: true, drawRectangle: true,
          drawPolyline: true, drawCircleMarker: true, cutPolygon: true,
          editMode: true, dragMode: true, removalMode: true, rotateMode: true,
        })

        // ✅ Cargar polígonos existentes
        if (equipo?.area_geojson) {
          try {
            const geoData = equipo.area_geojson
            const features = geoData.type === 'FeatureCollection' 
              ? geoData.features 
              : [geoData]
            
            features.forEach(feature => {
              if (feature.geometry?.type === 'Polygon') {
                const geoLayer = L.geoJSON(feature, {
                  style: { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.18, weight: 3 }
                })
                geoLayer.getLayers().forEach(layer => {
                  layer.addTo(map)
                  drawnLayers.current.push(layer)
                })
              }
            })
            
            actualizarEstado()
            if (drawnLayers.current.length > 0) {
              const group = L.featureGroup(drawnLayers.current)
              if (group.getBounds().isValid()) {
                map.fitBounds(group.getBounds(), { padding: [30, 30] })
              }
            }
          } catch (e) {
            console.warn('No se pudo cargar el polígono:', e)
          }
        }

        // ✅ Evento: cuando se crea un polígono
        map.on('pm:create', (e) => {
          const layer = e.layer || e.shape
          setModo('idle')
          
          if (!layer) {
            console.error('No se recibió capa en pm:create')
            return
          }
          
          drawnLayers.current.push(layer)
          actualizarEstado()
          
          if (layer.pm) {
            layer.pm.toggleEdit({ allowEditing: true, allowRemoval: true })
            layer.pm.disable()
          } else {
            setTimeout(() => {
              if (layer.pm && mounted) {
                layer.pm.toggleEdit({ allowEditing: true, allowRemoval: true })
                layer.pm.disable()
              }
            }, 100)
          }
          
          layer.setStyle({ 
            color: '#1a472a', 
            fillColor: '#1a472a', 
            fillOpacity: 0.18, 
            weight: 3 
          })
        })

        map.on('pm:edit', () => {
          actualizarEstado()
        })

        map.on('pm:remove', (e) => {
          drawnLayers.current = drawnLayers.current.filter(l => l !== e.layer)
          actualizarEstado()
          if (drawnLayers.current.length === 0) setModo('idle')
        })

        map.on('pm:actioncancel', () => {
          if (mounted) setModo('idle')
        })

        map.on('pm:drawend', () => {
          if (mounted) setModo('idle')
        })

        mapInst.current = map
        setListo(true)

        setTimeout(() => {
          if (mounted && mapInst.current) {
            mapInst.current.invalidateSize()
          }
        }, 100)

      } catch (err) {
        console.error('Error al inicializar mapa:', err)
        setError('No se pudo cargar el mapa. Recarga la página.')
        setListo(true)
      }
    }

    setup()

    return () => {
      mounted = false
      if (mapInst.current) {
        const map = mapInst.current
        map.off('pm:create pm:edit pm:remove pm:actioncancel pm:drawend')
        drawnLayers.current.forEach(layer => {
          if (map.hasLayer(layer)) map.removeLayer(layer)
        })
        drawnLayers.current = []
        map.remove()
        mapInst.current = null
      }
    }
  }, [equipo?.id])

  function getCenter(geojson) {
    try {
      const coords = geojson.geometry?.coordinates?.[0] || geojson.coordinates?.[0]
      if (!coords?.length) return [-27.3671, -55.8974]
      const lats = coords.map(c => c[1])
      const lngs = coords.map(c => c[0])
      return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]
    } catch {
      return [-27.3671, -55.8974]
    }
  }

  function activarDibujar() {
    if (!mapInst.current) return
    if (modo === 'dibujando') {
      mapInst.current.pm.disableDraw('Polygon')
      setModo('idle')
      return
    }
    if (modo === 'editando') mapInst.current.pm.toggleGlobalEditMode()
    if (modo === 'borrando') mapInst.current.pm.toggleGlobalRemovalMode()
    mapInst.current.pm.enableDraw('Polygon', { allowSelfIntersection: false, snappable: true })
    setModo('dibujando'); setError('')
  }

  function activarEditar() {
    if (!mapInst.current || drawnLayers.current.length === 0) {
      setError('No hay áreas para editar'); return
    }
    if (modo === 'editando') {
      mapInst.current.pm.toggleGlobalEditMode()
      setModo('idle'); return
    }
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Polygon')
    if (modo === 'borrando') mapInst.current.pm.toggleGlobalRemovalMode()
    mapInst.current.pm.toggleGlobalEditMode({ allowEditing: true, allowRemoval: false, snapVertex: true, snapMiddle: false })
    setModo('editando'); setError('')
  }

  function activarBorrar() {
    if (drawnLayers.current.length === 0) {
      setError('No hay áreas para eliminar'); return
    }
    if (modo === 'borrando') {
      mapInst.current?.pm?.toggleGlobalRemovalMode()
      setModo('idle'); return
    }
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Polygon')
    if (modo === 'editando') mapInst.current.pm.toggleGlobalEditMode()
    mapInst.current.pm.toggleGlobalRemovalMode()
    setModo('borrando'); setError('')
  }

  function handleClearAll() {
    if (!mapInst.current) return
    drawnLayers.current.forEach(layer => {
      if (mapInst.current.hasLayer(layer)) mapInst.current.removeLayer(layer)
    })
    drawnLayers.current = []
    actualizarEstado(); setModo('idle'); setError('')
  }

  function handleCancel() {
    if (!mapInst.current) return
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Polygon')
    if (modo === 'editando') mapInst.current.pm.toggleGlobalEditMode()
    if (modo === 'borrando') mapInst.current.pm.toggleGlobalRemovalMode()
    setModo('idle')
  }

  async function handleSave() {
    if (drawnLayers.current.length === 0) {
      setError('Dibujá al menos una zona primero'); return
    }
    setSaving(true); setError('')
    try {
      const features = drawnLayers.current
        .filter(l => l?.toGeoJSON)
        .map(layer => {
          try { return layer.toGeoJSON() } catch { return null }
        })
        .filter(f => f !== null)
      if (features.length === 0) throw new Error('No hay polígonos válidos')
      const geojson = { type: 'FeatureCollection', features: features }
      const { error: err } = await supabase.from('equipos').update({ area_geojson: geojson }).eq('id', equipo.id)
      if (err) throw err
      onSaved(); onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--r2)', width: '100%', maxWidth: 780, maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.25)' }}>
        
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700, margin: 0 }}>📍 Zona — {equipo.nombre}</h3>
            <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '3px 0 0' }}>
              {tienePol ? `🗂 ${drawnLayers.current.length} zona(s)` : 'Dibujá una o más áreas'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink3)' }}>×</button>
        </div>

        <div style={{ flex: 1, position: 'relative', minHeight: 400, background: '#f0f2f5' }}>
          {!listo && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', zIndex: 1 }}>
              <Spinner center size="lg" />
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
          
          {modo !== 'idle' && listo && (
            <div style={{ 
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 16px', background: 'var(--accent)', color: '#fff',
              borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,.15)', maxWidth: '90%', textAlign: 'center'
            }}>
              {modo === 'dibujando' && '✏️ Dibujando: clics para puntos • DOBLE CLIC para cerrar'}
              {modo === 'editando' && '🔧 Editando: ARRASTRÁ los puntos azules • ESC para cancelar'}
              {modo === 'borrando' && '🗑️ Clic en polígono para eliminar • ESC para cancelar'}
            </div>
          )}
        </div>

        <div style={{ 
          padding: '14px 22px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--surface)',
          display: 'flex', 
          alignItems: 'center', 
          gap: 10, 
          flexWrap: 'wrap',
          flexShrink: 0 
        }}>
          <button 
            onClick={activarDibujar}
            style={{ 
              padding: '10px 18px', 
              background: modo === 'dibujando' ? 'var(--accent)' : 'var(--surface)',
              color: modo === 'dibujando' ? '#fff' : 'var(--ink)',
              border: `2px solid ${modo === 'dibujando' ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 'var(--r)', 
              cursor: 'pointer', 
              fontSize: 13, 
              fontWeight: modo === 'dibujando' ? 700 : 600,
              fontFamily: 'DM Sans',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            🖊️ {modo === 'dibujando' ? 'Dibujando...' : 'Dibujar zona'}
          </button>

          <button 
            onClick={activarEditar}
            disabled={drawnLayers.current.length === 0}
            style={{ 
              padding: '10px 18px', 
              background: modo === 'editando' ? 'var(--accent)' : 'var(--surface)',
              color: modo === 'editando' ? '#fff' : 'var(--ink)',
              border: `2px solid ${modo === 'editando' ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 'var(--r)', 
              cursor: drawnLayers.current.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 13, 
              fontWeight: modo === 'editando' ? 700 : 600,
              fontFamily: 'DM Sans',
              opacity: drawnLayers.current.length === 0 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            ✏️ {modo === 'editando' ? 'Editando...' : 'Editar vértices'}
          </button>

          <button 
            onClick={activarBorrar}
            disabled={drawnLayers.current.length === 0}
            style={{ 
              padding: '10px 18px', 
              background: modo === 'borrando' ? 'var(--danger)' : 'var(--surface)',
              color: modo === 'borrando' ? '#fff' : 'var(--danger)',
              border: `2px solid ${modo === 'borrando' ? 'var(--danger)' : 'var(--danger)'}`,
              borderRadius: 'var(--r)', 
              cursor: drawnLayers.current.length === 0 ? 'not-allowed' : 'pointer', 
              fontSize: 13, 
              fontWeight: modo === 'borrando' ? 700 : 600,
              fontFamily: 'DM Sans',
              opacity: drawnLayers.current.length === 0 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            🗑️ {modo === 'borrando' ? 'Clic para borrar' : 'Eliminar zona'}
          </button>

          {tienePol && modo === 'idle' && (
            <button 
              onClick={handleClearAll}
              style={{ 
                padding: '10px 18px', 
                background: 'none', 
                color: 'var(--danger)', 
                border: '1.5px dashed var(--danger)', 
                borderRadius: 'var(--r)', 
                cursor: 'pointer', 
                fontSize: 12, 
                fontFamily: 'DM Sans'
              }}
            >
              🔄 Borrar todas
            </button>
          )}

          {/* BOTÓN GUARDAR MOVIDO AQUÍ */}
          <button 
            onClick={handleSave} 
            disabled={saving || !tienePol}
            style={{ 
              padding: '10px 18px', 
              background: !tienePol ? 'var(--gray-300)' : 'var(--accent)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 'var(--r)', 
              cursor: (!tienePol || saving) ? 'not-allowed' : 'pointer', 
              fontSize: 13, 
              fontWeight: 700,
              fontFamily: 'DM Sans',
              opacity: !tienePol ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            {saving ? 'Guardando...' : '✅ Guardar zona(s)'}
          </button>

          {modo !== 'idle' && (
            <button 
              onClick={handleCancel}
              style={{ 
                padding: '10px 18px', 
                background: 'none', 
                color: 'var(--ink3)', 
                border: '1.5px solid var(--border2)', 
                borderRadius: 'var(--r)', 
                cursor: 'pointer', 
                fontSize: 13, 
                fontFamily: 'DM Sans',
                marginLeft: 'auto'
              }}
            >
              Cancelar
            </button>
          )}

          {error && <span style={{ fontSize: 13, color: 'var(--danger)', width: '100%', marginTop: 4 }}>{error}</span>}
        </div>

        <div style={{ 
          padding: '12px 22px', 
          borderTop: '1px solid var(--border)', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 8, 
          flexShrink: 0,
          background: '#fff'
        }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Cerrar ventana
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──
export default function Equipos() {
  const { perfil } = useAuth()
  const [equipos, setEquipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [geoModal, setGeoModal] = useState(null)

  async function fetchData() {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    const { data } = await supabase
      .from('equipos')
      .select('*, equipo_coordinadores(count), equipo_encuestadores(count)')
      .eq('organizacion_id', perfil.organizacion_id)
      .order('nombre')
    setEquipos(data || [])
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

      {geoModal && (
        <GeofencingModal
          equipo={geoModal}
          onClose={() => setGeoModal(null)}
          onSaved={() => { setGeoModal(null); fetchData() }}
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
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: eq.area_geojson ? 'var(--accent-light)' : '#fef3c7', color: eq.area_geojson ? 'var(--accent2)' : '#b45309', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {eq.area_geojson ? '📍 Zona definida' : '⚠ Sin zona'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 14, margin: '10px 0', fontSize: 13, color: 'var(--ink3)' }}>
                    <span>👔 {eq.equipo_coordinadores?.[0]?.count ?? 0} coordinadores</span>
                    <span>👤 {eq.equipo_encuestadores?.[0]?.count ?? 0} encuestadores</span>
                  </div>
                  <div className={styles.encuestaActions}>
                    <button onClick={() => setModal(eq)} style={{ padding: '6px 14px', background: 'var(--surface)', color: 'var(--ink2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      Editar
                    </button>
                    {eq.geofencing_activo && (
                      <button onClick={() => setGeoModal(eq)} style={{ padding: '6px 14px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                        📍 {eq.area_geojson ? 'Ver/editar zona' : 'Definir zona'}
                      </button>
                    )}
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