// src/pages/admin/GeofencingModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'
import * as turf from '@turf/turf'

// ── Lazy load leaflet + geoman ──
async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

// ── FUNCIÓN: Trae manzanas oficiales desde Catastro ──
async function fetchManzanasCatastro(bounds) {
  const { south, west, north, east } = bounds
  const payload = { bbox: { south, west, north, east }, typeName: 'mapa:manzanas' }

  try {
    const { data, error } = await supabase.functions.invoke('catastro-proxy', {
      method: 'POST', body: payload,
    })
    if (error) throw error
    if (!data?.features || data.features.length === 0) {
      throw new Error('No se encontraron manzanas en esta zona.')
    }
    console.log(`✅ Traídas ${data.features.length} manzanas del Catastro`)
    return data.features
  } catch (err) {
    console.error('❌ Error fetchManzanasCatastro:', err)
    throw new Error(err.message || 'Error al cargar manzanas del Catastro')
  }
}

// ── Filtrar manzanas dentro de la zona con Turf ──
function filtrarConTurf(features, zona) {
  if (!zona?.geometry) return []
  const zonaPoly = turf.polygon(zona.geometry.coordinates)
  return features.filter((f) => {
    try {
      if (!f?.geometry?.coordinates) return false
      const feature = turf.feature(f.geometry, f.properties)
      return turf.booleanIntersects(feature, zonaPoly) || turf.booleanWithin(feature, zonaPoly)
    } catch { return false }
  })
}

