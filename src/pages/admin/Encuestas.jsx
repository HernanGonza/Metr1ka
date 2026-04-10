import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import { ZonasYMuestreoModal } from './MuestreoConfig'
import SimuladorEncuesta from './SimuladorEncuesta'
import styles from './Page.module.css'

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
}
const FILTROS = ['todas', 'pendiente', 'en_proceso', 'para_revisar', 'publicada']

const TIPO_CONFIG = {
  domiciliaria: { label: 'Domiciliaria', icon: '🏠', color: '#1a472a', bg: '#d8f3dc' },
  callejera:    { label: 'Callejera',    icon: '🚶', color: '#0369a1', bg: '#e0f2fe' },
  telefonica:   { label: 'Telefónica',   icon: '📞', color: '#7c3aed', bg: '#f3e8ff' },
  online:       { label: 'Online',       icon: '🌐', color: '#b45309', bg: '#fef3c7' },
}

// ── Modal solicitar encuesta ──
const INDICADORES_NSE = [
  { key: 'internet',     label: '¿Tiene internet en casa?' },
  { key: 'auto',         label: '¿Tiene automóvil?' },
  { key: 'educacion',    label: 'Nivel educativo del jefe de hogar' },
  { key: 'vivienda',     label: 'Tipo de vivienda' },
  { key: 'habitaciones', label: 'Cantidad de habitaciones' },
  { key: 'computadora',  label: '¿Tiene computadora o tablet?' },
]

