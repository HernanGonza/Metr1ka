import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from './Page.module.css'

async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  return L
}

function iconEncuestador(nombre, activo) {
  const color = activo ? 'var(--accent)' : 'var(--ink4)'
  const inicial = (nombre || '?')[0].toUpperCase()
  const html = `
    <div style="
      width:34px;height:34px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:700;color:#fff;font-family:DM Sans;
    ">${inicial}</div>`
  return { html, iconSize: [34, 34], iconAnchor: [17, 17], className: '' }
}

// Encuestador "activo" si actualizó en los últimos 5 minutos
function esActivo(actualizado_en) {
  if (!actualizado_en) return false
  return (Date.now() - new Date(actualizado_en).getTime()) < 5 * 60 * 1000
}

export default function Mapa() {
  const { perfil } = useAuth()
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const Lref      = useRef(null)
  const markersRef = useRef({}) // { encuestador_id: marker }
  const channelRef = useRef(null)

  const [listo,         setListo]         = useState(false)
  const [encuestadores, setEncuestadores] = useState([]) // [{ encuestador_id, nombre, lat, lng, actualizado_en }]

  // Cargar nombres de encuestadores de la org
  const loadNombres = useCallback(async () => {
    if (!perfil?.organizacion_id) return {}
    const { data } = await supabase
      .from('ubicaciones_encuestadores')
      .select('encuestador_id, lat, lng, actualizado_en, perfiles(nombre_completo)')
      .eq('organizacion_id', perfil.organizacion_id)
    if (!data) return {}
    const map = {}
    data.forEach(u => {
      map[u.encuestador_id] = {
        encuestador_id: u.encuestador_id,
        nombre: u.perfiles?.nombre_completo || 'Encuestador',
        lat: u.lat,
        lng: u.lng,
        actualizado_en: u.actualizado_en,
      }
    })
    return map
  }, [perfil?.organizacion_id])

  // Inicializar mapa
  useEffect(() => {
    let mounted = true
    async function setup() {
      if (!mapRef.current || mapInst.current) return
      const L = await initMapLibs()
      if (!mounted) return
      Lref.current = L

      const map = L.map(mapRef.current, {
        center: [-27.3671, -55.8974],
        zoom: 13,
        preferCanvas: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      mapInst.current = map
      setListo(true)

      // Cargar ubicaciones iniciales
      const nombresMap = await loadNombres()
      if (!mounted) return
      setEncuestadores(Object.values(nombresMap))
      Object.values(nombresMap).forEach(u => {
        if (u.lat && u.lng) agregarOActualizarMarker(L, map, u)
      })

      setTimeout(() => { if (mounted && mapInst.current) mapInst.current.invalidateSize() }, 100)
    }
    setup()
    return () => {
      mounted = false
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  // Suscripción realtime
  useEffect(() => {
    if (!perfil?.organizacion_id) return

    const channel = supabase
      .channel('ubicaciones-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ubicaciones_encuestadores',
          filter: `organizacion_id=eq.${perfil.organizacion_id}`,
        },
        async (payload) => {
          const u = payload.new
          if (!u?.encuestador_id || !u.lat || !u.lng) return

          // Buscar nombre si no lo tenemos
          let nombre = encuestadores.find(e => e.encuestador_id === u.encuestador_id)?.nombre
          if (!nombre) {
            const { data } = await supabase
              .from('perfiles')
              .select('nombre_completo')
              .eq('id', u.encuestador_id)
              .single()
            nombre = data?.nombre_completo || 'Encuestador'
          }

          const encuestador = { ...u, nombre }

          setEncuestadores(prev => {
            const idx = prev.findIndex(e => e.encuestador_id === u.encuestador_id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = encuestador
              return next
            }
            return [...prev, encuestador]
          })

          if (Lref.current && mapInst.current) {
            agregarOActualizarMarker(Lref.current, mapInst.current, encuestador)
          }
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [perfil?.organizacion_id])

  function agregarOActualizarMarker(L, map, u) {
    const activo = esActivo(u.actualizado_en)
    const iconOpts = iconEncuestador(u.nombre, activo)
    const icon = L.divIcon(iconOpts)
    const existing = markersRef.current[u.encuestador_id]
    if (existing) {
      existing.setLatLng([u.lat, u.lng])
      existing.setIcon(icon)
      existing.setTooltipContent(tooltipContent(u))
    } else {
      const marker = L.marker([u.lat, u.lng], { icon })
        .bindTooltip(tooltipContent(u), { direction: 'top', offset: [0, -20], className: 'leaflet-tooltip-enc' })
        .addTo(map)
      markersRef.current[u.encuestador_id] = marker
    }
  }

  function tooltipContent(u) {
    const mins = u.actualizado_en
      ? Math.floor((Date.now() - new Date(u.actualizado_en).getTime()) / 60000)
      : null
    const cuando = mins === null ? '' : mins < 1 ? 'ahora mismo' : `hace ${mins} min`
    return `<div style="font-family:DM Sans;font-size:12px;font-weight:600">${u.nombre}<br><span style="font-weight:400;color:#64748b">${cuando}</span></div>`
  }

  const activos  = encuestadores.filter(e => esActivo(e.actualizado_en))
  const inactivos = encuestadores.filter(e => !esActivo(e.actualizado_en))

  return (
    <div className={styles.page} style={{ display: 'flex', flexDirection: 'column' }}>
      <Topbar title="Mapa en tiempo real" />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Mapa */}
        <div style={{ flex: 1, position: 'relative' }}>
          {!listo && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
              <Spinner center size="lg" />
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Panel lateral derecho */}
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflowY: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              Encuestadores
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--r)', padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{activos.length}</div>
                <div style={{ fontSize: 11, color: '#15803d', fontWeight: 600 }}>Activos</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--ink3)' }}>{inactivos.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600 }}>Inactivos</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {encuestadores.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
                Ningún encuestador activo
              </div>
            ) : (
              encuestadores
                .sort((a, b) => (esActivo(b.actualizado_en) ? 1 : 0) - (esActivo(a.actualizado_en) ? 1 : 0))
                .map(u => {
                  const activo = esActivo(u.actualizado_en)
                  const mins = u.actualizado_en
                    ? Math.floor((Date.now() - new Date(u.actualizado_en).getTime()) / 60000)
                    : null
                  return (
                    <div key={u.encuestador_id}
                      onClick={() => {
                        const marker = markersRef.current[u.encuestador_id]
                        if (marker && mapInst.current) {
                          mapInst.current.setView(marker.getLatLng(), 16, { animate: true })
                          marker.openTooltip()
                        }
                      }}
                      style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: activo ? 'var(--accent)' : 'var(--ink4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(u.nombre || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.nombre}
                        </div>
                        <div style={{ fontSize: 11, color: activo ? '#16a34a' : 'var(--ink3)' }}>
                          {activo
                            ? (mins < 1 ? 'Ahora mismo' : `Hace ${mins} min`)
                            : (mins !== null && mins < 60 ? `Hace ${mins} min` : 'Inactivo')}
                        </div>
                      </div>
                      {activo && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--ink3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} />
            Actualización en tiempo real
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .3; }
        }
        .leaflet-tooltip-enc {
          background: #fff;
          border: 1px solid var(--border2);
          border-radius: 8px;
          padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,.15);
        }
        .leaflet-tooltip-enc::before { display: none; }
      `}</style>
    </div>
  )
}