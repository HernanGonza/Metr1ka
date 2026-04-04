import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'
import { puntoInicioAleatorio } from './MapaManzanas'

// ── Razones fijas del sistema ──
const RAZONES_SISTEMA = [
  { key: 'no_hay_nadie',     label: 'No hay nadie en casa'        },
  { key: 'no_quiere',        label: 'No quiere participar'        },
  { key: 'no_cumple_perfil', label: 'No cumple el perfil buscado' },
  { key: 'barrera_idioma',   label: 'Barrera de idioma'           },
  { key: 'enfermedad',       label: 'Motivo de salud'             },
]

const CONFIG_DEFAULT = {
  intervalo_salto:          2,
  tipo_reemplazo:           'inmediato',
  max_intentos:             2,
  sentido_recorrido:        'horario',
  cuota_por_manzana:        10,
  razon_no_respuesta_extra: [],
}

// ── Lazy load Leaflet + Geoman ──
async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

// ── Fetch desde Catastro via proxy ──
async function fetchCatastro(bounds, typeName) {
  const { south, west, north, east } = bounds
  const { data, error } = await supabase.functions.invoke('catastro-proxy', {
    method: 'POST',
    body: { bbox: { south, west, north, east }, typeName },
  })
  if (error) throw new Error(error.message || `Error al cargar ${typeName}`)
  if (!data?.features) throw new Error(`Respuesta inválida para ${typeName}`)
  return data.features || []
}

// ── Fetch manzanas desde Catastro ──
async function fetchManzanasCatastro(bounds) {
  const features = await fetchCatastro(bounds, 'mapa:manzanas')
  if (!features.length) throw new Error('No se encontraron manzanas en esta zona')
  // Verificar que realmente son manzanas (no parcelas)
  // Las manzanas tienen propiedad 'etiqueta' con 'Mz.' o similar
  // Si el proxy devuelve parcelas por error, las manzanas son mucho más grandes
  console.log('[catastro] Primer feature recibido:', JSON.stringify(features[0]?.properties))
  return features
}

// ── Fetch parcelas desde Catastro (silencioso, solo para guardar) ──
async function fetchParcelasCatastro(bounds) {
  try {
    return await fetchCatastro(bounds, 'mapa:parcela_urbana')
  } catch { return [] }
}

// ── Filtrar con Turf si disponible, o por centroide ──
// ── Extraer anillo exterior independientemente del tipo de geometría ──
// Catastro Misiones devuelve MultiPolygon con estructura:
//   coordinates[poligono][anillo][punto] = [lng, lat]
// Polygon estándar: coordinates[anillo][punto]
function getExteriorRing(geom) {
  if (!geom) return null
  const g = geom.geometry || geom  // acepta Feature o Geometry
  if (g.type === 'Polygon')      return g.coordinates?.[0] || null
  if (g.type === 'MultiPolygon') return g.coordinates?.[0]?.[0] || null
  return null
}

