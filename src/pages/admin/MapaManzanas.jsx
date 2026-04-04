import { useState, useEffect, useRef } from 'react'
import { Spinner } from '../../components/ui'

// ── Lazy load leaflet + geoman ──
async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

// ── Calcular esquina de un GeoJSON Feature rectangular ──
function calcularEsquina(geojson, lado) {
  try {
    const coords = geojson?.geometry?.coordinates?.[0] || geojson?.coordinates?.[0] || []
    if (!coords.length) return null
    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const map = {
      NE: [maxLat, maxLng],
      NO: [maxLat, minLng],
      SE: [minLat, maxLng],
      SO: [minLat, minLng]
    }
    const [lat, lng] = map[lado]
    return {
      lado,
      lat,
      lng,
      descripcion: {
        NE: 'Esquina noreste',
        NO: 'Esquina noroeste',
        SE: 'Esquina sureste',
        SO: 'Esquina suroeste'
      }[lado]
    }
  } catch { return null }
}

export function puntoInicioAleatorio(geojson) {
  const lados = ['NE', 'NO', 'SE', 'SO']
  return calcularEsquina(geojson, lados[Math.floor(Math.random() * 4)])
}

// ═══════════════════════════════════════════════════
// MAPA DE MANZANAS
// ═══════════════════════════════════════════════════
export default function MapaManzanas({ manzanasInit, onManzanasChange, geofencingArea }) {
  const mapRef = useRef(null)
  const mapInst = useRef(null)
  const layersRef = useRef([])
  const [listo, setListo] = useState(false)
  const [modo, setModo] = useState('idle')
  const [cantManzanas, setCantManzanas] = useState(0)

  // Sync layersRef → estado padre
  function sync() {
    const lista = layersRef.current.map((item, i) => ({
      localId: item.localId,
      dbId: item.dbId || null,
      nombre: item.nombre,
      area_geojson: item.layer.toGeoJSON?.() || null,
    }))
    setCantManzanas(lista.length)
    onManzanasChange(lista)
  }

  useEffect(() => {
    let mounted = true
    async function setup() {
      if (!mapRef.current || mapInst.current) return
      const L = await initMapLibs()
      if (!mounted) return

      const center = [-27.3671, -55.8974]
      const map = L.map(mapRef.current, { center, zoom: 14 })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      // Zona de la encuesta como referencia (azul punteado)
      if (geofencingArea) {
        try {
          const refLayer = L.geoJSON(geofencingArea, {
            style: { color: '#0369a1', fillColor: '#0369a1', fillOpacity: 0.05, weight: 2, dashArray: '8,6' }
          }).addTo(map)
          const b = refLayer.getBounds()
          if (b.isValid()) map.fitBounds(b, { padding: [24, 24] })
        } catch {}
      }

      // Geoman — solo rectángulos, sin toolbar nativa
      map.pm.setGlobalOptions({
        snappable: true, snapDistance: 20,
        pathOptions: { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.18, weight: 2, dashArray: '5,3' }
      })
      map.pm.removeControls({
        drawMarker: true, drawCircle: true, drawPolyline: true, drawPolygon: true,
        drawCircleMarker: true, cutPolygon: true, editMode: true, dragMode: true,
        removalMode: true, rotateMode: true,
      })

      // Cargar manzanas existentes desde DB
      manzanasInit.forEach((m, i) => {
        if (!m.area_geojson) return
        try {
          const nombre = m.nombre || `Manzana ${i + 1}`
          const feats = m.area_geojson.type === 'FeatureCollection' ? m.area_geojson.features : [m.area_geojson]
          feats.forEach(f => {
            const gl = L.geoJSON(f, {
              style: { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.18, weight: 2, dashArray: '5,3' }
            })
            gl.eachLayer(l => {
              l.addTo(map)
              l.bindTooltip(nombre, { permanent: true, direction: 'center', className: 'leaflet-manzana-label' })
              layersRef.current.push({ localId: `db-${m.id || i}`, dbId: m.id || null, layer: l, nombre })
            })
          })
        } catch {}
      })
      setCantManzanas(layersRef.current.length)

      // Evento: nueva manzana dibujada
      map.on('pm:create', (e) => {
        if (!e.layer) return
        const idx = layersRef.current.length + 1
        const nombre = `Manzana ${idx}`
        e.layer.setStyle({ color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.18, weight: 2, dashArray: '5,3' })
        e.layer.bindTooltip(nombre, { permanent: true, direction: 'center', className: 'leaflet-manzana-label' })
        layersRef.current.push({ localId: `new-${Date.now()}-${idx}`, dbId: null, layer: e.layer, nombre })
        setModo('idle')
        sync()
      })

      map.on('pm:edit', () => sync())
      map.on('pm:remove', (e) => {
        layersRef.current = layersRef.current.filter(x => x.layer !== e.layer)
        setModo('idle')
        sync()
      })
      map.on('pm:drawend', () => setModo('idle'))

      mapInst.current = map
      setListo(true)
      setTimeout(() => map.invalidateSize(), 150)
    }

    setup()
    return () => {
      mounted = false
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally run once — manzanasInit loaded on mount only

  function activarDibujar() {
    if (!mapInst.current) return
    if (modo === 'dibujando') { mapInst.current.pm.disableDraw('Rectangle'); setModo('idle'); return }
    if (modo === 'editando') mapInst.current.pm.toggleGlobalEditMode()
    if (modo === 'borrando') mapInst.current.pm.toggleGlobalRemovalMode()
    mapInst.current.pm.enableDraw('Rectangle', { snappable: true })
    setModo('dibujando')
  }

  function activarEditar() {
    if (!mapInst.current || !layersRef.current.length) return
    if (modo === 'editando') { mapInst.current.pm.toggleGlobalEditMode(); setModo('idle'); return }
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Rectangle')
    if (modo === 'borrando') mapInst.current.pm.toggleGlobalRemovalMode()
    mapInst.current.pm.toggleGlobalEditMode({ allowEditing: true })
    setModo('editando')
  }

  function activarBorrar() {
    if (!mapInst.current || !layersRef.current.length) return
    if (modo === 'borrando') { mapInst.current.pm.toggleGlobalRemovalMode(); setModo('idle'); return }
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Rectangle')
    if (modo === 'editando') mapInst.current.pm.toggleGlobalEditMode()
    mapInst.current.pm.toggleGlobalRemovalMode()
    setModo('borrando')
  }

  function limpiarTodo() {
    layersRef.current.forEach(x => { if (mapInst.current?.hasLayer(x.layer)) mapInst.current.removeLayer(x.layer) })
    layersRef.current = []
    setModo('idle')
    sync()
  }

  

  const tieneCapas = cantManzanas > 0

  const btnStyle = (active, color = 'var(--accent)', danger = false) => ({
    padding: '7px 13px', borderRadius: 'var(--r)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
    border: `2px solid ${danger ? 'var(--danger)' : color}`,
    background: active ? (danger ? 'var(--danger)' : color) : '#fff',
    color: active ? '#fff' : (danger ? 'var(--danger)' : color),
  })

  return (
    <div style={{ borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--border2)' }}>
      {/* Toolbar del mapa */}
      <div style={{ background: 'var(--surface)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: tieneCapas ? 'var(--accent2)' : 'var(--ink3)', marginRight: 4 }}>
          {tieneCapas ? `${cantManzanas} manzana${cantManzanas !== 1 ? 's' : ''}` : 'Sin manzanas'}
        </span>

        <button onClick={activarDibujar} style={btnStyle(modo === 'dibujando')}>
          ⬜ {modo === 'dibujando' ? 'Dibujando...' : 'Nueva manzana'}
        </button>

        <button onClick={activarEditar} disabled={!tieneCapas}
          style={{ ...btnStyle(modo === 'editando'), opacity: tieneCapas ? 1 : .4, cursor: tieneCapas ? 'pointer' : 'not-allowed' }}>
          ✏️ Editar
        </button>

        <button onClick={activarBorrar} disabled={!tieneCapas}
          style={{ ...btnStyle(modo === 'borrando', 'var(--accent)', true), opacity: tieneCapas ? 1 : .4, cursor: tieneCapas ? 'pointer' : 'not-allowed' }}>
          🗑️ Borrar
        </button>

        {tieneCapas && modo === 'idle' && (
          <button onClick={limpiarTodo} style={{ ...btnStyle(false, 'var(--accent)', true), borderStyle: 'dashed', fontSize: 11 }}>
            Limpiar todo
          </button>
        )}


      </div>

      {/* Mapa */}
      <div style={{ position: 'relative' }}>
        {modo !== 'idle' && listo && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 500, padding: '5px 14px', background: 'var(--accent)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 600, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
            {modo === 'dibujando' && '⬜ Clic y arrastrá para dibujar una manzana'}
            {modo === 'editando' && '✏️ Arrastrá los puntos para ajustar · ESC para salir'}
            {modo === 'borrando' && '🗑️ Clic en una manzana para eliminarla · ESC para salir'}
          </div>
        )}
        {!listo && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
            <Spinner center size="lg" />
          </div>
        )}
        <div ref={mapRef} style={{ height: 320, width: '100%' }} />
      </div>
    </div>
  )
}