import { useState, useEffect, useRef, useMemo } from 'react'
import { Select } from './ui'

// Extraído de EncuestaDetalle.jsx (era `MapaEncuesta`, atado solo a la
// pantalla de campo) — el mapa en sí no sabe nada de zonas/polígonos, solo
// pinta puntos {lat, lng, respuestas, ...}, así que sirve igual para
// encuestas de campo (GPS) y online (geolocalización por IP). La única
// diferencia es qué texto va en el popup de cada punto, controlado por
// `variant`.

const PALETA_MAPA_DET = ['#1a472a','#0369a1','#7c3aed','#b45309','#be185d','#047857','#dc2626','#d97706','#0891b2','#6d28d9']

function popupHTML(s, resp, color, variant) {
  const titulo = variant === 'online'
    ? [s.ciudad, s.pais].filter(Boolean).join(', ') || 'Ubicación desconocida'
    : (s.encuestador || '—')
  const fecha = s.fecha ? new Date(s.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  return `<div style="font-family:DM Sans,sans-serif;font-size:12px;line-height:1.6"><b>${titulo}</b>${resp !== '__all__' ? `<br><span style="color:${color};font-weight:700">${resp}</span>` : ''}<br><span style="color:#9ca3af;font-size:10px">${fecha}</span></div>`
}

export default function MapaSesiones({ sesiones, columnas, onCargar, loading, variant = 'campo', disclaimer }) {
  const mapRef    = useRef(null)
  const instRef   = useRef(null)
  const capasRef  = useRef([])
  const fittedRef = useRef(false)
  const [L, setL] = useState(null)
  const [listo, setListo] = useState(0)
  const [filtroCol, setFiltroCol] = useState('')
  const [capas, setCapas] = useState({})

  const valoresUnicos = useMemo(() => {
    if (!filtroCol) return []
    return [...new Set((sesiones||[]).map(s => s.respuestas?.[filtroCol]).filter(Boolean))].sort()
  }, [filtroCol, sesiones])

  useEffect(() => {
    const e = {}; valoresUnicos.forEach(v => { e[v] = true }); setCapas(e)
  }, [valoresUnicos.join('|')])

  const colorPorValor = useMemo(() => {
    const m = {}; valoresUnicos.forEach((v,i) => { m[v] = PALETA_MAPA_DET[i % PALETA_MAPA_DET.length] }); return m
  }, [valoresUnicos.join('|')])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const leaflet = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (!cancelled) setL(leaflet)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!L || !mapRef.current) return
    const loadScript = (url) => new Promise(res => {
      if (document.querySelector(`script[src="${url}"]`)) return res()
      const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = res; document.head.appendChild(s)
    })
    const loadCSS = (url) => {
      if (!document.querySelector(`link[href="${url}"]`)) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l)
      }
    }
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css')
    loadCSS('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css')
    const initMap = () => {
      if (instRef.current) return
      const rect = mapRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return
      instRef.current = L.map(mapRef.current, { zoomControl: true }).setView([-27.5, -55.8], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(instRef.current)
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js')
        .then(() => setListo(p => p + 1))
      ro.disconnect()
    }
    const ro = new ResizeObserver(initMap)
    ro.observe(mapRef.current)
    initMap()
    return () => { ro.disconnect(); if (instRef.current) { instRef.current.remove(); instRef.current = null } }
  }, [L])

  useEffect(() => {
    const mapa = instRef.current; if (!mapa) return
    capasRef.current.forEach(lg => { try { mapa.removeLayer(lg) } catch {} })
    capasRef.current = []
    const puntos = (sesiones||[]).filter(s => s.lat && s.lng)
    if (!puntos.length) return
    const grupos = {}
    puntos.forEach(s => {
      const resp = filtroCol ? (s.respuestas?.[filtroCol]||null) : '__all__'
      if (filtroCol && !resp) return
      if (filtroCol && resp && capas[resp] === false) return
      if (!grupos[resp]) grupos[resp] = []
      grupos[resp].push(s)
    })
    const todosVisibles = []
    const tieneCluster = !!window.L?.MarkerClusterGroup
    Object.entries(grupos).forEach(([resp, pts]) => {
      const color = (resp !== '__all__' && filtroCol) ? (colorPorValor[resp] || 'var(--ink4)') : 'var(--accent)'
      const layer = tieneCluster
        ? L.markerClusterGroup({ maxClusterRadius: 50, showCoverageOnHover: false,
            iconCreateFunction: (cluster) => {
              const n = cluster.getChildCount(); const sz = n < 10 ? 34 : n < 100 ? 40 : 46
              return L.divIcon({ className: '', html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${sz<38?12:14}px;border:3px solid rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(0,0,0,.35)">${n}</div>`, iconSize: [sz,sz], iconAnchor: [sz/2,sz/2] }) }})
        : L.layerGroup()
      pts.forEach(s => {
        todosVisibles.push(s)
        const icono = L.divIcon({ className: '', html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize:[13,13], iconAnchor:[6,6] })
        L.marker([s.lat, s.lng], { icon: icono }).bindPopup(popupHTML(s, resp, color, variant)).addTo(layer)
      })
      layer.addTo(mapa); capasRef.current.push(layer)
    })
    if (todosVisibles.length > 0 && !fittedRef.current) {
      mapa.fitBounds(L.latLngBounds(todosVisibles.map(s => [s.lat, s.lng])), { padding: [40,40], maxZoom: 16 })
      fittedRef.current = true
    }
  }, [sesiones, filtroCol, capas, colorPorValor, listo, L, variant])

  useEffect(() => () => {
    capasRef.current.forEach(lg => { try { if (instRef.current) instRef.current.removeLayer(lg) } catch {} })
    if (instRef.current) { instRef.current.remove(); instRef.current = null }
  }, [])

  const puntos = (sesiones||[]).filter(s => s.lat && s.lng)
  const etiquetaConUbicacion = variant === 'online' ? 'con ubicación' : 'con GPS'
  const etiquetaSinUbicacion = variant === 'online' ? 'sin ubicación' : 'sin GPS'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {disclaimer && (
        <div style={{ fontSize: 12, color: 'var(--ink3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px' }}>
          ℹ️ {disclaimer}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 16px' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Colorear por respuesta a</label>
          <Select value={filtroCol} onChange={e => { setFiltroCol(e.target.value); setCapas({}) }}
            style={{ padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}>
            <option value="">— Todos los puntos (un color) —</option>
            {columnas.map(c => <option key={c.id} value={c.id}>{c.texto?.slice(0,68)}</option>)}
          </Select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, paddingBottom: 2 }}>
          <strong>{puntos.length}</strong> {etiquetaConUbicacion}
          {(sesiones||[]).length - puntos.length > 0 && <span style={{ color: 'var(--ink4)' }}>· {(sesiones||[]).length - puntos.length} {etiquetaSinUbicacion}</span>}
        </div>
        {onCargar && puntos.length === 0 && !loading && (
          <button onClick={onCargar} style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            Cargar mapa
          </button>
        )}
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink3)' }}>Cargando ubicaciones...</div>}
      {!loading && puntos.length === 0 && (sesiones||[]).length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--ink3)', fontSize: 14, background: 'var(--paper)', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
          {onCargar ? '📍 Hacé clic en "Cargar mapa" para ver las respuestas georreferenciadas' : '📍 Todavía no hay respuestas con ubicación'}
        </div>
      )}
      <div ref={mapRef} style={{ height: 520, width: '100%', borderRadius: 'var(--r2)', border: '1px solid var(--border)', overflow: 'hidden', display: puntos.length === 0 ? 'none' : 'block' }} />
    </div>
  )
}
