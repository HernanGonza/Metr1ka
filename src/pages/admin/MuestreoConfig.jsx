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
  casas_por_lado:           10,  // estimado de casas por lado de manzana para calcular navegación
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
  { encuestaId, zonaActual, manzanasSeleccionadas, onZonaChange, onManzanasChange, sinManzanas = false },
  ref
) {
  const mapRef       = useRef(null)
  const mapInst      = useRef(null)
  const Lref         = useRef(null)
  const zonaRef      = useRef(null)
  const manzGrpRef   = useRef(null)
  const manzFeatRef  = useRef([])       // features del catastro en memoria
  const parcelaRef   = useRef([])       // parcelas del catastro en memoria
  const dragTimerRef = useRef(null)     // debounce post-drag
  const selRef       = useRef(new Set(manzanasSeleccionadas?.map(f => f.properties?.gid || f.id) || []))

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
      // Parcelas no se incluyen — las maneja guardar-parcelas edge function
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
          _activarDragEnZona(zonaRef.current, L, map)
        }
        if (manzFeat.length > 0) {
          const idsSel = new Set(
            manzFeat
              .filter(f => f.properties?.seleccionada === true)
              .map(f => f.properties?.gid ?? f.properties?.id)
              .filter(id => id !== undefined)
          )
          manzFeatRef.current = manzFeat
          selRef.current = idsSel
          setNSel(idsSel.size)
          renderManzanas(L, map, manzFeat, idsSel)
          setNManz(manzFeat.length)

          // Las parcelas se guardan por la edge function guardar-parcelas, no hace falta fetchear aquí
        }
      }

      map.on('pm:create', async (e) => {
        if (!mounted) return
        if (zonaRef.current && map.hasLayer(zonaRef.current)) map.removeLayer(zonaRef.current)
        if (manzGrpRef.current) { map.removeLayer(manzGrpRef.current); manzGrpRef.current = null }
        e.layer.setStyle({ color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.08, weight: 2, dashArray: '8,5' })
        zonaRef.current = e.layer
        selRef.current = new Set(); setNSel(0); setNManz(0)
        manzFeatRef.current = []; parcelaRef.current = []
        _activarDragEnZona(e.layer, L, map)
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
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current)
      if (mapInst.current) { mapInst.current.off(); mapInst.current.remove(); mapInst.current = null }
      zonaRef.current = null; manzGrpRef.current = null
    }
  }, [])

  // Activa drag en la capa zona y recarga manzanas 800ms después de soltar
  function _activarDragEnZona(layer, L, map) {
    if (!layer?.pm) return
    layer.pm.enableLayerDrag()
    layer.on('pm:dragend', () => {
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current)
      dragTimerRef.current = setTimeout(() => {
        cargarManzanasAuto(L || Lref.current, map || mapInst.current, layer)
      }, 800)
    })
  }

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
      // Solo traemos manzanas — las parcelas las guarda la edge function guardar-parcelas
      const todasManzanas = await fetchManzanasCatastro(bbox)
      // Si es encuesta callejera, no cargar manzanas
      if (sinManzanas) { setLoading(false); return }
      const manzanas = filtrarDentroDeZona(todasManzanas, zonaGeoJSON)
      if (!manzanas.length) { setErrorMap(`No se encontraron manzanas en la zona (el catastro devolvió ${todasManzanas.length})`); setLoading(false); return }
      manzFeatRef.current = manzanas
      parcelaRef.current  = []
      selRef.current = new Set(); setNSel(0)
      setNManz(manzanas.length)
      renderManzanas(L, map, manzanas, new Set())
      emitirCambioCompleto(zonaGeoJSON, manzanas, new Set())
    } catch (err) {
      setErrorMap(err.message)
    }
    setLoading(false)
  }

  function emitirCambio(manzanasFeatures, sel) {
    const zonaFeat = zonaRef.current?.toGeoJSON?.()
    emitirCambioCompleto(zonaFeat, manzanasFeatures, sel)
  }

  function emitirCambioCompleto(zonaFeat, manzanas, sel) {
    const features = []
    if (zonaFeat) features.push({ ...zonaFeat, properties: { ...zonaFeat.properties, tipo: 'zona' } })
    manzanas.forEach(f => {
      const canonId = f.properties?.gid ?? f.properties?.id
      features.push({ ...f, properties: { ...f.properties, tipo: 'manzana', seleccionada: sel.has(canonId) } })
    })
    // Las parcelas NO se incluyen en el geojson local — las fetchea y guarda guardar-parcelas edge function
    const geojson = { type: 'FeatureCollection', features }
    onZonaChange(geojson)
    onManzanasChange(manzanas.filter(f => sel.has(f.properties?.gid ?? f.properties?.id)))
  }

  function estiloManzana(sel) {
    return sel
      ? { color: '#1a472a', fillColor: '#1a472a', fillOpacity: 0.45, weight: 2.5 }
      : { color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.15, weight: 1.5 }
  }

  // ── Acciones toolbar ──

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

  function borrarZona() {
    if (!mapInst.current) return
    if (manzGrpRef.current) { mapInst.current.removeLayer(manzGrpRef.current); manzGrpRef.current = null }
    if (zonaRef.current)    { mapInst.current.removeLayer(zonaRef.current);     zonaRef.current = null }
    manzFeatRef.current = []; parcelaRef.current = []
    selRef.current = new Set()
    setNManz(0); setNSel(0); setModo('idle'); setErrorMap('')
    onZonaChange(null)
    onManzanasChange([])
  }

  function seleccionarTodas() {
    if (!manzGrpRef.current || !manzFeatRef.current.length) return
    const todos = new Set(
      manzFeatRef.current.map(f => f.properties?.gid ?? f.properties?.id).filter(Boolean)
    )
    selRef.current = todos
    setNSel(todos.size)
    manzGrpRef.current.eachLayer(l => {
      const lid = l.feature?.properties?.gid ?? l.feature?.properties?.id
      if (lid !== undefined) l.setStyle(estiloManzana(true))
    })
    emitirCambio(manzFeatRef.current, todos)
  }

  function deseleccionarTodas() {
    if (!manzGrpRef.current) return
    selRef.current = new Set()
    setNSel(0)
    manzGrpRef.current.eachLayer(l => {
      const lid = l.feature?.properties?.gid ?? l.feature?.properties?.id
      if (lid !== undefined) l.setStyle(estiloManzana(false))
    })
    emitirCambio(manzFeatRef.current, new Set())
  }

  async function recargarManzanas() {
    if (!zonaRef.current || !mapInst.current) return
    await cargarManzanasAuto(Lref.current, mapInst.current, zonaRef.current)
  }

  const tieneZona  = !!zonaRef.current || !!zonaActual?.features?.find(f => f.properties?.tipo === 'zona')
  const todasSel   = nManz > 0 && nSel === nManz

  const btnT = (active, danger = false) => ({
    padding: '6px 13px', borderRadius: 'var(--r)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
    border: `1.5px solid ${danger ? '#fca5a5' : active ? 'var(--accent)' : 'var(--border2)'}`,
    background: danger ? 'var(--danger-light)' : active ? 'var(--accent)' : 'var(--paper)',
    color: danger ? '#c0392b' : active ? '#fff' : 'var(--ink)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--r2)', overflow: 'hidden', border: '1px solid var(--border2)' }}>

      {/* Toolbar */}
      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>

        {/* Grupo zona */}
        <button onClick={activarDibujar} style={btnT(modo === 'dibujando')}>
          🖊️ {modo === 'dibujando' ? 'Dibujando...' : tieneZona ? 'Redibujar' : 'Dibujar zona'}
        </button>
        {tieneZona && modo === 'idle' && (
          <button onClick={activarEditar} style={btnT(false)}>✏️ Editar</button>
        )}
        {tieneZona && modo === 'idle' && (
          <button onClick={borrarZona} style={btnT(false, true)}>🗑️ Borrar zona</button>
        )}
        {modo === 'editando' && (
          <>
            <button onClick={recargarManzanas} disabled={loading}
              style={{ ...btnT(false), background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>
              {loading ? '⏳' : '🔄'} Recargar manzanas
            </button>
            <button onClick={cancelarEdicion} style={{ ...btnT(false), color: 'var(--ink3)' }}>ESC</button>
          </>
        )}

        {/* Separador */}
        {nManz > 0 && <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 2px' }} />}

        {/* Grupo selección */}
        {nManz > 0 && !todasSel && (
          <button onClick={seleccionarTodas} style={btnT(false)}>☑️ Todas</button>
        )}
        {nManz > 0 && nSel > 0 && (
          <button onClick={deseleccionarTodas} style={btnT(false)}>🔲 Ninguna</button>
        )}
        {nManz > 0 && (
          <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600 }}>
            {nSel}/{nManz}
          </span>
        )}
      </div>

      {/* Banner instrucciones */}
      {modo !== 'idle' && (
        <div style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
          {modo === 'dibujando' && '🖊️ Clic para agregar puntos · Doble clic para cerrar · Las manzanas se cargan automáticamente'}
          {modo === 'editando'  && '🔧 Arrastrá los puntos azules para editar · Arrastrá la zona para moverla (manzanas se actualizan al soltar)'}
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

      {/* Footer leyenda */}
      <div style={{ padding: '6px 12px', background: 'var(--paper)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, minHeight: 32 }}>
        {nManz > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink3)' }}>
              <div style={{ width: 10, height: 10, background: '#1a472a', borderRadius: 2 }} /> Seleccionada
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink3)' }}>
              <div style={{ width: 10, height: 10, background: '#94a3b8', borderRadius: 2 }} /> Sin seleccionar
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink3)', marginLeft: 'auto' }}>
              Arrastrá la zona para moverla · manzanas se actualizan solas
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
            {tieneZona ? 'Dibujá la zona para cargar manzanas' : 'Dibujá el área para cargar las manzanas automáticamente'}
          </span>
        )}
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
  const secStyle = { background: 'var(--paper)', border: `1px solid ${nSel < 2 ? '#fca5a5' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }

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
              background: sel ? 'var(--accent-light)' : 'var(--paper)', transition: 'all .15s',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${sel ? 'var(--accent)' : 'var(--border2)'}`, background: sel ? 'var(--accent)' : 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  const secStyle   = { background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }
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
              <div key={i} style={{ width: 26, height: 26, borderRadius: 4, border: `2px solid ${enc ? 'var(--accent)' : 'var(--border2)'}`, background: enc ? 'var(--accent)' : 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: enc ? '#fff' : 'var(--ink3)' }}>
                {enc ? '✔' : i + 1}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div style={secStyle}>
          <div style={labelStyle}>Cuota / manzana</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: -6 }}>Encuestas a tomar por manzana.</div>
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
          <div style={labelStyle}>Casas por lado</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: -6 }}>Estimado para calcular el recorrido.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={2} max={30} value={config.casas_por_lado || 10}
              onChange={e => update('casas_por_lado', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }} />
            <span style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: 'var(--accent)', minWidth: 28, textAlign: 'center' }}>
              {config.casas_por_lado || 10}
            </span>
          </div>
        </div>
        <div style={secStyle}>
          <div style={labelStyle}>Máx. intentos</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: -6 }}>Visitas por parcela antes de reemplazar.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => update('max_intentos', n)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--r)', border: `2px solid ${config.max_intentos === n ? 'var(--accent)' : 'var(--border2)'}`, background: config.max_intentos === n ? 'var(--accent-light)' : 'var(--paper)', color: config.max_intentos === n ? 'var(--accent)' : 'var(--ink3)', fontFamily: 'Syne', fontSize: 18, fontWeight: 800, cursor: 'pointer', transition: 'all .15s' }}>
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
              style={{ padding: '10px 12px', border: `2px solid ${config.tipo_reemplazo === op.key ? 'var(--accent)' : 'var(--border2)'}`, borderRadius: 'var(--r)', background: config.tipo_reemplazo === op.key ? 'var(--accent-light)' : 'var(--paper)', cursor: 'pointer', transition: 'all .15s' }}>
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
// ════════════════════════════════════════════════
// MODAL UNIFICADO: ZONAS + MUESTREO + DRAG&DROP
// ════════════════════════════════════════════════
export function ZonasYMuestreoModal({ encuesta, equipos, onClose, onSaved }) {
  const COLORES_ZONA = ['#1a472a', '#7c3aed', '#b45309', '#1e40af', '#9f1239', '#065f46']

  // ── Estado zonas ──
  const [zonas,         setZonas]         = useState([])  // [{ id, nombre, equipo_id, area_geojson, geofencing_activo }]
  const [zonaActiva,    setZonaActiva]    = useState(null) // id de la zona activa en el mapa
  const [loadingZonas,  setLoadingZonas]  = useState(true)

  // ── Estado muestreo ──
  const [config,        setConfig]        = useState(CONFIG_DEFAULT)
  const [fechaInicio,   setFechaInicio]   = useState('')
  const [fechaFin,      setFechaFin]      = useState('')

  // ── Drag & drop ──
  const [dragging,      setDragging]      = useState(null) // equipo_id que se está arrastrando

  // ── UI ──
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [tab,           setTab]           = useState('zonas') // 'zonas' | 'muestreo'

  // Ref del mapa de la zona activa
  const mapaRef = useRef(null)
  // Snapshot GeoJSON de cada zona { [zona_id]: geojson }
  const zonasDataRef = useRef({})

  // ── Carga inicial ──
  useEffect(() => {
    async function load() {
      setLoadingZonas(true)
      try {
        const [{ data: enc }, { data: zs }] = await Promise.all([
          supabase.from('encuestas').select('config_muestreo, fecha_inicio, fecha_fin').eq('id', encuesta.id).single(),
          supabase.from('encuesta_zonas').select('*').eq('encuesta_id', encuesta.id).order('orden'),
        ])
        if (enc?.config_muestreo) setConfig(c => ({ ...c, ...enc.config_muestreo }))
        if (enc?.fecha_inicio) setFechaInicio(enc.fecha_inicio)
        if (enc?.fecha_fin)    setFechaFin(enc.fecha_fin)
        const lista = zs || []
        setZonas(lista)
        // Precarga snapshots de cada zona
        lista.forEach(z => { if (z.area_geojson) zonasDataRef.current[z.id] = z.area_geojson })
        if (lista.length > 0) setZonaActiva(lista[0].id)
      } catch {}
      setLoadingZonas(false)
    }
    load()
  }, [encuesta.id])

  // ── Sincronizar mapa cuando cambia la zona activa ──
  // (el MapaZona se desmonta/remonta por key, así que tiene el estado correcto)

  // ── Guardar snapshot del mapa antes de cambiar de zona ──
  function guardarSnapshotActual() {
    if (mapaRef.current && zonaActiva) {
      const data = mapaRef.current.getZonaActual()
      if (data) zonasDataRef.current[zonaActiva] = data
    }
  }

  function cambiarZonaActiva(id) {
    guardarSnapshotActual()
    setZonaActiva(id)
  }

  async function agregarZona() {
    const orden = zonas.length + 1
    const { data, error: err } = await supabase
      .from('encuesta_zonas')
      .insert({ encuesta_id: encuesta.id, nombre: `Zona ${orden}`, orden })
      .select()
      .single()
    if (err || !data) return
    guardarSnapshotActual()
    setZonas(prev => [...prev, data])
    setZonaActiva(data.id)
  }

  const [distribuyendo, setDistribuyendo] = useState(null) // zona_id distribuyendo

  async function redistribuirManzanas(zonaId) {
    setDistribuyendo(zonaId)
    const { data, error } = await supabase.rpc('distribuir_manzanas_zona', {
      p_encuesta_zona_id: zonaId,
      p_forzar: true,  // redistribuye todo desde cero
    })
    setDistribuyendo(null)
    if (error) { setError(error.message); return }
    if (data?.error) { setError(data.error); return }
    setError('')
    // Mostrar resultado
    const msg = data?.manzanas_distribuidas > 0
      ? `${data.manzanas_distribuidas} manzanas distribuidas entre ${data.encuestadores} encuestadores (~${data.promedio_por_enc} c/u)`
      : data?.mensaje || 'Sin manzanas para distribuir'
    alert(msg)
  }

  async function renombrarZona(id, nombre) {
    setZonas(prev => prev.map(z => z.id === id ? { ...z, nombre } : z))
    await supabase.from('encuesta_zonas').update({ nombre }).eq('id', id)
  }

  async function eliminarZona(id) {
    if (!window.confirm('Eliminar esta zona? Se borran sus manzanas y parcelas.')) return
    await supabase.from('encuesta_zonas').delete().eq('id', id)
    delete zonasDataRef.current[id]
    const restantes = zonas.filter(z => z.id !== id)
    setZonas(restantes)
    setZonaActiva(restantes.length > 0 ? restantes[0].id : null)
  }

  // ── Drag & drop equipos ──
  function onDragStart(equipoId) { setDragging(equipoId) }
  function onDragEnd()           { setDragging(null) }

  function onDropEnZona(zonaId) {
    if (!dragging) return
    // Solo actualizar estado local — se persiste en handleSave junto con todo lo demás
    setZonas(prev => prev.map(z => z.id === zonaId ? { ...z, equipo_id: dragging } : z))
    setDragging(null)
  }

  function quitarEquipoDeZona(zonaId) {
    // Solo actualizar estado local
    setZonas(prev => prev.map(z => z.id === zonaId ? { ...z, equipo_id: null } : z))
  }

  // ── Guardar todo ──
  async function handleSave() {
    if ((config.razones_seleccionadas || []).length < 2) {
      setTab('muestreo')
      setError('Selecciona al menos 2 razones de no-respuesta')
      return
    }
    setSaving(true); setError('')
    try {
      guardarSnapshotActual()

      // Armar el payload completo — UNA sola llamada a la DB
      const zonasPayload = zonas.map(zona => {
        const geojson = zonasDataRef.current[zona.id]
        const manzanas = geojson
          ? (geojson.features || [])
              .filter(f => f.properties?.tipo === 'manzana' && f.properties?.seleccionada === true)
              .map(f => ({ area_geojson: JSON.stringify(f) }))
          : []
        const featsPersistir = geojson
          ? (geojson.features || []).filter(f =>
              f.properties?.tipo === 'zona' || f.properties?.tipo === 'manzana')
          : []
        return {
          id:                zona.id,
          equipo_id:         zona.equipo_id ?? null,
          geofencing_activo: featsPersistir.some(f => f.properties?.tipo === 'zona'),
          area_geojson:      featsPersistir.length > 0
                               ? { type: 'FeatureCollection', features: featsPersistir }
                               : null,
          manzanas,  // vacío si la zona no se tocó
        }
      })

      // Guardar config de muestreo + zonas
      const { data, error } = await supabase.rpc('guardar_config_encuesta', {
        p_payload: {
          encuesta_id:     encuesta.id,
          config_muestreo: config,
          zonas:           zonasPayload,
        }
      })
      if (error) throw error

      // Guardar fechas directamente en encuestas
      await supabase.from('encuestas')
        .update({
          fecha_inicio: fechaInicio || null,
          fecha_fin:    fechaFin    || null,
        })
        .eq('id', encuesta.id)

      // Disparar parcelas y distribución en background para cada zona que tuvo manzanas
      zonas.forEach(zona => {
        const tuvoCambios = (zonasDataRef.current[zona.id] != null)
        if (tuvoCambios) {
          supabase.functions.invoke('guardar-parcelas', { body: { encuesta_zona_id: zona.id } })
            .then(({ error: e }) => { if (e) console.error('[guardar-parcelas]', zona.id, e) })
          if (zona.equipo_id) {
            supabase.rpc('distribuir_manzanas_zona', { p_encuesta_zona_id: zona.id, p_forzar: false })
              .then(({ data: d }) => console.log('[distribuir]', zona.nombre, d))
          }
        }
      })

      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  // ── Estilos helpers ──
  const COLOR_ZONA = (idx) => COLORES_ZONA[idx % COLORES_ZONA.length]

  const zonaActivaObj = zonas.find(z => z.id === zonaActiva)
  const zonaActivaIdx = zonas.findIndex(z => z.id === zonaActiva)

  const tabBtn = (key, label) => ({
    padding: '6px 18px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600,
    border: 'none', background: 'none', borderBottom: `2.5px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
    color: tab === key ? 'var(--accent)' : 'var(--ink3)', transition: 'all .15s',
  })

  if (loadingZonas) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner center size="lg" />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 500, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--surface)' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 700, margin: 0 }}>
              {encuesta.nombre}
            </h3>
            <p style={{ fontSize: 11, color: 'var(--ink3)', margin: '2px 0 0' }}>
              Definir zonas, manzanas y configuracion de muestreo
            </p>
          </div>
          {error && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>Error: {error}</span>}
          <button onClick={onClose}
            style={{ padding: '6px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '6px 20px', background: saving ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'DM Sans', opacity: saving ? .6 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar todo'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 20, flexShrink: 0, background: 'var(--surface)' }}>
          {encuesta.tipo_encuesta !== 'telefonica' && (
            <button style={tabBtn('zonas', 'Zonas')} onClick={() => setTab('zonas')}>
              {encuesta.tipo_encuesta === 'callejera' ? 'Zonas y geofencing' : 'Zonas y manzanas'}
            </button>
          )}
          <button style={tabBtn('muestreo', 'Muestreo')} onClick={() => setTab('muestreo')}>Configuracion de muestreo</button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, minHeight: 0, display: tab === 'zonas' ? 'flex' : 'block', overflow: tab === 'zonas' ? 'hidden' : 'auto' }}>

          {/* ────────── TAB ZONAS ────────── */}
          {tab === 'zonas' && (
            <>
              {/* Sidebar izquierdo: lista de zonas + drag&drop equipos */}
              <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--surface)' }}>

                {/* Lista de zonas */}
                <div style={{ padding: '12px 12px 6px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Zonas ({zonas.length})
                    </span>
                    <button onClick={agregarZona}
                      title="Agregar nueva zona"
                      style={{ padding: '3px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                      + Zona
                    </button>
                  </div>
                  {zonas.map((zona, idx) => {
                    const eq = equipos.find(e => e.id === zona.equipo_id)
                    const activa = zona.id === zonaActiva
                    return (
                      <div key={zona.id}
                        onClick={() => cambiarZonaActiva(zona.id)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDropEnZona(zona.id)}
                        style={{
                          padding: '8px 10px', borderRadius: 'var(--r)', marginBottom: 4, cursor: 'pointer',
                          background: activa ? 'var(--accent-light)' : dragging ? 'rgba(22,163,74,0.06)' : 'var(--paper)',
                          border: `2px solid ${activa ? 'var(--accent2)' : dragging ? '#86efac' : 'var(--border)'}`,
                          transition: 'all .1s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_ZONA(idx), flexShrink: 0 }} />
                          <input
                            value={zona.nombre}
                            onChange={e => renombrarZona(zona.id, e.target.value)}
                            onClick={ev => ev.stopPropagation()}
                            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans', outline: 'none', color: 'var(--ink)', minWidth: 0 }}
                          />
                          <button onClick={ev => { ev.stopPropagation(); eliminarZona(zona.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--ink3)', padding: '0 2px', lineHeight: 1 }}>
                            x
                          </button>
                        {zona.equipo_id && (
                          <button
                            onClick={ev => { ev.stopPropagation(); redistribuirManzanas(zona.id) }}
                            title="Redistribuir manzanas entre los encuestadores del equipo al azar"
                            disabled={distribuyendo === zona.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent2)', padding: '0 2px', lineHeight: 1 }}>
                            {distribuyendo === zona.id ? '⏳' : '🎲'}
                          </button>
                        )}
                        </div>
                        {eq ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600, background: 'var(--accent-light)', padding: '1px 7px', borderRadius: 100, flex: 1 }}>
                              {eq.nombre}
                            </span>
                            <button onClick={ev => { ev.stopPropagation(); quitarEquipoDeZona(zona.id) }}
                              title="Quitar equipo de esta zona"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink3)', padding: '1px 3px', lineHeight: 1 }}>
                              x
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: 5, fontSize: 11, color: dragging ? '#16a34a' : 'var(--ink3)', fontStyle: 'italic' }}>
                            {dragging ? 'Solta aqui para asignar' : 'Sin equipo asignado'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {zonas.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: 'var(--ink3)' }}>
                      Agregar una zona para comenzar
                    </div>
                  )}
                </div>

                {/* Panel drag & drop de equipos */}
                <div style={{ padding: '12px', flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Equipos disponibles
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
                    Arrastra un equipo a una zona para asignarlo
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {equipos.map(eq => (
                      <div key={eq.id}
                        draggable
                        onDragStart={() => onDragStart(eq.id)}
                        onDragEnd={onDragEnd}
                        style={{
                          padding: '7px 10px', borderRadius: 'var(--r)', border: '1.5px solid var(--border2)',
                          background: dragging === eq.id ? 'var(--accent-light)' : 'var(--paper)',
                          cursor: 'grab', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans',
                          color: dragging === eq.id ? 'var(--accent)' : 'var(--ink)',
                          transition: 'all .1s', userSelect: 'none',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <span style={{ fontSize: 14 }}>{dragging === eq.id ? '✋' : '☰'}</span>
                        {eq.nombre}
                      </div>
                    ))}
                    {equipos.length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--ink3)', fontStyle: 'italic' }}>
                        Sin equipos. Crea equipos primero.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mapa de la zona activa */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {zonaActiva ? (
                  <MapaZona
                    key={zonaActiva}
                    ref={mapaRef}
                    encuestaId={encuesta.id}
                    zonaActual={zonasDataRef.current[zonaActiva] || null}
                    manzanasSeleccionadas={[]}
                    onZonaChange={geojson => { if (geojson) zonasDataRef.current[zonaActiva] = geojson }}
                    onManzanasChange={() => {}}
                    colorZona={COLOR_ZONA(zonaActivaIdx)}
                    sinManzanas={encuesta?.tipo_encuesta === 'callejera'}
                  />
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink3)' }}>
                    <div style={{ fontSize: 40 }}>🗺️</div>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>Agrega una zona para comenzar</p>
                    <button onClick={agregarZona}
                      style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                      + Agregar primera zona
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ────────── TAB MUESTREO ────────── */}
          {tab === 'muestreo' && (
            <div style={{ padding: '20px 28px', maxWidth: 720 }}>

              {/* ── Fechas de la encuesta ── */}
              <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Programación</div>
                <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16, lineHeight: 1.5 }}>
                  La encuesta se <strong>desbloquea automáticamente</strong> para los encuestadores en la fecha de inicio. Si no se configura, está disponible siempre que esté publicada.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', display: 'block', marginBottom: 6 }}>📅 Fecha de inicio</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={e => setFechaInicio(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 4 }}>Dejar vacío = disponible inmediatamente</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)', display: 'block', marginBottom: 6 }}>🔚 Fecha de cierre</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 4 }}>Dejar vacío = sin fecha de cierre</div>
                  </div>
                </div>
                {fechaInicio && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--accent2)', borderLeft: '3px solid var(--accent2)' }}>
                    🔒 Esta encuesta se desbloqueará el <strong>{new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                    {fechaFin && ` y cerrará el ${new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}.
                  </div>
                )}
              </div>

              {/* Cuota por encuestador — solo callejera y telefónica */}
              {(encuesta?.tipo_encuesta === 'callejera' || encuesta?.tipo_encuesta === 'telefonica') && (
                <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '18px 20px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cuota por encuestador</div>
                  <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12, lineHeight: 1.5 }}>
                    Cantidad de encuestas que debe completar cada encuestador.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="range" min={1} max={200} value={config.cuota_por_encuestador || 50}
                      onChange={e => setConfig(c => ({ ...c, cuota_por_encuestador: parseInt(e.target.value) }))}
                      style={{ flex: 1, accentColor: 'var(--accent)' }} />
                    <span style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: 'var(--accent)', minWidth: 48, textAlign: 'center' }}>
                      {config.cuota_por_encuestador || 50}
                    </span>
                  </div>
                </div>
              )}

              {/* Config domiciliaria — solo domiciliaria */}
              {encuesta?.tipo_encuesta === 'domiciliaria' && (
                <PanelConfig config={config} onChange={setConfig} organizacionId={encuesta?.organizacion_id} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}