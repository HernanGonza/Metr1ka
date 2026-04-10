import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'
import { puntoInicioAleatorio } from './MapaManzanas'

const CONFIG_DEFAULT = {
  intervalo_salto:          2,
  tipo_reemplazo:           'inmediato',
  max_intentos:             2,
  sentido_recorrido:        'horario',
  cuota_por_manzana:        10,
  razon_no_respuesta_extra: [],
}

async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  await import('@geoman-io/leaflet-geoman-free')
  await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
  return L
}

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

async function fetchManzanasCatastro(bounds) {
  const features = await fetchCatastro(bounds, 'mapa:manzanas')
  if (!features.length) throw new Error('No se encontraron manzanas en esta zona')
  console.log('[catastro] Primer feature recibido:', JSON.stringify(features[0]?.properties))
  return features
}

async function fetchParcelasCatastro(bounds) {
  try { return await fetchCatastro(bounds, 'mapa:parcela_urbana') }
  catch { return [] }
}

function getExteriorRing(geom) {
  if (!geom) return null
  const g = geom.geometry || geom
  if (g.type === 'Polygon')      return g.coordinates?.[0] || null
  if (g.type === 'MultiPolygon') return g.coordinates?.[0]?.[0] || null
  return null
}

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
  const zonaFeat = zonaGeoJSON?.type === 'FeatureCollection'
    ? zonaGeoJSON.features?.[0]
    : zonaGeoJSON
  const zonaRing = getExteriorRing(zonaFeat)
  if (!zonaRing || zonaRing.length < 3) {
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
// MAPA EMBEBIDO
// ════════════════════════════════════════════════
const MapaZona = forwardRef(function MapaZona(
  { encuestaId, zonaActual, manzanasSeleccionadas, onZonaChange, onManzanasChange },
  ref
) {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const Lref       = useRef(null)
  const zonaRef    = useRef(null)
  const manzGrpRef = useRef(null)
  const selRef     = useRef(new Set(manzanasSeleccionadas?.map(f => f.properties?.gid || f.id) || []))

  const [listo,    setListo]    = useState(false)
  const [modo,     setModo]     = useState('idle')
  const [loading,  setLoading]  = useState(false)
  const [errorMap, setErrorMap] = useState('')
  const [nManz,    setNManz]    = useState(0)
  const [nSel,     setNSel]     = useState(selRef.current.size)

  // Exponer getZonaActual al padre via ref
  useImperativeHandle(ref, () => ({
    getZonaActual: () => {
      if (!zonaRef.current) return null
      const zonaFeat = zonaRef.current.toGeoJSON?.()
      if (!zonaFeat) return null
      const manzanas = []
      if (manzGrpRef.current) {
        manzGrpRef.current.eachLayer(l => { if (l.feature) manzanas.push(l.feature) })
      }
      const features = []
      features.push({ ...zonaFeat, properties: { ...zonaFeat.properties, tipo: 'zona' } })
      manzanas.forEach(f => {
        // ID canónico: siempre properties.gid, nunca f.id (puede ser undefined en Leaflet)
        const canonId = f.properties?.gid ?? f.properties?.id
        features.push({
          ...f,
          properties: {
            ...f.properties,
            tipo: 'manzana',
            seleccionada: canonId !== undefined ? selRef.current.has(canonId) : false,
          }
        })
      })
      return { type: 'FeatureCollection', features }
    }
  }))

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
          // Solo las que tienen seleccionada:true en el GeoJSON guardado
          const idsSel = new Set(
            manzFeat
              .filter(f => f.properties?.seleccionada === true)
              .map(f => f.properties?.gid ?? f.properties?.id)
              .filter(id => id !== undefined)
          )
          selRef.current = idsSel
          setNSel(idsSel.size)
          renderManzanas(L, map, manzFeat, idsSel)
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
        await cargarManzanasAuto(L, map, e.layer)
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
      pmIgnore: true,
      style: f => estiloManzana(selSet.has(f.properties?.gid ?? f.properties?.id)),
      onEachFeature: (feature, layer) => {
        const id = feature.properties?.gid ?? feature.properties?.id
        layer.on('click', () => {
          const next = new Set(selRef.current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          selRef.current = next
          setNSel(next.size)
          grp.eachLayer(l => {
            const lid = l.feature?.properties?.gid ?? l.feature?.properties?.id
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
      const latPad = (bounds.getNorth() - bounds.getSouth()) * 0.15
      const lngPad = (bounds.getEast()  - bounds.getWest())  * 0.15
      const bbox = {
        south: bounds.getSouth() - latPad,
        west:  bounds.getWest()  - lngPad,
        north: bounds.getNorth() + latPad,
        east:  bounds.getEast()  + lngPad,
      }
      const zonaGeoJSON = zonaLayer.toGeoJSON()
      const [todasManzanas, parcelas] = await Promise.all([
        fetchManzanasCatastro(bbox),
        fetchParcelasCatastro(bbox),
      ])
      const manzanas = filtrarDentroDeZona(todasManzanas, zonaGeoJSON)
      if (!manzanas.length) { setErrorMap(`No se encontraron manzanas en la zona dibujada (el catastro devolvió ${todasManzanas.length})`); setLoading(false); return }
      selRef.current = new Set(); setNSel(0)
      setNManz(manzanas.length)
      renderManzanas(L, map, manzanas, new Set())
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
      const canonId = f.properties?.gid ?? f.properties?.id
      features.push({ ...f, properties: { ...f.properties, tipo: 'manzana', seleccionada: sel.has(canonId) } })
    })
    parcelas.forEach(f => {
      features.push({ ...f, properties: { ...f.properties, tipo: 'parcela' } })
    })
    const geojson = { type: 'FeatureCollection', features }
    onZonaChange(geojson)
    onManzanasChange(manzanas.filter(f => sel.has(f.properties?.gid ?? f.properties?.id)))
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

  const tieneZona = !!zonaRef.current || !!zonaActual?.features?.find(f => f.properties?.tipo === 'zona')

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

      {modo !== 'idle' && (
        <div style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
          {modo === 'dibujando' && '🖊️ Clic para agregar puntos · Doble clic para cerrar · Las manzanas se cargan automáticamente'}
          {modo === 'editando'  && '🔧 Arrastrá los puntos azules · Al terminar cliqueá "Actualizar manzanas"'}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        {(!listo || loading) && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(242,241,238,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Spinner center size="lg" />
            {loading && <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 500 }}>Cargando manzanas...</span>}
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

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
})

// ════════════════════════════════════════════════
// SELECTOR DE RAZONES
// ════════════════════════════════════════════════
function RazonesSelector({ organizacionId, seleccionadas, onChangeSel }) {
  const [razones,    setRazones]    = useState([])
  const [nuevaRazon, setNuevaRazon] = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!organizacionId) return
    supabase.from('razones_no_respuesta')
      .select('id, label, organizacion_id')
      .or(`organizacion_id.eq.${organizacionId},organizacion_id.is.null`)
      .eq('activa', true)
      .order('orden')
      .then(({ data }) => setRazones(data || []))
  }, [organizacionId])

  function toggle(id) {
    if (seleccionadas.includes(id)) onChangeSel(seleccionadas.filter(x => x !== id))
    else onChangeSel([...seleccionadas, id])
  }

  async function agregarPersonalizada() {
    const label = nuevaRazon.trim()
    if (!label || !organizacionId) return
    setSaving(true)
    const { data } = await supabase.from('razones_no_respuesta').insert({
      organizacion_id: organizacionId, label, orden: razones.length + 1,
    }).select().single()
    if (data) { setRazones(prev => [...prev, data]); onChangeSel([...seleccionadas, data.id]) }
    setNuevaRazon(''); setSaving(false)
  }

  const nSel = seleccionadas.length
  const secStyle = { background: '#fff', border: `1px solid ${nSel < 2 ? '#fca5a5' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }

  return (
    <div style={secStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Razones de no-respuesta</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: nSel < 2 ? '#c0392b' : 'var(--accent2)', background: nSel < 2 ? '#fef2f2' : 'var(--accent-light)', padding: '2px 8px', borderRadius: 100 }}>
          {nSel} seleccionada{nSel !== 1 ? 's' : ''} {nSel < 2 ? '· mín. 2' : '✓'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: -6 }}>
        Seleccioná las que van a aparecer en la app cuando el encuestador registre una no-respuesta.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {razones.map(r => {
          const sel = seleccionadas.includes(r.id)
          const esSistema = r.organizacion_id === null
          return (
            <div key={r.id} onClick={() => toggle(r.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 'var(--r)', cursor: 'pointer',
              border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border2)'}`,
              background: sel ? 'var(--accent-light)' : '#fff', transition: 'all .15s',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${sel ? 'var(--accent)' : 'var(--border2)'}`, background: sel ? 'var(--accent)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {sel && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontSize: 12, color: sel ? 'var(--accent2)' : 'var(--ink2)', fontWeight: sel ? 600 : 400 }}>{r.label}</span>
              {!esSistema && (
                <button onClick={async e => {
                  e.stopPropagation()
                  await supabase.from('razones_no_respuesta').delete().eq('id', r.id)
                  setRazones(prev => prev.filter(x => x.id !== r.id))
                  onChangeSel(seleccionadas.filter(x => x !== r.id))
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={nuevaRazon} onChange={e => setNuevaRazon(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregarPersonalizada()}
          placeholder="Agregar razón personalizada..."
          style={{ flex: 1, padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', outline: 'none' }} />
        <button onClick={agregarPersonalizada} disabled={saving || !nuevaRazon.trim()}
          style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', opacity: !nuevaRazon.trim() ? 0.5 : 1 }}>+</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// PANEL CONFIG
// ════════════════════════════════════════════════
function PanelConfig({ config, onChange, organizacionId }) {
  const k = config.intervalo_salto || 2
  function update(key, val) { onChange({ ...config, [key]: val }) }
  const secStyle   = { background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }
  const labelStyle = { fontSize: 13, fontWeight: 700, color: 'var(--ink)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflowY: 'auto', paddingRight: 2 }}>
      <div style={secStyle}>
        <div style={labelStyle}>Intervalo de salto (k = {k})</div>
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: -6 }}>Casas a saltar entre encuestas.</div>
        <input type="range" min={1} max={10} value={k}
          onChange={e => update('intervalo_salto', parseInt(e.target.value))}
          style={{ accentColor: 'var(--accent)' }} />
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

      <RazonesSelector
        organizacionId={organizacionId}
        seleccionadas={config.razones_seleccionadas || []}
        onChangeSel={ids => update('razones_seleccionadas', ids)}
      />
    </div>
  )
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// MODAL DE MANZANAS POR EQUIPO
// ════════════════════════════════════════════════
export function ManzanasEquipoModal({ encuestasEquipoId, equipoNombre, zonaEncuesta, onClose, onSaved }) {
  const [zonaGeoJSON, setZonaGeoJSON] = useState(zonaEncuesta || null)
  const [manzanasSel, setManzanasSel] = useState([])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const mapaRef = useRef(null)

  // Cargar manzanas ya guardadas para este equipo
  useEffect(() => {
    async function load() {
      if (!encuestasEquipoId) return
      try {
        const { data: manzanas } = await supabase
          .from('manzanas')
          .select('id, area_geojson')
          .eq('encuestas_equipo_id', encuestasEquipoId)
        if (!manzanas?.length) return

        // Reconstruir el GeoJSON de la zona con las manzanas ya guardadas marcadas como seleccionadas
        const featsManzanas = manzanas.map(m => ({
          ...m.area_geojson,
          properties: {
            ...(m.area_geojson?.properties || {}),
            tipo: 'manzana',
            seleccionada: true,
            manzana_db_id: m.id,
          }
        }))

        // Mergear con la zona de la encuesta si existe
        if (zonaEncuesta?.features) {
          const zonaFeat = zonaEncuesta.features.find(f => f.properties?.tipo === 'zona')
          const otrasFeats = zonaEncuesta.features.filter(f => f.properties?.tipo !== 'manzana')
          setZonaGeoJSON({
            type: 'FeatureCollection',
            features: [...otrasFeats, ...featsManzanas],
          })
        }
      } catch {}
    }
    load()
  }, [encuestasEquipoId])

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const zonaActualizada = mapaRef.current?.getZonaActual() || zonaGeoJSON

      const manzSelFeatures = (zonaActualizada?.features || [])
        .filter(f => f.properties?.tipo === 'manzana' && f.properties?.seleccionada === true)

      if (manzSelFeatures.length === 0) {
        setError('Seleccioná al menos una manzana'); setSaving(false); return
      }

      const parcelasAll = (zonaActualizada?.features || [])
        .filter(f => f.properties?.tipo === 'parcela')

      const manzanasPayload = manzSelFeatures.map(f => ({
        gid:          f.properties?.gid ?? f.properties?.id ?? null,
        area_geojson: JSON.stringify(f),
      }))

      const parcelasPayload = parcelasAll.map(f => ({
        gid:          f.properties?.gid ?? f.properties?.id ?? null,
        cca:          f.properties?.cca ?? null,
        direccion:    f.properties?.direccion ?? f.properties?.etiqueta ?? null,
        area_geojson: JSON.stringify(f),
      }))

      const { data: rpcResult, error: e } = await supabase.rpc('guardar_manzanas_y_parcelas', {
        p_encuestas_equipo_id: encuestasEquipoId,
        p_manzanas:            manzanasPayload,
        p_parcelas:            parcelasPayload,
      })
      if (e) throw e
      console.log('[manzanas equipo]', rpcResult)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const nManzSel = (zonaGeoJSON?.features || [])
    .filter(f => f.properties?.tipo === 'manzana' && f.properties?.seleccionada === true).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--r2)', width: '100%', maxWidth: 900, height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700, margin: 0 }}>📍 Manzanas — {equipoNombre}</h3>
            <p style={{ fontSize: 11, color: 'var(--ink3)', margin: '2px 0 0' }}>
              Seleccioná las manzanas que va a cubrir este equipo. Las parcelas se asignan automáticamente.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {error && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>⚠ {error}</span>}
            {nManzSel > 0 && (
              <span style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600, background: 'var(--accent-light)', padding: '3px 10px', borderRadius: 100 }}>
                {nManzSel} manzana{nManzSel !== 1 ? 's' : ''} seleccionada{nManzSel !== 1 ? 's' : ''}
              </span>
            )}
            <button onClick={onClose} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 18px', background: saving ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', opacity: saving ? .6 : 1 }}>
              {saving ? 'Guardando...' : '✅ Guardar manzanas'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink3)', lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Mapa */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MapaZona
            ref={mapaRef}
            encuestaId={null}
            zonaActual={zonaGeoJSON}
            manzanasSeleccionadas={[]}
            onZonaChange={setZonaGeoJSON}
            onManzanasChange={setManzanasSel}
          />
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — solo config global
// ════════════════════════════════════════════════
export default function MuestreoConfig({ encuestaId, encuesta, onClose, onSaved }) {
  const [config,  setConfig]  = useState(CONFIG_DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('encuestas')
          .select('config_muestreo')
          .eq('id', encuestaId)
          .single()
        if (data?.config_muestreo) setConfig(prev => ({ ...prev, ...data.config_muestreo }))
      } catch {}
      setLoading(false)
    }
    load()
  }, [encuestaId])

  async function handleSave() {
    const razonesSeleccionadas = config.razones_seleccionadas || []
    if (razonesSeleccionadas.length < 2) {
      setError('Seleccioná al menos 2 razones de no-respuesta')
      return
    }
    setSaving(true); setError('')
    try {
      const { error: e } = await supabase
        .from('encuestas')
        .update({ config_muestreo: config })
        .eq('id', encuestaId)
      if (e) throw e
      onSaved()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner center size="lg" />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Topbar */}
      <div style={{ padding: '8px 22px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
        {error && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500, marginRight: 'auto' }}>⚠ {error}</span>}
        <button onClick={onClose} style={{ padding: '6px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '6px 18px', background: saving ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', opacity: saving ? .6 : 1 }}>
          {saving ? 'Guardando...' : '✅ Guardar'}
        </button>
      </div>

      {/* Contenido: solo PanelConfig */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        <PanelConfig config={config} onChange={setConfig} organizacionId={encuesta?.organizacion_id} />
      </div>
    </div>
  )
}