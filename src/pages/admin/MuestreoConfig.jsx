import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as turf from '@turf/turf'

// ── Estilos manzanas ──
const ESTILO_SEL    = { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.5,  weight: 2.5 }
const ESTILO_NO_SEL = { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.15, weight: 1.5 }
const ESTILO_HOVER  = { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.4,  weight: 1.5 }

// ── Config muestreo ──
const RAZONES_SISTEMA = [
  { key: 'no_hay_nadie',     label: 'No hay nadie en casa'        },
  { key: 'no_quiere',        label: 'No quiere participar'        },
  { key: 'no_cumple_perfil', label: 'No cumple el perfil buscado' },
  { key: 'barrera_idioma',   label: 'Barrera de idioma'           },
  { key: 'enfermedad',       label: 'Motivo de salud'             },
]
const CONFIG_DEFAULT = {
  intervalo_salto: 2, tipo_reemplazo: 'inmediato', max_intentos: 2,
  sentido_recorrido: 'horario', cuota_por_manzana: 10, razon_no_respuesta_extra: [],
}

async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

// ════════════════════════════════════════════════
// MAPA — zona + manzanas (lógica exacta del test)
// ════════════════════════════════════════════════
function MapaZona({ zonaActual, onCambio }) {
  const mapRef        = useRef(null)
  const mapInst       = useRef(null)
  const zonaRef       = useRef(null)
  const manzLayersRef = useRef([])   // [{ id, layer, feature }]
  const selRef        = useRef(new Set())

  const [modo,    setModo]    = useState('idle')
  const [loading, setLoading] = useState(false)
  const [nTotal,  setNTotal]  = useState(0)
  const [nSel,    setNSel]    = useState(0)
  const [error,   setError]   = useState('')
  const [listo,   setListo]   = useState(false)

  // onCambio se llama con { zonaGeoJSON, manzanasSeleccionadas, parcelasGeoJSON }
  // Usamos ref para evitar closures stale
  const onCambioRef = useRef(onCambio)
  useEffect(() => { onCambioRef.current = onCambio }, [onCambio])

  function emitir(zonaLayer, manzanas, parcelas) {
    if (!zonaLayer) return
    const zonaFeat = zonaLayer.toGeoJSON()
    const features = [
      { ...zonaFeat, properties: { ...(zonaFeat.properties || {}), tipo: 'zona' } },
      ...manzanas.map(f => ({ ...f, properties: { ...f.properties, tipo: 'manzana', seleccionada: selRef.current.has(f.properties?.gid || f.id) } })),
      ...parcelas.map(f => ({ ...f, properties: { ...f.properties, tipo: 'parcela' } })),
    ]
    onCambioRef.current({
      zonaGeoJSON: { type: 'FeatureCollection', features },
      manzanasSeleccionadas: manzanas.filter(f => selRef.current.has(f.properties?.gid || f.id)),
    })
  }

  function limpiarManzanas(map) {
    manzLayersRef.current.forEach(({ layer }) => map.removeLayer(layer))
    manzLayersRef.current = []
    selRef.current = new Set()
    setNTotal(0); setNSel(0)
  }

  useEffect(() => {
    let mounted = true
    async function setup() {
      if (!mapRef.current || mapInst.current) return
      const L = await initMapLibs()
      if (!mounted) return

      const map = L.map(mapRef.current, { center: [-27.3671, -55.8974], zoom: 13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      map.pm.setLang('es')
      map.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false })
      map.pm.removeControls({
        drawMarker: true, drawCircle: true, drawRectangle: true, drawPolyline: true,
        drawCircleMarker: true, cutPolygon: true, editMode: true, dragMode: true,
        removalMode: true, rotateMode: true,
      })

      // Cargar zona + manzanas guardadas en DB
      if (zonaActual?.features) {
        const zonaFeat = zonaActual.features.find(f => f.properties?.tipo === 'zona')
        const manzFeats = zonaActual.features.filter(f => f.properties?.tipo === 'manzana')
        if (zonaFeat) {
          const gl = L.geoJSON(zonaFeat, {
            style: { color: '#0369a1', fillColor: '#0369a1', fillOpacity: 0.06, weight: 2, dashArray: '8,5' }
          }).addTo(map)
          zonaRef.current = gl.getLayers()[0]
          map.fitBounds(gl.getBounds(), { padding: [30, 30] })
        }
        if (manzFeats.length > 0) {
          const selIds = new Set(manzFeats.filter(f => f.properties?.seleccionada).map(f => f.properties?.gid || f.id))
          renderManzanas(L, map, manzFeats, selIds)
          setNTotal(manzFeats.length)
          setNSel(selIds.size)
        }
      }

      map.on('pm:create', async (e) => {
        if (!mounted) return
        if (zonaRef.current) map.removeLayer(zonaRef.current)
        limpiarManzanas(map)
        setError('')
        e.layer.setStyle({ color: '#0369a1', fillColor: '#0369a1', fillOpacity: 0.06, weight: 2, dashArray: '8,5' })
        zonaRef.current = e.layer
        setModo('idle')
        await fetchManzanas(L, map, e.layer)
      })
      map.on('pm:drawend',      () => { if (mounted) setModo('idle') })
      map.on('pm:actioncancel', () => { if (mounted) setModo('idle') })

      mapInst.current = map
      setListo(true)
      setTimeout(() => map.invalidateSize(), 100)
    }
    setup()
    return () => {
      mounted = false
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
      zonaRef.current = null; manzLayersRef.current = []
    }
  }, [])

  function renderManzanas(L, map, features, selIds) {
    limpiarManzanas(map)
    selRef.current = new Set(selIds)
    features.forEach(feature => {
      const id = feature.properties?.gid || feature.id
      const sel = selRef.current.has(id)
      const layer = L.geoJSON(feature, { style: sel ? ESTILO_SEL : ESTILO_NO_SEL }).addTo(map)
      layer.on('click', () => {
        if (selRef.current.has(id)) { selRef.current.delete(id); layer.setStyle(ESTILO_NO_SEL) }
        else                        { selRef.current.add(id);    layer.setStyle(ESTILO_SEL)    }
        setNSel(selRef.current.size)
        emitir(zonaRef.current, manzLayersRef.current.map(x => x.feature), [])
      })
      layer.on('mouseover', () => { if (!selRef.current.has(id)) layer.setStyle(ESTILO_HOVER) })
      layer.on('mouseout',  () => { if (!selRef.current.has(id)) layer.setStyle(ESTILO_NO_SEL) })
      manzLayersRef.current.push({ id, layer, feature })
    })
    setNSel(selRef.current.size)
  }

  async function fetchManzanas(L, map, zonaLayer) {
    setLoading(true); setError('')
    try {
      const bounds = zonaLayer.getBounds()
      const pad = 0.002
      const bbox = {
        west:  bounds.getWest()  - pad, south: bounds.getSouth() - pad,
        east:  bounds.getEast()  + pad, north: bounds.getNorth() + pad,
      }
      const { data, error: err } = await supabase.functions.invoke('catastro-proxy', {
        method: 'POST',
        body: { bbox, typeName: 'mapa:manzanas', maxFeatures: 5000 },
      })
      if (err) throw new Error(err.message)

      const zonaPoligono = zonaLayer.toGeoJSON()
      const enZona = (data.features || []).filter(f => {
        try { return turf.booleanIntersects(f, zonaPoligono) } catch { return false }
      })
      if (!enZona.length) { setError('No se encontraron manzanas en la zona dibujada'); setLoading(false); return }

      // Fetch parcelas en background (silencioso, para guardar)
      const parcelasPromise = fetchParcelasSilencioso(bbox)

      renderManzanas(L, map, enZona, new Set())
      setNTotal(enZona.length)

      const parcelas = await parcelasPromise
      emitir(zonaLayer, enZona, parcelas)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function fetchParcelasSilencioso(bbox) {
    try {
      const { data } = await supabase.functions.invoke('catastro-proxy', {
        method: 'POST',
        body: { bbox, typeName: 'mapa:parcelas', maxFeatures: 5000 },
      })
      return data?.features || []
    } catch { return [] }
  }

  function seleccionarTodas() {
    manzLayersRef.current.forEach(({ id, layer }) => { selRef.current.add(id); layer.setStyle(ESTILO_SEL) })
    setNSel(manzLayersRef.current.length)
    emitir(zonaRef.current, manzLayersRef.current.map(x => x.feature), [])
  }
  function deseleccionarTodas() {
    manzLayersRef.current.forEach(({ id, layer }) => { selRef.current.delete(id); layer.setStyle(ESTILO_NO_SEL) })
    setNSel(0)
    emitir(zonaRef.current, manzLayersRef.current.map(x => x.feature), [])
  }

  function activarDibujar() {
    if (!mapInst.current) return
    if (modo === 'dibujando') { mapInst.current.pm.disableDraw('Polygon'); setModo('idle'); return }
    mapInst.current.pm.enableDraw('Polygon', { allowSelfIntersection: false })
    setModo('dibujando'); setError('')
  }

  const tieneZona = !!zonaRef.current
  const btn = (active, color = 'var(--accent)') => ({
    padding: '6px 13px', borderRadius: 'var(--r)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600,
    border: `1.5px solid ${active ? color : 'var(--border2)'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : 'var(--ink)',
    display: 'flex', alignItems: 'center', gap: 4,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--border2)' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={activarDibujar} disabled={loading} style={btn(modo === 'dibujando')}>
          🖊️ {modo === 'dibujando' ? 'Dibujando...' : tieneZona ? 'Redibujar zona' : 'Dibujar zona'}
        </button>
        {nTotal > 0 && (
          <>
            <button onClick={seleccionarTodas} disabled={loading} style={btn(false)}>Todas</button>
            <button onClick={deseleccionarTodas} disabled={loading} style={{ ...btn(false), color: 'var(--ink3)' }}>Ninguna</button>
            <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{nSel} / {nTotal} manzanas</span>
          </>
        )}
        {loading && <span style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>⏳ Cargando...</span>}
      </div>

      {modo === 'dibujando' && (
        <div style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
          🖊️ Clic para agregar puntos · Doble clic para cerrar · Las manzanas se cargan automáticamente
        </div>
      )}

      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative' }}>
        {(!listo || loading) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(242,241,238,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {loading && <span style={{ fontSize: 12, color: 'var(--ink3)' }}>Cargando manzanas...</span>}
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 12px', background: '#fff', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)', flexShrink: 0, minHeight: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
        {nTotal > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#1a472a', borderRadius: 2 }} /> Seleccionada</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, background: '#94a3b8', borderRadius: 2 }} /> Clic para seleccionar</div>
          </>
        )}
        {!tieneZona && !nTotal && <span>Dibujá el área — las manzanas se cargan solas</span>}
        {error && <span style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: 'auto' }}>⚠ {error}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// PANEL CONFIGURACIÓN MUESTREO
// ════════════════════════════════════════════════
function PanelConfig({ config, onChange }) {
  const [nuevaRazon, setNuevaRazon] = useState('')
  const razones = config.razon_no_respuesta_extra || []
  const k = config.intervalo_salto || 2
  const up = (key, val) => onChange({ ...config, [key]: val })
  const sec = { background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }
  const lbl = { fontSize: 13, fontWeight: 700, color: 'var(--ink)' }

  function agregarRazon() {
    const r = nuevaRazon.trim()
    if (!r || razones.includes(r)) return
    up('razon_no_respuesta_extra', [...razones, r])
    setNuevaRazon('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 2 }}>
      <div style={sec}>
        <div style={lbl}>Intervalo de salto (k = {k})</div>
        <input type="range" min={1} max={10} value={k} onChange={e => up('intervalo_salto', parseInt(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: Math.min(k + 3, 8) }, (_, i) => {
            const enc = i === 0 || i === k + 1
            return <div key={i} style={{ width: 26, height: 26, borderRadius: 4, border: `2px solid ${enc ? 'var(--accent)' : 'var(--border2)'}`, background: enc ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: enc ? '#fff' : 'var(--ink3)' }}>{enc ? '✔' : i + 1}</div>
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={sec}>
          <div style={lbl}>Cuota / manzana</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={50} value={config.cuota_por_manzana || 10} onChange={e => up('cuota_por_manzana', parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: 'var(--accent)', minWidth: 28, textAlign: 'center' }}>{config.cuota_por_manzana || 10}</span>
          </div>
        </div>
        <div style={sec}>
          <div style={lbl}>Máx. intentos</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => up('max_intentos', n)} style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--r)', border: `2px solid ${config.max_intentos === n ? 'var(--accent)' : 'var(--border2)'}`, background: config.max_intentos === n ? 'var(--accent-light)' : '#fff', color: config.max_intentos === n ? 'var(--accent)' : 'var(--ink3)', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={sec}>
        <div style={lbl}>Tipo de reemplazo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ key: 'inmediato', icon: '→', label: 'Inmediato', desc: 'Ir a la siguiente puerta' }, { key: 'salto', icon: '⇒', label: 'Por salto', desc: `Aplicar intervalo k=${k}` }].map(op => (
            <div key={op.key} onClick={() => up('tipo_reemplazo', op.key)} style={{ padding: '10px 12px', border: `2px solid ${config.tipo_reemplazo === op.key ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--r)', background: config.tipo_reemplazo === op.key ? 'var(--accent-light)' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: config.tipo_reemplazo === op.key ? 'var(--accent)' : 'var(--ink)' }}>{op.icon} {op.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>{op.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={sec}>
        <div style={lbl}>Razones de no-respuesta</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {RAZONES_SISTEMA.map(r => <span key={r.key} style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, background: 'var(--surface)', color: 'var(--ink2)', border: '1px solid var(--border)' }}>{r.label}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={nuevaRazon} onChange={e => setNuevaRazon(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarRazon()} placeholder="Agregar razón personalizada..." style={{ flex: 1, padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
          <button onClick={agregarRazon} style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>+</button>
        </div>
        {razones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {razones.map(r => <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)' }}>{r}<button onClick={() => up('razon_no_respuesta_extra', razones.filter(x => x !== r))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button></span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════
export default function MuestreoConfig({ encuestaId, encuesta, onClose, onSaved }) {
  const [config,      setConfig]      = useState(CONFIG_DEFAULT)
  const [zonaGeoJSON, setZonaGeoJSON] = useState(encuesta?.area_geojson || null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error: err } = await supabase
          .from('encuestas')
          .select('config_muestreo, area_geojson')
          .eq('id', encuestaId)
          .single()
        if (err) throw err
        if (data?.config_muestreo) setConfig(prev => ({ ...prev, ...data.config_muestreo }))
        if (data?.area_geojson)    setZonaGeoJSON(data.area_geojson)
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [encuestaId])

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase
        .from('encuestas')
        .update({
          config_muestreo:   config,
          area_geojson:      zonaGeoJSON,
          geofencing_activo: !!zonaGeoJSON,
        })
        .eq('id', encuestaId)
      if (err) throw err
      onSaved()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  function handleCambioMapa({ zonaGeoJSON: nuevaZona }) {
    setZonaGeoJSON(nuevaZona)
  }

  const tieneZona = !!(zonaGeoJSON?.features?.find(f => f.properties?.tipo === 'zona'))
  const nManzSel  = zonaGeoJSON?.features?.filter(f => f.properties?.tipo === 'manzana' && f.properties?.seleccionada).length || 0

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Barra de estado */}
      <div style={{ padding: '8px 22px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: tieneZona ? '#22c55e' : '#f59e0b' }} />
          <span style={{ color: tieneZona ? 'var(--accent2)' : '#b45309', fontWeight: 600 }}>
            {tieneZona
              ? `Zona definida${nManzSel > 0 ? ` · ${nManzSel} manzanas seleccionadas` : ' · seleccioná manzanas'}`
              : 'Sin zona — dibujá el área en el mapa'}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {error && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>⚠ {error}</span>}
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !tieneZona}
            style={{ padding: '6px 18px', background: (!tieneZona || saving) ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: (!tieneZona || saving) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', opacity: (!tieneZona || saving) ? .6 : 1 }}>
            {saving ? 'Guardando...' : '✅ Guardar'}
          </button>
        </div>
      </div>

      {/* Layout 2 columnas */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 0 }}>
        <div style={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Zona + manzanas</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <MapaZona zonaActual={zonaGeoJSON} onCambio={handleCambioMapa} />
          </div>
        </div>
        <div style={{ padding: '16px 16px 16px 0', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Configuración de muestreo</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PanelConfig config={config} onChange={setConfig} />
          </div>
        </div>
      </div>
    </div>
  )
}