// Centroide del primer anillo exterior
function getCentroid(f) {
  const ring = getExteriorRing(f)
  if (!ring?.length) return null
  const pts = ring.filter(c => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
  if (pts.length < 3) return null
  return [
    pts.reduce((s, c) => s + c[0], 0) / pts.length,
    pts.reduce((s, c) => s + c[1], 0) / pts.length,
  ]
}

// Ray casting: ¿está [px, py] dentro del ring?
function pointInRing(px, py, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function filtrarDentroDeZona(features, zonaGeoJSON) {
  // zonaGeoJSON es lo que devuelve Geoman .toGeoJSON() — Feature con Polygon
  // Si es FeatureCollection tomar el primero
  const zonaFeat = zonaGeoJSON?.type === 'FeatureCollection'
    ? zonaGeoJSON.features?.[0]
    : zonaGeoJSON
  const zonaRing = getExteriorRing(zonaFeat)

  if (!zonaRing || zonaRing.length < 3) {
    // Sin anillo válido: devolver todas (bbox ya limitó el área)
    console.warn('[filtrar] Sin anillo de zona válido, devolviendo todas')
    return features
  }

  return features.filter(f => {
    try {
      const c = getCentroid(f)
      if (!c) return false
      return pointInRing(c[0], c[1], zonaRing)
    } catch { return false }
  })
}

// ════════════════════════════════════════════════
// MAPA EMBEBIDO (zona + manzanas, sin modal)
// ════════════════════════════════════════════════
function MapaZona({ encuestaId, zonaActual, manzanasSeleccionadas, onZonaChange, onManzanasChange, soloZona = false }) {
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const Lref      = useRef(null)
  const zonaRef   = useRef(null)
  const manzGrpRef = useRef(null)
  const selRef    = useRef(new Set(manzanasSeleccionadas?.map(f => f.properties?.gid || f.id) || []))

  const [listo,    setListo]    = useState(false)
  const [modo,     setModo]     = useState('idle')
  const [loading,  setLoading]  = useState(false)
  const [errorMap, setErrorMap] = useState('')
  const [nManz,    setNManz]    = useState(0)
  const [nSel,     setNSel]     = useState(selRef.current.size)

  // Init map
  useEffect(() => {
    let mounted = true
    async function setup() {
      if (!mapRef.current || mapInst.current) return
      const L = await initMapLibs()
      if (!mounted) return
      Lref.current = L

      const map = L.map(mapRef.current, { center: [-27.3671, -55.8974], zoom: 13, preferCanvas: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      map.pm.setLang('es')
      map.pm.setGlobalOptions({ snappable: true, allowSelfIntersection: false,
        pathOptions: { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.1, weight: 2 } })
      map.pm.removeControls({
        drawMarker: true, drawCircle: true, drawRectangle: true, drawPolyline: true,
        drawCircleMarker: true, cutPolygon: true, editMode: true, dragMode: true,
        removalMode: true, rotateMode: true,
      })

      // Cargar zona + manzanas guardadas
      if (zonaActual?.features) {
        const zonaFeat = zonaActual.features.find(f => f.properties?.tipo === 'zona')
        const manzFeat = zonaActual.features.filter(f => f.properties?.tipo === 'manzana')
        if (zonaFeat) {
          const zl = L.geoJSON(zonaFeat, {
            style: { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.08, weight: 2, dashArray: '8,5' }
          }).addTo(map)
          zonaRef.current = zl.getLayers()[0]
          map.fitBounds(zl.getBounds(), { padding: [30, 30] })
        }
        if (manzFeat.length > 0) {
          const ids = new Set(manzFeat.map(f => f.properties?.gid || f.id))
          selRef.current = ids
          setNSel(ids.size)
          renderManzanas(L, map, manzFeat, ids)
          setNManz(manzFeat.length)
        }
      }

      map.on('pm:create', async (e) => {
        if (!mounted) return
        if (zonaRef.current && map.hasLayer(zonaRef.current)) map.removeLayer(zonaRef.current)
        if (manzGrpRef.current) { map.removeLayer(manzGrpRef.current); manzGrpRef.current = null }
        e.layer.setStyle({ color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.08, weight: 2, dashArray: '8,5' })
        zonaRef.current = e.layer
        selRef.current = new Set(); setNSel(0); setNManz(0)
        setModo('idle')
        // Auto-fetch manzanas al cerrar el polígono
        if (!soloZona) {
          await cargarManzanasAuto(L, map, e.layer)
        } else {
          // Callejera: solo zona, sin manzanas
          onZonaChange({ type: 'FeatureCollection', features: [{ ...e.layer.toGeoJSON(), properties: { tipo: 'zona' } }] })
        }
      })
      map.on('pm:drawend',      () => { if (mounted) setModo('idle') })
      map.on('pm:actioncancel', () => { if (mounted) setModo('idle') })

      mapInst.current = map
      setListo(true)
      setTimeout(() => { if (mounted && mapInst.current) mapInst.current.invalidateSize() }, 100)
    }
    setup()
    return () => {
      mounted = false
      if (mapInst.current) { mapInst.current.off(); mapInst.current.remove(); mapInst.current = null }
      zonaRef.current = null; manzGrpRef.current = null
    }
  }, [])

  function renderManzanas(L, map, features, selSet) {
    if (manzGrpRef.current) { map.removeLayer(manzGrpRef.current); manzGrpRef.current = null }
    const grp = L.geoJSON(features, {
      renderer: L.canvas(),
      style: f => estiloManzana(selSet.has(f.properties?.gid || f.id)),
      onEachFeature: (feature, layer) => {
        const id = feature.properties?.gid || feature.id
        layer.on('click', () => {
          const next = new Set(selRef.current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          selRef.current = next
          setNSel(next.size)
          grp.eachLayer(l => {
            const lid = l.feature?.properties?.gid || l.feature?.id
            if (lid !== undefined) l.setStyle(estiloManzana(next.has(lid)))
          })
          emitirCambio(features, next)
        })
        layer.on('mouseover', () => { if (!selRef.current.has(id)) layer.setStyle({ ...estiloManzana(false), fillOpacity: 0.35 }) })
        layer.on('mouseout',  () => { layer.setStyle(estiloManzana(selRef.current.has(id))) })
      },
    }).addTo(map)
    manzGrpRef.current = grp
  }

  async function cargarManzanasAuto(L, map, zonaLayer) {
    setLoading(true); setErrorMap('')
    try {
      const bounds = zonaLayer.getBounds()
      // Expandir bbox 15% para capturar manzanas del borde de la zona
      const latPad = (bounds.getNorth() - bounds.getSouth()) * 0.15
      const lngPad = (bounds.getEast()  - bounds.getWest())  * 0.15
      const bbox = {
        south: bounds.getSouth() - latPad,
        west:  bounds.getWest()  - lngPad,
        north: bounds.getNorth() + latPad,
        east:  bounds.getEast()  + lngPad,
      }
      const zonaGeoJSON = zonaLayer.toGeoJSON()
      console.log('[MuestreoConfig] bbox para catastro:', bbox)

      // Fetch manzanas y parcelas en paralelo
      const [todasManzanas, parcelas] = await Promise.all([
        fetchManzanasCatastro(bbox),
        fetchParcelasCatastro(bbox),
      ])

      console.log('[MuestreoConfig] Manzanas del catastro:', todasManzanas.length)
      const manzanas = filtrarDentroDeZona(todasManzanas, zonaGeoJSON)
      console.log('[MuestreoConfig] Manzanas dentro de zona:', manzanas.length)
      if (!manzanas.length) { setErrorMap(`No se encontraron manzanas en la zona dibujada (el catastro devolvió ${todasManzanas.length})`); setLoading(false); return }

      selRef.current = new Set(); setNSel(0)
      setNManz(manzanas.length)
      renderManzanas(L, map, manzanas, new Set())

      // Emitir zona + manzanas vacías + parcelas (guardadas en background)
      emitirCambioCompleto(zonaGeoJSON, manzanas, new Set(), parcelas)
    } catch (err) {
      setErrorMap(err.message)
    }
    setLoading(false)
  }

  function emitirCambio(manzanasFeatures, sel) {
    const zonaFeat = zonaRef.current?.toGeoJSON?.()
    emitirCambioCompleto(zonaFeat, manzanasFeatures, sel, [])
  }

  function emitirCambioCompleto(zonaFeat, manzanas, sel, parcelas) {
    const features = []
    if (zonaFeat) features.push({ ...zonaFeat, properties: { ...zonaFeat.properties, tipo: 'zona' } })
    manzanas.forEach(f => {
      features.push({ ...f, properties: { ...f.properties, tipo: 'manzana', seleccionada: sel.has(f.properties?.gid || f.id) } })
    })
    parcelas.forEach(f => {
      features.push({ ...f, properties: { ...f.properties, tipo: 'parcela' } })
    })
    const geojson = { type: 'FeatureCollection', features }
    onZonaChange(geojson)
    onManzanasChange(manzanas.filter(f => sel.has(f.properties?.gid || f.id)))
  }

  function estiloManzana(sel) {
    return sel
      ? { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.45, weight: 2.5 }
      : { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.15, weight: 1.5 }
  }

  function activarDibujar() {
    if (!mapInst.current) return
    if (modo === 'dibujando') { mapInst.current.pm.disableDraw('Polygon'); setModo('idle'); return }
    if (modo === 'editando') cancelarEdicion()
    mapInst.current.pm.enableDraw('Polygon', { allowSelfIntersection: false, snappable: true })
    setModo('dibujando'); setErrorMap('')
  }

  function activarEditar() {
    if (!mapInst.current || !zonaRef.current) return
    if (modo === 'editando') { cancelarEdicion(); return }
    if (modo === 'dibujando') mapInst.current.pm.disableDraw('Polygon')
    // Enable drag on zona layer
    if (zonaRef.current.pm?.enable) {
      zonaRef.current.pm.enable({ allowSelfIntersection: false })
    } else if (zonaRef.current.eachLayer) {
      zonaRef.current.eachLayer(l => l.pm?.enable?.({ allowSelfIntersection: false }))
    }
    setModo('editando'); setErrorMap('')
  }

  function cancelarEdicion() {
    if (!mapInst.current) return
    if (zonaRef.current?.pm?.disable) zonaRef.current.pm.disable()
    else if (zonaRef.current?.eachLayer) zonaRef.current.eachLayer(l => l.pm?.disable?.())
    mapInst.current.pm.disableDraw('Polygon')
    setModo('idle')
  }

  async function recargarManzanas() {
    if (!zonaRef.current || !mapInst.current) return
    await cargarManzanasAuto(Lref.current, mapInst.current, zonaRef.current)
  }

  const tieneZona   = !!zonaRef.current || !!zonaActual?.features?.find(f => f.properties?.tipo === 'zona')
  const tipoEnc     = encuesta?.tipo_encuesta || 'domiciliaria'
  const esCallejera   = tipoEnc === 'callejera'
  const esTelefonica  = tipoEnc === 'telefonica' || tipoEnc === 'online'

  const btnT = (active) => ({
    padding: '6px 13px', borderRadius: 'var(--r)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    background: active ? 'var(--accent)' : '#fff',
    color: active ? '#fff' : 'var(--ink)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--border2)' }}>
      {/* Toolbar del mapa */}
      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={activarDibujar} style={btnT(modo === 'dibujando')}>
          🖊️ {modo === 'dibujando' ? 'Dibujando...' : tieneZona ? 'Redibujar zona' : 'Dibujar zona'}
        </button>
        {tieneZona && modo === 'idle' && (
          <button onClick={activarEditar} style={btnT(false)}>✏️ Editar vértices</button>
        )}
        {modo === 'editando' && (
          <>
            <button onClick={recargarManzanas} disabled={loading} style={{ ...btnT(false), background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
              {loading ? '⏳' : '🔄'} Actualizar manzanas
            </button>
            <button onClick={cancelarEdicion} style={{ ...btnT(false), color: 'var(--ink3)' }}>ESC</button>
          </>
        )}
        {nManz > 0 && (
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>
            {nSel} / {nManz} manzanas seleccionadas
          </span>
        )}
      </div>

      {/* Modo activo banner */}
      {modo !== 'idle' && (
        <div style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
          {modo === 'dibujando' && '🖊️ Clic para agregar puntos · Doble clic para cerrar · Las manzanas se cargan automáticamente'}
          {modo === 'editando'  && '🔧 Arrastrá los puntos azules · Al terminar cliqueá "Actualizar manzanas"'}
        </div>
      )}

      {/* Mapa */}
      <div style={{ flex: 1, position: 'relative' }}>
        {(!listo || loading) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(242,241,238,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Spinner center size="lg" />
            {loading && <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>Cargando manzanas...</span>}
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Leyenda + error */}
      <div style={{ padding: '6px 12px', background: '#fff', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minHeight: 32 }}>
        {nManz > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink3)' }}>
              <div style={{ width: 10, height: 10, background: '#1a472a', borderRadius: 2 }} /> Seleccionada
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink3)' }}>
              <div style={{ width: 10, height: 10, background: '#94a3b8', borderRadius: 2 }} /> Sin seleccionar (clic)
            </div>
          </>
        )}
        {!tieneZona && !nManz && <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Dibujá el área para cargar las manzanas automáticamente</span>}
        {errorMap && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500, marginLeft: 'auto' }}>⚠ {errorMap}</span>}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// PANEL DE CONFIGURACIÓN (derecha)
// ════════════════════════════════════════════════
function PanelConfig({ config, onChange }) {
  const [nuevaRazon, setNuevaRazon] = useState('')
  const razones = config.razon_no_respuesta_extra || []
  const k = config.intervalo_salto || 2

  function update(key, val) { onChange({ ...config, [key]: val }) }

  function agregarRazon() {
    const r = nuevaRazon.trim()
    if (!r || razones.includes(r)) return
    update('razon_no_respuesta_extra', [...razones, r])
    setNuevaRazon('')
  }

  const secStyle = { background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }
  const labelStyle = { fontSize: 13, fontWeight: 700, color: 'var(--ink)' }
  const descStyle  = { fontSize: 11, color: 'var(--ink3)', marginTop: -6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 2 }}>

      {/* Intervalo de salto */}
      <div style={secStyle}>
        <div style={labelStyle}>Intervalo de salto (k = {k})</div>
        <div style={descStyle}>Casas a saltar entre encuestas.</div>
        <input type="range" min={1} max={10} value={k}
          onChange={e => update('intervalo_salto', parseInt(e.target.value))}
          style={{ accentColor: 'var(--accent)' }} />
        {/* Ejemplo visual compacto */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: Math.min(k + 3, 8) }, (_, i) => {
            const enc = i === 0 || i === k + 1
            return (
              <div key={i} style={{ width: 26, height: 26, borderRadius: 4, border: `2px solid ${enc ? 'var(--accent)' : 'var(--border2)'}`, background: enc ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: enc ? '#fff' : 'var(--ink3)' }}>
                {enc ? '✔' : i + 1}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cuota + Max intentos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={secStyle}>
          <div style={labelStyle}>Cuota / manzana</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={50} value={config.cuota_por_manzana || 10}
              onChange={e => update('cuota_por_manzana', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: 'var(--accent)', minWidth: 28, textAlign: 'center' }}>
              {config.cuota_por_manzana || 10}
            </span>
          </div>
        </div>
        <div style={secStyle}>
          <div style={labelStyle}>Máx. intentos</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => update('max_intentos', n)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--r)', border: `2px solid ${config.max_intentos === n ? 'var(--accent)' : 'var(--border2)'}`, background: config.max_intentos === n ? 'var(--accent-light)' : '#fff', color: config.max_intentos === n ? 'var(--accent)' : 'var(--ink3)', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, cursor: 'pointer', transition: 'all .15s' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tipo de reemplazo */}
      <div style={secStyle}>
        <div style={labelStyle}>Tipo de reemplazo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { key: 'inmediato', icon: '→', label: 'Inmediato', desc: 'Ir a la siguiente puerta' },
            { key: 'salto',     icon: '⇒', label: 'Por salto',  desc: `Aplicar intervalo k=${k}` },
          ].map(op => (
            <div key={op.key} onClick={() => update('tipo_reemplazo', op.key)}
              style={{ padding: '10px 12px', border: `2px solid ${config.tipo_reemplazo === op.key ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--r)', background: config.tipo_reemplazo === op.key ? 'var(--accent-light)' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: config.tipo_reemplazo === op.key ? 'var(--accent)' : 'var(--ink)' }}>{op.icon} {op.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 3 }}>{op.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Razones de no-respuesta */}
      <div style={secStyle}>
        <div style={labelStyle}>Razones de no-respuesta</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {RAZONES_SISTEMA.map(r => (
            <span key={r.key} style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, background: 'var(--surface)', color: 'var(--ink2)', border: '1px solid var(--border)' }}>{r.label}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={nuevaRazon} onChange={e => setNuevaRazon(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregarRazon()}
            placeholder="Agregar razón personalizada..."
            style={{ flex: 1, padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
          <button onClick={agregarRazon}
            style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            +
          </button>
        </div>
        {razones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {razones.map(r => (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'var(--accent-light)', color: 'var(--accent2)', border: '1.5px solid var(--accent2)' }}>
                {r}
                <button onClick={() => update('razon_no_respuesta_extra', razones.filter(x => x !== r))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// Recibe: encuestaId, encuesta, onClose, onSaved
// Ya no recibe equipo ni encuestaEquipoId
// ════════════════════════════════════════════════
export default function MuestreoConfig({ encuestaId, encuesta, onClose, onSaved }) {
  const [config,       setConfig]       = useState(CONFIG_DEFAULT)
  const [zonaGeoJSON,  setZonaGeoJSON]  = useState(encuesta?.area_geojson || null)
  const [manzanasSel,  setManzanasSel]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // Cargar config existente
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('encuestas')
          .select('config_muestreo, area_geojson')
          .eq('id', encuestaId)
          .single()
        if (data?.config_muestreo) setConfig(prev => ({ ...prev, ...data.config_muestreo }))
        if (data?.area_geojson)    setZonaGeoJSON(data.area_geojson)
      } catch {}
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
          config_muestreo: config,
          area_geojson: zonaGeoJSON,
          geofencing_activo: !!zonaGeoJSON,
        })
        .eq('id', encuestaId)
      if (err) throw err
      onSaved()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const tieneZona     = !!(zonaGeoJSON?.features?.find(f => f.properties?.tipo === 'zona'))
  const nManzSel      = manzanasSel.length
  const nManzTotal    = zonaGeoJSON?.features?.filter(f => f.properties?.tipo === 'manzana').length || 0

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner center size="lg" />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Barra de estado */}
      <div style={{ padding: '8px 22px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: tieneZona ? '#22c55e' : '#f59e0b' }} />
          <span style={{ color: tieneZona ? 'var(--accent2)' : '#b45309', fontWeight: 600 }}>
            {tieneZona ? 'Zona definida' : 'Sin zona'}
          </span>
        </div>
        {tieneZona && (
          <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
            {nManzSel > 0 ? `${nManzSel} manzanas seleccionadas` : nManzTotal > 0 ? `${nManzTotal} manzanas disponibles` : 'Manzanas cargadas'}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {error && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>⚠ {error}</span>}
          <button onClick={onClose} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || (!tieneZona && !esTelefonica)}
            style={{ padding: '6px 18px', background: (!tieneZona || saving) ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: (!tieneZona || saving) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', opacity: (!tieneZona || saving) ? .6 : 1 }}>
            {saving ? 'Guardando...' : '✅ Guardar'}
          </button>
        </div>
      </div>

      {/* Layout 2 columnas: mapa izquierda, config derecha */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 0, gap: 0 }}>

        {/* MAPA */}
        <div style={{ padding: 16, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {esTelefonica ? 'Sin área geográfica' : esCallejera ? 'Zona de operación' : 'Zona de encuesta + manzanas'}
          </div>
          {esTelefonica ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 'var(--r2)', border: '1px dashed var(--border2)' }}>
              <div style={{ textAlign: 'center', color: 'var(--ink3)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📞</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Encuesta telefónica</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>No requiere zona geográfica ni manzanas.</div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0 }}>
              <MapaZona
                encuestaId={encuestaId}
                zonaActual={zonaGeoJSON}
                manzanasSeleccionadas={manzanasSel}
                onZonaChange={setZonaGeoJSON}
                onManzanasChange={setManzanasSel}
                soloZona={esCallejera}
              />
            </div>
          )}
        </div>

        {/* CONFIG */}
        <div style={{ padding: '16px 16px 16px 0', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Configuración de muestreo
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <PanelConfig config={config} onChange={setConfig} />
          </div>
        </div>

      </div>
    </div>
  )
}