function RequestModal({ organizacionId, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '', tipo_encuesta: 'domiciliaria' })
  const [configBase, setConfigBase] = useState({
    tipo_edad: 'numero',
    nivel_socioeconomico: false,
    indicadores_nse: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function toggleNSE(key) {
    setConfigBase(c => ({
      ...c,
      indicadores_nse: c.indicadores_nse.includes(key)
        ? c.indicadores_nse.filter(k => k !== key)
        : [...c.indicadores_nse, key],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('encuestas').insert({
        organizacion_id:       organizacionId,
        pedido_por:            organizacionId,
        nombre:                form.nombre,
        descripcion:           form.descripcion || null,
        tipo_encuesta:         form.tipo_encuesta,
        estado_produccion:     'pendiente',
        geofencing_activo:     false,
        config_preguntas_base: {
          tipo_edad:            configBase.tipo_edad,
          nivel_socioeconomico: String(configBase.nivel_socioeconomico),
          indicadores_nse:      configBase.indicadores_nse,
        },
      })
      if (err) throw err
      onSaved(); onClose()
    } catch (err) {
      setError(err.message || 'Error al solicitar la encuesta')
    } finally {
      setSaving(false)
    }
  }

  const sel  = { padding: '8px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: '#fff', width: '100%' }
  const chip = (active, color = 'var(--accent)') => ({
    padding: '5px 12px', borderRadius: 100, fontSize: 12, fontFamily: 'DM Sans',
    cursor: 'pointer', border: `1.5px solid ${active ? color : 'var(--border2)'}`,
    background: active ? `${color}18` : '#fff',
    color: active ? color : 'var(--ink3)', fontWeight: active ? 700 : 400,
  })

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} style={{ maxWidth: 560 }}>
        <div className={styles.modalHeader}>
          <h3>Solicitar nueva encuesta</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre de la encuesta *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Satisfacción con gestión 2025" required disabled={saving} />
          </div>
          <div className={styles.formGroup}>
            <label>Descripción / objetivo</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="¿Qué querés medir con esta encuesta?" rows={2} disabled={saving} />
          </div>
          <div className={styles.formGroup}>
            <label>Tipo de encuesta *</label>
            <select value={form.tipo_encuesta} onChange={e => setForm(f => ({ ...f, tipo_encuesta: e.target.value }))} disabled={saving} style={sel}>
              <option value="domiciliaria">🏠 Domiciliaria — zona + manzanas + parcelas</option>
              <option value="callejera">🚶 Callejera — solo zona geográfica</option>
              <option value="telefonica">📞 Telefónica — sin zona ni geofencing</option>
              <option value="online" disabled>🌐 Online — próximamente</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
              {form.tipo_encuesta === 'domiciliaria' && 'El encuestador visita domicilios en manzanas seleccionadas.'}
              {form.tipo_encuesta === 'callejera'    && 'El encuestador trabaja en una zona pero no en domicilios fijos.'}
              {form.tipo_encuesta === 'telefonica'   && 'Sin geofencing ni zona. Los encuestadores pueden estar en cualquier lugar.'}
            </div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>
              Configuración de preguntas base
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Edad del encuestado</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" style={chip(configBase.tipo_edad === 'numero')} onClick={() => setConfigBase(c => ({ ...c, tipo_edad: 'numero' }))}>Número libre</button>
                  <button type="button" style={chip(configBase.tipo_edad === 'rango')}  onClick={() => setConfigBase(c => ({ ...c, tipo_edad: 'rango' }))}>Rangos (18-25, 26-35...)</button>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input type="checkbox" id="nse" checked={configBase.nivel_socioeconomico}
                    onChange={e => setConfigBase(c => ({ ...c, nivel_socioeconomico: e.target.checked, indicadores_nse: e.target.checked ? c.indicadores_nse : [] }))}
                    style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <label htmlFor="nse" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Medir nivel socioeconómico</label>
                </div>
                {configBase.nivel_socioeconomico && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 22 }}>
                    {INDICADORES_NSE.map(ind => (
                      <button key={ind.key} type="button" style={chip(configBase.indicadores_nse.includes(ind.key), '#7c3aed')} onClick={() => toggleNSE(ind.key)}>
                        {ind.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Solicitar encuesta'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ── Modal grande para MuestreoConfig ──
function MuestreoModal({ encuesta, onClose, onSaved }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--r2)', width: '100%', maxWidth: 1100, height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, margin: 0 }}>⚙️ Configurar muestreo</h3>
            <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '2px 0 0' }}>{encuesta.nombre}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink3)', lineHeight: 1 }}>×</button>
        </div>
        <MuestreoConfig encuestaId={encuesta.id} encuesta={encuesta} onClose={onClose} onSaved={onSaved} />
      </div>
    </div>
  )
}

// ── Tarjeta de encuesta ──


// Boton con tooltip nativo
function Btn({ onClick, bg, color, border, icon, label, tooltip }) {
  return (
    <button onClick={onClick} title={tooltip}
      style={{ padding: '9px 14px', background: bg || 'var(--surface)', color: color || 'var(--ink2)',
        border: `1.5px solid ${border || 'var(--border2)'}`, borderRadius: 'var(--r)', fontSize: 13,
        fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
      {label}
    </button>
  )
}

function EncuestaCard({ encuesta, equipos, onApprove, onZonas, onSimular, onView, mostrarOrg, orgNombre }) {
  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente
  const tipo = TIPO_CONFIG[encuesta.tipo_encuesta]
  const esPublicada    = encuesta.estado_produccion === 'publicada'
  const paraRevisar    = encuesta.estado_produccion === 'para_revisar'
  const enProduccion   = ['pendiente', 'en_proceso'].includes(encuesta.estado_produccion)
  const cantZonas      = encuesta.encuesta_zonas?.length || 0
  const equiposAsignados = encuesta.encuesta_zonas?.filter(z => z.equipo_id)?.length || 0
  const esDomiciliaria = !['telefonica','online'].includes(encuesta.tipo_encuesta)

  return (
    <div className={`${styles.encuestaCard} ${esPublicada ? styles.encuestaCardPublicada : ''}`}
      onClick={onView} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>

      <div className={styles.encuestaHeader}>
        <h4 style={{ fontSize: 15, lineHeight: 1.3 }}>{encuesta.nombre}</h4>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {tipo && (
            <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: tipo.bg, color: tipo.color, whiteSpace: 'nowrap' }}>
              {tipo.icon} {tipo.label}
            </span>
          )}
          <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {encuesta.descripcion && <p className={styles.encuestaDesc}>{encuesta.descripcion}</p>}

      <div className={styles.encuestaMeta}>
        {mostrarOrg && orgNombre && <span style={{ fontWeight: 600, color: 'var(--accent2)', marginRight: 8 }}>🏢 {orgNombre}</span>}
        Solicitada: {new Date(encuesta.creado_en).toLocaleDateString('es-AR')}
        {cantZonas > 0 && (
          <span style={{ marginLeft: 10, padding: '1px 7px', borderRadius: 100, fontSize: 11, background: 'var(--accent-light)', color: 'var(--accent2)', fontWeight: 600 }}>
            {cantZonas} zona{cantZonas !== 1 ? 's' : ''}{equiposAsignados > 0 ? ` · ${equiposAsignados} equipos` : ''}
          </span>
        )}
      </div>

      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}
        onClick={e => e.stopPropagation()}>

        {paraRevisar && (
          <Btn onClick={onApprove} bg="var(--accent)" color="#fff" border="var(--accent)"
            icon="checkmark" label="Aprobar y publicar"
            tooltip="Aprobar esta encuesta y publicarla para los encuestadores" />
        )}

        {esPublicada && (
          <>
            {esDomiciliaria && (
              <Btn onClick={onZonas}
                bg={cantZonas > 0 ? 'var(--accent-light)' : 'var(--accent)'}
                color={cantZonas > 0 ? 'var(--accent2)' : '#fff'}
                border={cantZonas > 0 ? 'var(--accent2)' : 'var(--accent)'}
                icon="map"
                label={cantZonas > 0 ? `Zonas (${cantZonas})` : 'Definir zonas'}
                tooltip="Definir zonas geograficas, seleccionar manzanas y asignar equipos" />
            )}
            <Btn onClick={onSimular}
              bg="#f3e8ff" color="#7c3aed" border="#c4b5fd"
              icon="phone" label="Simular"
              tooltip="Previsualizá la encuesta en la app movil" />
          </>
        )}

        {enProduccion && (
          <span className={styles.encuestaNote}>Nuestro equipo esta trabajando en tu encuesta.</span>
        )}
      </div>
    </div>
  )
}

export default function Encuestas() {
  const { perfil }    = useAuth()
  const navigate      = useNavigate()
  const [encuestas,      setEncuestas]      = useState([])
  const [equipos,        setEquipos]        = useState([])
  const [organizaciones, setOrganizaciones] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showRequest,    setShowRequest]    = useState(false)
  const [filtro,         setFiltro]         = useState('todas')
  const [filtroOrg,      setFiltroOrg]      = useState('')
  const [filtroTipo,     setFiltroTipo]     = useState('')
  const [busqueda,       setBusqueda]       = useState('')
  const [simulando,      setSimulando]      = useState(null)
  const [zonasModal,     setZonasModal]     = useState(null)

  const esSuperadmin = perfil?.rol === 'superadmin'

  const fetchData = useCallback(async () => {
    if (!perfil) return
    setLoading(true)
    try {
      let encQ = supabase.from('encuestas')
        .select('*, area_geojson, config_muestreo, encuesta_zonas(id, nombre, equipo_id, area_geojson, geofencing_activo, orden)')
        .order('creado_en', { ascending: false })
      if (!esSuperadmin) encQ = encQ.eq('organizacion_id', perfil.organizacion_id)

      let eqQ = supabase.from('equipos').select('id, nombre, area_geojson').order('nombre')
      if (!esSuperadmin) eqQ = eqQ.eq('organizacion_id', perfil.organizacion_id)

      const [encRes, eqRes] = await Promise.all([encQ, eqQ])
      setEncuestas(encRes.data || [])
      setEquipos(eqRes.data || [])

      // Superadmin carga organizaciones para el filtro (secuencial para no saturar)
      if (esSuperadmin) {
        const orgRes = await supabase.from('organizaciones').select('id, nombre').order('nombre')
        setOrganizaciones(orgRes.data || [])
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [perfil, esSuperadmin])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleApprove(id) {
    try {
      await supabase.from('encuestas').update({ estado_produccion: 'publicada' }).eq('id', id)
      fetchData()
    } catch (err) {
      console.error('Error aprobando encuesta:', err)
      alert('Error al aprobar la encuesta')
    }
  }

  const filtradas = encuestas.filter(e => {
    const matchEstado  = filtro === 'todas' || e.estado_produccion === filtro
    const matchOrg     = !filtroOrg  || e.organizacion_id === filtroOrg
    const matchTipo    = !filtroTipo || e.tipo_encuesta === filtroTipo
    const matchBusq    = !busqueda   || e.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchOrg && matchTipo && matchBusq
  })

  const conteo = FILTROS.reduce((acc, f) => {
    acc[f] = f === 'todas' ? encuestas.length : encuestas.filter(e => e.estado_produccion === f).length
    return acc
  }, {})

  const hayFiltrosExtra = filtroOrg || filtroTipo || busqueda
  const inp = { padding: '7px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontFamily: 'DM Sans', background: '#fff' }

  return (
    <div className={styles.page}>
      <Topbar title="Encuestas" action={{ label: '+ Solicitar encuesta', onClick: () => setShowRequest(true) }} />

      {showRequest && (
        <RequestModal
          organizacionId={perfil?.organizacion_id}
          onClose={() => setShowRequest(false)}
          onSaved={() => { setShowRequest(false); fetchData() }}
        />
      )}

      {simulando && (
        <SimuladorEncuesta encuestaId={simulando} orgId={perfil?.organizacion_id} onClose={() => setSimulando(null)} />
      )}
      {zonasModal && (
        <ZonasYMuestreoModal
          encuesta={zonasModal}
          equipos={equipos}
          onClose={() => setZonasModal(null)}
          onSaved={() => { setZonasModal(null); fetchData() }}
        />
      )}

      <div className={styles.content}>

        {/* Filtros extra — búsqueda, org (superadmin), tipo */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              style={{ ...inp, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            {busqueda && (
              <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink3)', fontSize: 16 }}>×</button>
            )}
          </div>

          {esSuperadmin && organizaciones.length > 0 && (
            <select value={filtroOrg} onChange={e => setFiltroOrg(e.target.value)} style={{ ...inp, minWidth: 200 }}>
              <option value="">Todas las organizaciones</option>
              {organizaciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          )}

          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>

          {hayFiltrosExtra && (
            <button onClick={() => { setBusqueda(''); setFiltroOrg(''); setFiltroTipo('') }}
              style={{ ...inp, cursor: 'pointer', color: 'var(--ink3)' }}>
              Limpiar
            </button>
          )}
        </div>

        {/* Tabs de estado */}
        <div className={styles.filtroBar}>
          {FILTROS.map(f => (
            <button key={f}
              className={`${styles.filtroBtn} ${filtro === f ? styles.filtroBtnActivo : ''}`}
              onClick={() => setFiltro(f)}>
              {f === 'todas' ? 'Todas' : ESTADO_CONFIG[f].label}
              <span className={styles.filtroCount}>{conteo[f]}</span>
            </button>
          ))}
        </div>

        {hayFiltrosExtra && !loading && (
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 8 }}>
            {filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''} encontrado{filtradas.length !== 1 ? 's' : ''}
          </div>
        )}

        {loading ? (
          <Spinner center size="lg" />
        ) : filtradas.length === 0 ? (
          <div className={styles.empty}>
            <p>{hayFiltrosExtra ? 'No hay encuestas que coincidan con los filtros.' : filtro === 'todas' ? 'No hay encuestas todavía.' : `No hay encuestas en "${ESTADO_CONFIG[filtro]?.label}".`}</p>
            {!hayFiltrosExtra && (
              <button onClick={() => setShowRequest(true)}
                style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                Solicitar encuesta
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtradas.map(enc => (
              <EncuestaCard
                key={enc.id}
                encuesta={enc}
                equipos={equipos}
                mostrarOrg={esSuperadmin}
                orgNombre={esSuperadmin ? organizaciones.find(o => o.id === enc.organizacion_id)?.nombre : null}
                onApprove={() => handleApprove(enc.id)}
                onZonas={() => setZonasModal(enc)}
                onSimular={() => setSimulando(enc.id)}
                onView={() => navigate(`/encuestas/${enc.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}