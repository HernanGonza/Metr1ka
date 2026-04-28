import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import styles from '../admin/Page.module.css'

// ── Leaflet helpers ──────────────────────────────────────────
async function initMapLibs() {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  return L
}
function esActivo(ts) {
  if (!ts) return false
  return (Date.now() - new Date(ts).getTime()) < 5 * 60 * 1000
}
function iconEnc(nombre, activo) {
  const color = activo ? '#1a472a' : '#94a3b8'
  const ini   = (nombre || '?')[0].toUpperCase()
  return {
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;color:#fff;font-family:DM Sans">${ini}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16], className: '',
  }
}

// ── Selector de equipo ───────────────────────────────────────
function SelectorEquipo({ equipos, equipoId, onChange }) {
  if (equipos.length <= 1) return null
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
        Equipo
      </label>
      <select
        value={equipoId || ''}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '9px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--paper)', color: 'var(--ink)', outline: 'none', cursor: 'pointer', width: 240 }}
      >
        {equipos.map(eq => (
          <option key={eq.id} value={eq.id}>{eq.nombre}</option>
        ))}
      </select>
    </div>
  )
}

// ── Mapa inline ──────────────────────────────────────────────
function MapaEquipo({ equipoId, orgId }) {
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const Lref      = useRef(null)
  const markersRef = useRef({})
  const channelRef = useRef(null)
  const [encuestadores, setEncuestadores] = useState([])
  const [listo, setListo] = useState(false)

  // Cargar encuestadores del equipo con ubicación
  const loadUbicaciones = useCallback(async () => {
    if (!equipoId || !orgId) return {}
    // IDs del equipo
    const { data: miembros } = await supabase
      .from('equipo_encuestadores')
      .select('encuestador_id')
      .eq('equipo_id', equipoId)
    if (!miembros?.length) return {}
    const ids = miembros.map(m => m.encuestador_id)

    const { data: ubs } = await supabase
      .from('ubicaciones_encuestadores')
      .select('encuestador_id, lat, lng, actualizado_en, perfiles(nombre_completo)')
      .in('encuestador_id', ids)
    const map = {}
    ;(ubs || []).forEach(u => {
      map[u.encuestador_id] = {
        encuestador_id: u.encuestador_id,
        nombre: u.perfiles?.nombre_completo || 'Encuestador',
        lat: u.lat, lng: u.lng,
        actualizado_en: u.actualizado_en,
      }
    })
    return map
  }, [equipoId, orgId])

  function agregarOActualizar(L, map, u) {
    const activo = esActivo(u.actualizado_en)
    const icon = L.divIcon(iconEnc(u.nombre, activo))
    const mins = u.actualizado_en
      ? Math.floor((Date.now() - new Date(u.actualizado_en).getTime()) / 60000) : null
    const cuando = mins === null ? '' : mins < 1 ? 'Ahora mismo' : `Hace ${mins} min`
    const tooltip = `<div style="font-family:DM Sans;font-size:12px;font-weight:600">
      ${u.nombre}<br><span style="font-weight:400;color:#64748b">${cuando}</span></div>`
    const existing = markersRef.current[u.encuestador_id]
    if (existing) {
      existing.setLatLng([u.lat, u.lng])
      existing.setIcon(icon)
      existing.setTooltipContent(tooltip)
    } else {
      markersRef.current[u.encuestador_id] = L.marker([u.lat, u.lng], { icon })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -20], className: 'leaflet-tooltip-enc' })
        .addTo(map)
    }
  }

  // Inicializar mapa
  useEffect(() => {
    let mounted = true
    // Limpiar marcadores anteriores si cambia el equipo
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    async function setup() {
      if (!mapRef.current) return
      const L = await initMapLibs()
      if (!mounted) return
      Lref.current = L

      if (!mapInst.current) {
        const map = L.map(mapRef.current, {
          center: [-27.3671, -55.8974], zoom: 13, preferCanvas: true,
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap', maxZoom: 19,
        }).addTo(map)
        mapInst.current = map
      }

      const nombresMap = await loadUbicaciones()
      if (!mounted) return
      setEncuestadores(Object.values(nombresMap))
      Object.values(nombresMap).forEach(u => {
        if (u.lat && u.lng) agregarOActualizar(L, mapInst.current, u)
      })
      setTimeout(() => { if (mounted && mapInst.current) mapInst.current.invalidateSize() }, 150)
      setListo(true)
    }
    setup()
    return () => { mounted = false }
  }, [equipoId, loadUbicaciones])

  // Realtime — solo encuestadores del equipo
  useEffect(() => {
    if (!orgId || !equipoId) return
    // Unsuscribir canal anterior
    if (channelRef.current) { supabase.removeChannel(channelRef.current) }

    const channel = supabase
      .channel(`mapa-coord-${equipoId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'ubicaciones_encuestadores',
        filter: `organizacion_id=eq.${orgId}`,
      }, async (payload) => {
        const u = payload.new
        if (!u?.encuestador_id || !u.lat || !u.lng) return
        // Verificar que pertenece al equipo
        const { data: chk } = await supabase
          .from('equipo_encuestadores')
          .select('encuestador_id')
          .eq('equipo_id', equipoId)
          .eq('encuestador_id', u.encuestador_id)
          .maybeSingle()
        if (!chk) return

        let nombre = encuestadores.find(e => e.encuestador_id === u.encuestador_id)?.nombre
        if (!nombre) {
          const { data: p } = await supabase.from('perfiles').select('nombre_completo').eq('id', u.encuestador_id).single()
          nombre = p?.nombre_completo || 'Encuestador'
        }
        const enc = { ...u, nombre }
        setEncuestadores(prev => {
          const idx = prev.findIndex(e => e.encuestador_id === u.encuestador_id)
          if (idx >= 0) { const n = [...prev]; n[idx] = enc; return n }
          return [...prev, enc]
        })
        if (Lref.current && mapInst.current) agregarOActualizar(Lref.current, mapInst.current, enc)
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [equipoId, orgId])

  // Cleanup al desmontar
  useEffect(() => () => {
    if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    if (channelRef.current) supabase.removeChannel(channelRef.current)
  }, [])

  const activos   = encuestadores.filter(e => esActivo(e.actualizado_en))
  const inactivos = encuestadores.filter(e => !esActivo(e.actualizado_en))

  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: activos.length ? '#16a34a' : 'var(--border2)', display: 'inline-block', boxShadow: activos.length ? '0 0 0 3px rgba(22,163,74,.2)' : 'none' }} />
          Mapa en vivo
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>● {activos.length} en campo</span>
          <span style={{ color: 'var(--ink3)' }}>○ {inactivos.length} inactivos</span>
        </div>
      </div>
      <div style={{ display: 'flex', height: 340 }}>
        {/* Mapa */}
        <div style={{ flex: 1, position: 'relative' }}>
          {!listo && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
              <Spinner center size="lg" />
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* Panel encuestadores */}
        <div style={{ width: 200, borderLeft: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)' }}>
          {encuestadores.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
              Ningún encuestador con ubicación activa
            </div>
          ) : (
            [...activos, ...inactivos].map(u => {
              const activo = esActivo(u.actualizado_en)
              const mins = u.actualizado_en
                ? Math.floor((Date.now() - new Date(u.actualizado_en).getTime()) / 60000) : null
              return (
                <div key={u.encuestador_id}
                  onClick={() => {
                    const marker = markersRef.current[u.encuestador_id]
                    if (marker && mapInst.current) {
                      mapInst.current.setView(marker.getLatLng(), 16, { animate: true })
                      marker.openTooltip()
                    }
                  }}
                  style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: activo ? '#1a472a' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(u.nombre || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre}</div>
                    <div style={{ fontSize: 11, color: activo ? '#16a34a' : 'var(--ink3)' }}>
                      {activo ? (mins < 1 ? 'Ahora mismo' : `Hace ${mins} min`) : (mins !== null && mins < 60 ? `Hace ${mins} min` : 'Sin señal')}
                    </div>
                  </div>
                  {activo && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Dashboard principal ──────────────────────────────────────
export default function DashboardCoord() {
  const { perfil } = useAuth()
  const navigate   = useNavigate()
  const [equipos,    setEquipos]    = useState([])
  const [equipoId,   setEquipoId]   = useState(null)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)

  // Cargar todos los equipos del coordinador
  useEffect(() => {
    if (!perfil?.id) return
    supabase
      .from('equipo_coordinadores')
      .select('equipo_id, equipos(id, nombre)')
      .eq('coordinador_id', perfil.id)
      .then(({ data: ecs }) => {
        const eqs = (ecs || []).map(ec => ec.equipos).filter(Boolean)
        setEquipos(eqs)
        if (eqs.length) setEquipoId(eqs[0].id)
        else setLoading(false) // Sin equipos — no quedarse en spinner
      })
  }, [perfil?.id])

  // Cargar datos del equipo seleccionado
  useEffect(() => {
    if (!equipoId) return
    setLoading(true)
    async function load() {
      const [{ data: encs }, { data: ees }] = await Promise.all([
        supabase.from('equipo_encuestadores')
          .select('encuestador_id, perfiles(nombre_completo, activo)')
          .eq('equipo_id', equipoId),
        supabase.from('encuestas_equipo')
          .select('encuesta_id, encuestas(nombre, descripcion, estado_produccion, activo)')
          .eq('equipo_id', equipoId),
      ])

      // Respuestas hoy y esta semana del equipo
      const ids = (encs || []).map(e => e.encuestador_id)
      let sesHoy = 0, sesSemana = 0
      if (ids.length) {
        const { data: asg } = await supabase
          .from('asignaciones_encuesta').select('id')
          .in('encuestador_id', ids)
        if (asg?.length) {
          const hace7 = new Date(Date.now() - 7*24*60*60*1000).toISOString()
          const { data: ses } = await supabase
            .from('sesiones_respuesta').select('iniciada_en, completada_en')
            .in('asignacion_id', asg.map(a => a.id))
            .gte('iniciada_en', hace7)
          const hoy = new Date()
          ;(ses || []).forEach(s => {
            sesSemana++
            const d = new Date(s.iniciada_en)
            if (d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth()) sesHoy++
          })
        }
      }

      setData({
        encuestadores: encs || [],
        encuestas: ees || [],
        sesHoy, sesSemana,
      })
      setLoading(false)
    }
    load()
  }, [equipoId])

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = perfil?.nombre_completo?.split(' ')[0] || 'Coordinador'

  const activos      = data?.encuestadores?.filter(e => e.perfiles?.activo !== false).length ?? 0
  const encsActivas  = data?.encuestas?.filter(e => e.encuestas?.estado_produccion === 'publicada').length ?? 0

  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>

        {/* Saludo */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Panel del coordinador
          </div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: 0, color: 'var(--ink)', letterSpacing: -.5 }}>
            {saludo}, {nombre} 👋
          </h2>
        </div>

        {/* Selector de equipo */}
        <SelectorEquipo equipos={equipos} equipoId={equipoId} onChange={setEquipoId} />

        {loading && <Spinner center size="lg" />}

        {!loading && data && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Encuestadores', value: data.encuestadores.length, sub: `${activos} activos`, color: 'var(--accent)', bg: 'var(--accent-light)' },
                { label: 'Encuestas asignadas', value: data.encuestas.length, sub: `${encsActivas} publicadas`, color: '#0369a1', bg: 'var(--info-light)' },
                { label: 'Respuestas hoy', value: data.sesHoy, sub: `${data.sesSemana} esta semana`, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, borderRadius: 'var(--r2)', padding: '16px 18px' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 30, fontWeight: 800, color: k.color, letterSpacing: -1 }}>{k.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: k.color, marginTop: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Mapa en vivo */}
            <MapaEquipo equipoId={equipoId} orgId={perfil?.organizacion_id} />

            {/* Encuestadores del equipo — tarjetas */}
            {data.encuestadores.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                    Encuestadores del equipo
                  </div>
                  <button onClick={() => navigate('/coord/equipo')}
                    style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Ver detalle →
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {data.encuestadores.map((e, i) => {
                    const activo = e.perfiles?.activo !== false
                    const ini = (e.perfiles?.nombre_completo || '?').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()
                    const PALETA = ['#1a472a','#0369a1','#7c3aed','#b45309','#be185d']
                    const BGSPALETA = ['#d8f3dc','#e0f2fe','#f3e8ff','#fef3c7','#fce7f3']
                    const color = PALETA[i % PALETA.length]
                    const bg    = BGSPALETA[i % BGSPALETA.length]
                    return (
                      <div key={i} style={{ background: 'var(--paper)', border: `1.5px solid ${activo ? '#a7f3d0' : 'var(--border)'}`, borderRadius: 'var(--r2)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: activo ? 1 : 0.6 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>
                          {ini}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{e.perfiles?.nombre_completo || '—'}</div>
                          <div style={{ fontSize: 11, color: activo ? '#16a34a' : 'var(--ink3)', fontWeight: 600, marginTop: 2 }}>
                            {activo ? '● Activo' : '○ Inactivo'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Encuestas — tarjetas */}
            {data.encuestas.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                    Encuestas del equipo
                  </div>
                  <button onClick={() => navigate('/coord/encuestas')}
                    style={{ fontSize: 12, color: 'var(--accent2)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Ver todas →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.encuestas.map((ee, i) => {
                    const enc = ee.encuestas
                    if (!enc) return null
                    const hoy = new Date().toISOString().slice(0, 10)
                    const fechaFin = enc.fecha_fin
                    const fechaInicio = enc.fecha_inicio
                    let estadoLabel = 'Pendiente', estadoColor = '#b45309', estadoBg = 'var(--warning-light)'
                    if (enc.estado_produccion === 'publicada') {
                      if (fechaFin && fechaFin < hoy) { estadoLabel = 'Finalizada'; estadoColor = '#6b7280'; estadoBg = 'var(--surface)' }
                      else if (fechaInicio && fechaInicio > hoy) { estadoLabel = 'Próximamente'; estadoColor = '#0369a1'; estadoBg = 'var(--info-light)' }
                      else { estadoLabel = 'Activa'; estadoColor = '#1a472a'; estadoBg = 'var(--accent-light)' }
                    }
                    return (
                      <div key={i} style={{ background: 'var(--paper)', border: `1.5px solid ${estadoColor === '#1a472a' ? '#a7f3d0' : 'var(--border)'}`, borderRadius: 'var(--r2)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{enc.nombre}</div>
                          {enc.descripcion && <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{enc.descripcion}</div>}
                          {(fechaInicio || fechaFin) && (
                            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>
                              {fechaInicio && `Desde ${new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                              {fechaFin && ` · Hasta ${new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                            </div>
                          )}
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: estadoBg, color: estadoColor, whiteSpace: 'nowrap', flexShrink: 0 }}>{estadoLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !data && (
          <div className={styles.empty}>
            <p>No tenés equipos asignados todavía.</p>
          </div>
        )}

      </div>
    </div>
  )
}