// ── Componente principal ──
export default function GeofencingModal({ 
  equipo, 
  onClose, 
  onSaved, 
  entityType = 'equipo',
  mode = 'zona-y-manzanas'  // 👈 NUEVO: 'zona-solo' | 'zona-y-manzanas'
}) {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const zonaLayer = useRef(null)
  const manzanasGroup = useRef(null)
  const Lref = useRef(null)
  const isMounted = useRef(true)

  const [paso, setPaso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingCatastro, setLoadingCatastro] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [modo, setModo] = useState('idle')
  const [tieneZona, setTieneZona] = useState(false)
  const [manzanasCatastro, setManzanasCatastro] = useState([])
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const seleccionadasRef = useRef(new Set())

  useEffect(() => { seleccionadasRef.current = seleccionadas }, [seleccionadas])
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false } }, [])
    // ───────────────────────────── INIT MAP ─────────────────────────────
  useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const L = await initMapLibs()
        if (!mounted || !isMounted.current) return
        Lref.current = L

        const map = L.map(mapRef.current, { center: [-27.3671, -55.8974], zoom: 14, preferCanvas: true })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map)
        map.pm.setLang('es')
        map.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false })
        map.pm.removeControls({ drawMarker: true, drawCircle: true, drawRectangle: true, drawPolyline: true })

        const createHandler = (e) => {
          const layer = e.layer
          if (zonaLayer.current) map.removeLayer(zonaLayer.current)
          zonaLayer.current = layer
          setTieneZona(true)
          setModo('idle')
          // 👇 Solo cargar manzanas si mode es 'zona-y-manzanas'
          if (mode === 'zona-y-manzanas') {
            setTimeout(() => cargarManzanas(), 300)
          }
        }
        map.on('pm:create', createHandler)
        mapInst.current = map
        setListo(true)

        if (equipo?.area_geojson) cargarDesdeDB(L, map)
      } catch (err) {
        console.error('Error inicializando mapa:', err)
        setError('Error al cargar el mapa')
      }
    }
    init()
    return () => {
      mounted = false
      if (mapInst.current) {
        mapInst.current.off('pm:create')
        mapInst.current.remove()
        mapInst.current = null
      }
      zonaLayer.current = null
      manzanasGroup.current = null
    }
  }, [mode])

  // ───────────────────────────── CARGAR ZONA DESDE DB ─────────────────────────────
  const cargarDesdeDB = useCallback((L, map) => {
    const geojson = equipo.area_geojson
    if (!geojson || !L || !map) return
    if (zonaLayer.current) { map.removeLayer(zonaLayer.current); zonaLayer.current = null }
    if (manzanasGroup.current) { map.removeLayer(manzanasGroup.current); manzanasGroup.current = null }

    const zonaFeature = geojson.features?.find(f => f.properties?.tipo === 'zona')
    const manzanas = geojson.features?.filter(f => f.properties?.tipo === 'manzana') || []

    if (zonaFeature) {
      const layer = L.geoJSON(zonaFeature, { style: { color: 'var(--accent)', fillOpacity: 0.2, weight: 2 } }).addTo(map)
      zonaLayer.current = layer
      setTieneZona(true)
      map.fitBounds(layer.getBounds())
    }

    // 👇 Solo cargar manzanas si mode es 'zona-y-manzanas'
    if (manzanas.length > 0 && mode === 'zona-y-manzanas') {
      const ids = new Set(manzanas.map(f => f.properties?.gid || f.id))
      setSeleccionadas(ids)
      seleccionadasRef.current = ids
      const geoLayer = L.geoJSON(manzanas, {
        renderer: L.canvas(),
        style: (f) => estiloManzana(true),
        onEachFeature: (feature, layer) => {
          const id = feature.properties?.gid || feature.id
          layer.on('click', () => toggleSeleccion(id, layer))
        },
      })
      geoLayer.addTo(map)
      manzanasGroup.current = geoLayer
      setManzanasCatastro(manzanas)
      setPaso(2)
    }
  }, [equipo?.area_geojson, mode])

  // ───────────────────────────── CARGA MANZANAS ─────────────────────────────
  const cargarManzanas = useCallback(async () => {
    if (!zonaLayer.current || !mapInst.current) return
    setLoadingCatastro(true); setError('')
    try {
      const bounds = zonaLayer.current.getBounds()
      const bbox = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() }
      let features = await fetchManzanasCatastro(bbox)
      const zonaGeoJSON = zonaLayer.current.toGeoJSON()
      features = filtrarConTurf(features, zonaGeoJSON)
      if (features.length === 0) { setError('No hay manzanas dentro de la zona dibujada'); return }

      const L = Lref.current; const map = mapInst.current
      if (manzanasGroup.current) map.removeLayer(manzanasGroup.current)

      const geoLayer = L.geoJSON(features, {
        renderer: L.canvas(),
        style: (f) => estiloManzana(false),
        onEachFeature: (feature, layer) => {
          const id = feature.properties?.gid || feature.id
          layer.on('click', () => toggleSeleccion(id, layer))
          layer.on('mouseover', () => { if (!seleccionadasRef.current.has(id)) layer.setStyle({ fillOpacity: 0.4 }) })
          layer.on('mouseout', () => { const sel = seleccionadasRef.current.has(id); layer.setStyle(estiloManzana(sel)) })
        },
      })
      geoLayer.addTo(map)
      manzanasGroup.current = geoLayer
      setManzanasCatastro(features)
      setPaso(2)
    } catch (err) {
      console.error('Error cargando manzanas:', err)
      setError(err.message || 'Error al cargar manzanas')
    } finally { setLoadingCatastro(false) }
  }, [manzanasGroup, zonaLayer, Lref, mapInst, seleccionadasRef])

  const toggleSeleccion = (id, layer) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else { next.add(id); layer?.bringToFront?.() }
      return next
    })
  }

  const estiloManzana = useCallback((sel) => ({
    color: sel ? 'var(--accent)' : 'var(--ink3)',
    fillColor: sel ? 'var(--accent)' : 'var(--ink4)',
    fillOpacity: sel ? 0.5 : 0.2,
    weight: sel ? 3 : 1.5,
  }), [])

  useEffect(() => {
    if (!manzanasGroup.current) return
    manzanasGroup.current.eachLayer((layer) => {
      const id = layer.feature?.properties?.gid || layer.feature?.id
      if (id !== undefined) layer.setStyle(estiloManzana(seleccionadas.has(id)))
    })
  }, [seleccionadas, estiloManzana])

  // ───────────────────────────── CONTROLES GEOMAN ─────────────────────────────
  const activarDibujar = () => { const map = mapInst.current; if (!map) return; cancelarModo(); setModo('dibujando'); map.pm.enableDraw('Polygon', { snappable: true, allowSelfIntersection: false }) }
  const activarEditar = () => {
  const map = mapInst.current
  if (!map || !zonaLayer.current) return
  cancelarModo()
  setModo('editando')
  const enableLayer = (l) => {
    try { if (l?.pm?.enable) l.pm.enable({ allowSelfIntersection: false }) } catch (e) {}
  }
  if (typeof zonaLayer.current.eachLayer === 'function') {
    zonaLayer.current.eachLayer(enableLayer)
  } else {
    enableLayer(zonaLayer.current)
  }
}

  const activarMover = () => {
  const map = mapInst.current
  if (!map || !zonaLayer.current) return
  cancelarModo()
  setModo('moviendo')
  const enableDrag = (l) => {
    try { if (l?.pm?.enableLayerDrag) l.pm.enableLayerDrag() } catch (e) {}
  }
  if (typeof zonaLayer.current.eachLayer === 'function') {
    zonaLayer.current.eachLayer(enableDrag)
  } else {
    enableDrag(zonaLayer.current)
  }
}
  const cancelarModo = () => {
  const map = mapInst.current
  if (!map) return
  setModo('idle')
  map.pm.disableDraw()
  if (zonaLayer.current) {
    const disableLayer = (l) => {
      try {
        if (l?.pm?.disable) l.pm.disable()
        if (l?.pm?.disableLayerDrag) l.pm.disableLayerDrag()
      } catch (e) {}
    }
    if (typeof zonaLayer.current.eachLayer === 'function') {
      zonaLayer.current.eachLayer(disableLayer)
    } else {
      disableLayer(zonaLayer.current)
    }
  }
  // Solo deshabilitar el modo que estaba activo
  try {
    if (modo === 'editando') map.pm.disableGlobalEditMode()
    if (modo === 'moviendo') map.pm.disableGlobalDragMode()
  } catch (e) {}
}
  const borrarZona = () => {
    const map = mapInst.current; if (!map) return
    if (zonaLayer.current) { map.removeLayer(zonaLayer.current); zonaLayer.current = null }
    if (manzanasGroup.current) { map.removeLayer(manzanasGroup.current); manzanasGroup.current = null }
    setTieneZona(false); setPaso(1); setManzanasCatastro([]); setSeleccionadas(new Set())
  }
  const volverAlPaso1 = () => { setPaso(1); if (manzanasGroup.current && mapInst.current) { mapInst.current.removeLayer(manzanasGroup.current); manzanasGroup.current = null } }
  const seleccionarTodas = () => { const ids = new Set(manzanasCatastro.map(f => f.properties?.gid || f.id)); setSeleccionadas(ids) }
  const deseleccionarTodas = () => setSeleccionadas(new Set())
    // ───────────────────────────── GUARDAR ─────────────────────────────
  const handleSave = async () => {
    if (!zonaLayer.current) { setError('Falta definir la zona de operación'); return }
    
    // 👇 Solo validar manzanas si mode es 'zona-y-manzanas'
    if (mode === 'zona-y-manzanas' && paso === 2 && seleccionadas.size === 0) {
      setError('Seleccioná al menos una manzana'); return
    }
    
    setSaving(true); setError('')
    try {
      // toGeoJSON() puede devolver Feature o FeatureCollection según cómo se creó la capa
      const raw = zonaLayer.current.toGeoJSON()
      let zonaFeature
      if (raw.type === 'FeatureCollection') {
        zonaFeature = raw.features?.[0]
      } else {
        zonaFeature = raw  // ya es un Feature
      }
      if (!zonaFeature?.geometry) throw new Error('No se pudo obtener la geometría de la zona')
      zonaFeature = { ...zonaFeature, properties: { ...(zonaFeature.properties || {}), tipo: 'zona' } }

      let features = [zonaFeature]
      
      if (mode === 'zona-y-manzanas') {
        const manzanas = manzanasCatastro
          .filter(f => seleccionadas.has(f.properties?.gid || f.id))
          .map(f => ({ ...f, properties: { ...f.properties, tipo: 'manzana' } }))
        features = [...features, ...manzanas]
      }
      
      const geojson = { type: 'FeatureCollection', features }
      const table = entityType === 'encuesta' ? 'encuestas' : 'equipos'
      
      const updatePayload = { area_geojson: geojson }
      // Only set geofencing_activo on equipos (encuestas manages it separately)
      if (entityType !== 'encuesta') updatePayload.geofencing_activo = true
      
      const { error: err } = await supabase
        .from(table)
        .update(updatePayload)
        .eq('id', equipo.id)
      
      if (err) throw err
      onSaved(); onClose()
    } catch (err) {
      console.error('Error guardando geofencing:', err)
      setError(err.message || 'Error al guardar la configuración')
    } finally { setSaving(false) }
  }

  // ───────────────────────────── ESTILOS ─────────────────────────────
  const btn = (active = false) => ({ padding: '6px 14px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid var(--border2)', background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--ink2)', transition: 'all .15s' })
  const btnPrimary = (disabled = false) => ({ ...btn(true), background: disabled ? 'var(--surface2)' : 'var(--accent2)', color: disabled ? 'var(--ink3)' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 })
  const btnDanger = () => ({ ...btn(false), border: '1.5px solid var(--danger)', color: 'var(--danger)', background: 'transparent' })

  // ───────────────────────────── RENDER ─────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 860, maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}>
        
        {/* HEADER */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--paper)' }}>
          <div>
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, margin: 0 }}>
              📍 {equipo?.nombre} — {paso === 1 ? 'Definir zona de operación' : 'Seleccionar manzanas'}
            </h3>
            {/* 👇 Solo mostrar pasos si mode es 'zona-y-manzanas' */}
            {mode === 'zona-y-manzanas' && (
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                {[
                  { n: 1, label: 'Dibujá la zona' },
                  { n: 2, label: 'Seleccioná manzanas' },
                ].map(({ n, label }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: paso >= n ? 'var(--accent)' : 'var(--surface2)', color: paso >= n ? '#fff' : 'var(--ink3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n}</div>
                    <span style={{ color: paso >= n ? 'var(--accent)' : 'var(--ink3)', fontWeight: paso === n ? 600 : 400 }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', fontSize: 24, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--ink3)', lineHeight: 1, padding: '0 4px', opacity: saving ? 0.5 : 1 }}>×</button>
        </div>

        {/* TOOLBAR */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          {paso === 1 ? (
            <>
              <button onClick={activarDibujar} disabled={saving} style={{...btn(modo === 'dibujando'), opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}>
                🖊️ {modo === 'dibujando' ? 'Dibujando...' : tieneZona ? 'Redibujar zona' : 'Dibujar zona'}
              </button>
              <button onClick={activarEditar} disabled={!tieneZona || saving} style={{ ...btn(modo === 'editando'), opacity: (!tieneZona || saving) ? .4 : 1, cursor: (!tieneZona || saving) ? 'not-allowed' : 'pointer' }}>
                ✏️ {modo === 'editando' ? 'Editando...' : 'Editar vértices'}
              </button>
              <button onClick={activarMover} disabled={!tieneZona || saving} style={{ ...btn(modo === 'moviendo'), opacity: (!tieneZona || saving) ? .4 : 1, cursor: (!tieneZona || saving) ? 'not-allowed' : 'pointer' }}>
                ✋ {modo === 'moviendo' ? 'Moviendo...' : 'Mover zona'}
              </button>
              {tieneZona && modo === 'idle' && (
                <button onClick={borrarZona} disabled={saving} style={{...btnDanger(), opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}>
                  🗑️ Borrar zona
                </button>
              )}
              {modo !== 'idle' && (
                <button onClick={cancelarModo} disabled={saving} style={{ ...btn(false), color: 'var(--ink3)', opacity: saving ? 0.6 : 1 }}>
                  ESC / Cancelar
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={onClose} disabled={saving} style={{ ...btn(false), color: 'var(--ink3)', opacity: saving ? 0.6 : 1 }}>Cerrar</button>
                {tieneZona && (
                  <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
                    {saving ? 'Guardando...' : '💾 Guardar zona'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={volverAlPaso1} disabled={saving} style={{...btn(false), opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}>
                ← Volver a zona
              </button>
              <div style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 500 }}>
                {seleccionadas.size} de {manzanasCatastro.length} seleccionadas
              </div>
              <button onClick={seleccionarTodas} disabled={saving} style={{ ...btn(false), border: '1.5px solid var(--border2)', fontSize: 12, padding: '6px 12px', opacity: saving ? 0.6 : 1 }}>
                Seleccionar todas
              </button>
              <button onClick={deseleccionarTodas} disabled={saving} style={{ ...btn(false), border: '1.5px solid var(--border2)', fontSize: 12, padding: '6px 12px', color: 'var(--ink3)', opacity: saving ? 0.6 : 1 }}>
                Deseleccionar todas
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={onClose} disabled={saving} style={{ ...btn(false), color: 'var(--ink3)', opacity: saving ? 0.6 : 1 }}>Cerrar</button>
                <button onClick={handleSave} disabled={saving || seleccionadas.size === 0} style={btnPrimary(saving || seleccionadas.size === 0)}>
                  {saving ? 'Guardando...' : `✅ Guardar (${seleccionadas.size} manzanas)`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* TOOLTIP DE MODO */}
        {modo !== 'idle' && listo && !saving && (
          <div style={{ padding: '7px 16px', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
            {modo === 'dibujando' && '🖊️ Clic para agregar puntos · Doble clic para cerrar el polígono'}
            {modo === 'editando' && '🔧 Arrastrá los puntos azules para ajustar vértices · ESC para salir'}
            {modo === 'moviendo' && '✋ Cliqueá y arrastrá el polígono completo para moverlo · ESC para salir'}
          </div>
        )}

        {/* MAPA */}
        <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
          {(!listo || loadingCatastro) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(242,241,238,.92)', zIndex: 5, gap: 12 }}>
              <Spinner center size="lg" />
              {loadingCatastro && <span style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 500 }}>Cargando manzanas desde Catastro Misiones...</span>}
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />
        </div>

        {/* FOOTER */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, minHeight: 42 }}>
          {paso === 2 && manzanasCatastro.length > 0 && mode === 'zona-y-manzanas' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink3)' }}>
                <div style={{ width: 14, height: 14, background: 'var(--accent)', borderRadius: 2, opacity: .8 }} />
                Seleccionada
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink3)' }}>
                <div style={{ width: 14, height: 14, background: 'var(--ink4)', borderRadius: 2, opacity: .6 }} />
                Sin seleccionar (clic para seleccionar)
              </div>
            </>
          )}
          {paso === 1 && !tieneZona && (
            <span style={{ fontSize: 12, color: 'var(--ink3)' }}>Dibujá el polígono de la zona de operación</span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 500, marginLeft: 'auto' }}>
              ⚠ {error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}