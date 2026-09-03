import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as turf from '@turf/turf'

async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

const ESTILO_SEL    = { color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.5, weight: 2.5 }
const ESTILO_NO_SEL = { color: 'var(--ink3)', fillColor: 'var(--ink4)', fillOpacity: 0.15, weight: 1.5 }
const ESTILO_HOVER  = { color: 'var(--ink3)', fillColor: 'var(--ink4)', fillOpacity: 0.4,  weight: 1.5 }

const ESTILOS_PARCELA = {
  'mapa:parcela_urbana':    { color: 'var(--danger)', fillColor: '#fca5a5', fillOpacity: 0.5, weight: 1 },
  'mapa:parcela_urbana_v2': { color: '#7c3aed', fillColor: '#c4b5fd', fillOpacity: 0.5, weight: 1 },
  'mapa:parcelas':          { color: '#b45309', fillColor: '#fde68a', fillOpacity: 0.5, weight: 1 },
}

export default function TestManzanas() {
  const mapRef           = useRef(null)
  const mapInst          = useRef(null)
  const zonaRef          = useRef(null)
  const manzLayersRef    = useRef([])
  const parcelaLayersRef = useRef({}) // { typeName: L.geoJSON layer }
  const selRef           = useRef(new Set())

  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(null) // null | 'manzanas' | typeName parcela
  const [modo,    setModo]    = useState('idle')
  const [nTotal,  setNTotal]  = useState(0)
  const [nSel,    setNSel]    = useState(0)
  const [parcelasInfo, setParcelasInfo] = useState({}) // { typeName: nFeatures }

  const log = (msg) => setLogs(prev => [...prev, msg])

  useEffect(() => {
    let mounted = true
    async function setup() {
      if (!mapRef.current || mapInst.current) return
      const L = await initMapLibs()
      if (!mounted) return

      const map = L.map(mapRef.current, { center: [-27.37, -55.90], zoom: 13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      map.pm.setLang('es')
      map.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false })
      map.pm.removeControls({
        drawMarker: true, drawCircle: true, drawRectangle: true, drawPolyline: true,
        drawCircleMarker: true, cutPolygon: true, editMode: true, dragMode: true,
        removalMode: true, rotateMode: true,
      })

      map.on('pm:create', async (e) => {
        if (!mounted) return
        if (zonaRef.current) map.removeLayer(zonaRef.current)
        limpiarManzanas(map)
        limpiarParcelas(map)
        e.layer.setStyle({ color: '#0369a1', fillColor: '#0369a1', fillOpacity: 0.06, weight: 2, dashArray: '8,5' })
        zonaRef.current = e.layer
        setModo('idle')
        await fetchManzanas(L, map, e.layer)
      })

      mapInst.current = map
      setTimeout(() => map.invalidateSize(), 100)
    }
    setup()
    return () => {
      mounted = false
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  function limpiarManzanas(map) {
    manzLayersRef.current.forEach(({ layer }) => map.removeLayer(layer))
    manzLayersRef.current = []
    selRef.current = new Set()
    setNTotal(0); setNSel(0)
  }

  function limpiarParcelas(map) {
    Object.values(parcelaLayersRef.current).forEach(l => map.removeLayer(l))
    parcelaLayersRef.current = {}
    setParcelasInfo({})
  }

  // Bbox de las manzanas seleccionadas (unión de sus bounds)
  function bboxDeSeleccionadas() {
    const seleccionadas = manzLayersRef.current.filter(({ id }) => selRef.current.has(id))
    if (!seleccionadas.length) return null
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
    seleccionadas.forEach(({ feature }) => {
      const b = turf.bbox(feature)
      // turf.bbox devuelve [minLng, minLat, maxLng, maxLat]
      if (b[0] < west)  west  = b[0]
      if (b[1] < south) south = b[1]
      if (b[2] > east)  east  = b[2]
      if (b[3] > north) north = b[3]
    })
    return { west, south, east, north }
  }

  async function fetchManzanas(L, map, zonaLayer) {
    setLoading('manzanas')
    try {
      const bounds = zonaLayer.getBounds()
      const pad = 0.002
      const bbox = {
        west:  bounds.getWest()  - pad,
        south: bounds.getSouth() - pad,
        east:  bounds.getEast()  + pad,
        north: bounds.getNorth() + pad,
      }

      const { data, error } = await supabase.functions.invoke('catastro-proxy', {
        method: 'POST',
        body: { bbox, typeName: 'mapa:manzanas', maxFeatures: 5000 },
      })
      if (error) throw new Error(JSON.stringify(error))

      const total = data.features?.length ?? 0
      log(`Catastro manzanas: ${total} en bbox`)

      const zonaPoligono = zonaLayer.toGeoJSON()
      const enZona = data.features.filter(f => {
        try { return turf.booleanIntersects(f, zonaPoligono) } catch { return false }
      })
      log(`✅ Manzanas en zona: ${enZona.length}`)

      enZona.forEach(feature => {
        const id = feature.properties?.gid || feature.id
        const layer = L.geoJSON(feature, { style: ESTILO_NO_SEL }).addTo(map)

        layer.on('click', () => {
          if (selRef.current.has(id)) {
            selRef.current.delete(id)
            layer.setStyle(ESTILO_NO_SEL)
          } else {
            selRef.current.add(id)
            layer.setStyle(ESTILO_SEL)
          }
          setNSel(selRef.current.size)
        })
        layer.on('mouseover', () => { if (!selRef.current.has(id)) layer.setStyle(ESTILO_HOVER) })
        layer.on('mouseout',  () => { if (!selRef.current.has(id)) layer.setStyle(ESTILO_NO_SEL) })

        manzLayersRef.current.push({ id, layer, feature })
      })
      setNTotal(enZona.length)
    } catch (err) {
      log(`❌ ${err.message}`)
    }
    setLoading(null)
  }

  async function fetchParcelas(typeName) {
    if (!selRef.current.size) { log('⚠ Seleccioná al menos una manzana primero'); return }

    const map = mapInst.current
    const L = (await import('leaflet')).default

    // Quitar capa previa de este typeName si existe
    if (parcelaLayersRef.current[typeName]) {
      map.removeLayer(parcelaLayersRef.current[typeName])
      delete parcelaLayersRef.current[typeName]
      setParcelasInfo(prev => { const n = {...prev}; delete n[typeName]; return n })
      return
    }

    setLoading(typeName)
    try {
      const bbox = bboxDeSeleccionadas()
      if (!bbox) throw new Error('Sin manzanas seleccionadas')

      log(`Buscando ${typeName}...`)
      const { data, error } = await supabase.functions.invoke('catastro-proxy', {
        method: 'POST',
        body: { bbox, typeName, maxFeatures: 5000 },
      })
      if (error) throw new Error(JSON.stringify(error))

      const total = data.features?.length ?? 0
      log(`${typeName}: ${total} features en bbox`)

      if (!total) { log(`⚠ ${typeName}: sin datos`); setLoading(null); return }

      // Filtrar solo las que intersectan con las manzanas seleccionadas
      const seleccionadas = manzLayersRef.current
        .filter(({ id }) => selRef.current.has(id))
        .map(({ feature }) => feature)

      // Filtrar parcelas que intersectan con ALGUNA de las manzanas seleccionadas
      const enManzanas = data.features.filter(parcela => {
        return seleccionadas.some(manzana => {
          try { return turf.booleanIntersects(parcela, manzana) } catch { return false }
        })
      })

      log(`✅ ${typeName}: ${enManzanas.length} parcelas sobre manzanas seleccionadas`)

      if (!enManzanas.length) { log(`⚠ Sin parcelas en las manzanas seleccionadas`); setLoading(null); return }

      const style = ESTILOS_PARCELA[typeName]
      const layer = L.geoJSON(
        { type: 'FeatureCollection', features: enManzanas },
        {
          style,
          onEachFeature: (feature, l) => {
            const props = feature.properties
            l.bindTooltip(
              `gid: ${props?.gid ?? '?'} | cca: ${props?.cca ?? '?'}`,
              { sticky: true, opacity: 0.9 }
            )
          }
        }
      ).addTo(map)

      // Asegurar que esta capa quede encima de todo
      layer.bringToFront()
      parcelaLayersRef.current[typeName] = layer
      setParcelasInfo(prev => ({ ...prev, [typeName]: enManzanas.length }))

      log(`Primera parcela: ${JSON.stringify(enManzanas[0]?.properties)}`)
    } catch (err) {
      log(`❌ ${typeName}: ${err.message}`)
    }
    setLoading(null)
  }

  function seleccionarTodas() {
    manzLayersRef.current.forEach(({ id, layer }) => { selRef.current.add(id); layer.setStyle(ESTILO_SEL) })
    setNSel(manzLayersRef.current.length)
  }
  function deseleccionarTodas() {
    manzLayersRef.current.forEach(({ id, layer }) => { selRef.current.delete(id); layer.setStyle(ESTILO_NO_SEL) })
    setNSel(0)
  }

  function activarDibujar() {
    if (!mapInst.current) return
    if (modo === 'dibujando') { mapInst.current.pm.disableDraw('Polygon'); setModo('idle'); return }
    mapInst.current.pm.enableDraw('Polygon', { allowSelfIntersection: false })
    setModo('dibujando')
    log('Dibujá la zona — doble clic para cerrar')
  }

  function limpiarTodo() {
    if (!mapInst.current) return
    if (zonaRef.current) { mapInst.current.removeLayer(zonaRef.current); zonaRef.current = null }
    limpiarManzanas(mapInst.current)
    limpiarParcelas(mapInst.current)
    setLogs([]); setModo('idle')
  }

  const capas = [
    { typeName: 'mapa:parcela_urbana',    label: 'parcela_urbana',    color: 'var(--danger)' },
    { typeName: 'mapa:parcela_urbana_v2', label: 'parcela_urbana_v2', color: '#7c3aed' },
    { typeName: 'mapa:parcelas',          label: 'parcelas',          color: '#b45309' },
  ]

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Test manzanas + parcelas</h2>

      {/* Controles zona + manzanas */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={activarDibujar} disabled={!!loading}
          style={{ padding: '8px 16px', background: modo === 'dibujando' ? '#0369a1' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {modo === 'dibujando' ? '✏️ Dibujando...' : '🖊️ Dibujar zona'}
        </button>
        {nTotal > 0 && (
          <>
            <button onClick={seleccionarTodas} style={{ padding: '7px 13px', background: 'var(--paper)', border: '1.5px solid var(--accent)', color: 'var(--accent)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Todas
            </button>
            <button onClick={deseleccionarTodas} style={{ padding: '7px 13px', background: 'var(--paper)', border: '1.5px solid var(--border2)', color: 'var(--ink3)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              Ninguna
            </button>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              {nSel}/{nTotal} manzanas
            </span>
          </>
        )}
        <button onClick={limpiarTodo} style={{ padding: '7px 13px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Limpiar
        </button>
        {loading && <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>⏳ {loading === 'manzanas' ? 'Cargando manzanas...' : `Cargando ${loading}...`}</span>}
      </div>

      {/* Botones de parcelas */}
      {nSel > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Parcelas sobre manzanas seleccionadas:</span>
          {capas.map(({ typeName, label, color }) => {
            const activa = !!parcelaLayersRef.current[typeName]
            const n = parcelasInfo[typeName]
            return (
              <button key={typeName} onClick={() => fetchParcelas(typeName)} disabled={loading === typeName}
                style={{ padding: '7px 14px', background: activa ? color : '#fff', color: activa ? '#fff' : color, border: `2px solid ${color}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, opacity: loading === typeName ? 0.6 : 1 }}>
                {activa ? '✓ ' : ''}{label}{n ? ` (${n})` : ''}
              </button>
            )
          })}
          <span style={{ fontSize: 11, color: 'var(--ink4)' }}>Clic para mostrar/ocultar</span>
        </div>
      )}

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--ink3)', flexWrap: 'wrap' }}>
        <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>■</span> Manzana seleccionada</span>
        <span><span style={{ color: 'var(--ink4)', fontWeight: 700 }}>■</span> Manzana sin seleccionar</span>
        <span><span style={{ color: 'var(--danger)', fontWeight: 700 }}>■</span> parcela_urbana</span>
        <span><span style={{ color: '#7c3aed', fontWeight: 700 }}>■</span> parcela_urbana_v2</span>
        <span><span style={{ color: '#b45309', fontWeight: 700 }}>■</span> parcelas</span>
      </div>

      {/* Logs */}
      <div style={{ padding: 10, background: '#0f172a', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', maxHeight: 120, overflowY: 'auto' }}>
        {logs.length === 0
          ? <span style={{ color: '#475569' }}>Dibujá una zona para empezar...</span>
          : logs.map((l, i) => (
            <div key={i} style={{ color: l.startsWith('✅') ? '#4ade80' : l.startsWith('❌') ? '#f87171' : l.startsWith('⚠') ? '#fbbf24' : 'var(--ink4)' }}>{l}</div>
          ))}
      </div>

      <div ref={mapRef} style={{ height: 450, borderRadius: 8, border: '1px solid #ccc' }} />
    </div>
  )
}