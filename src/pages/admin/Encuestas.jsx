import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import MuestreoConfig from './MuestreoConfig'
import styles from './Page.module.css'

const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
}
const FILTROS = ['todas', 'pendiente', 'en_proceso', 'para_revisar', 'publicada']

// ── Modal solicitar encuesta ──
function RequestModal({ organizacionId, onClose, onSaved }) {
  const [form, setForm]     = useState({ nombre: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase.from('encuestas').insert({
        organizacion_id: organizacionId,
        pedido_por: organizacionId,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        estado_produccion: 'pendiente',
        geofencing_activo: false,
      })
      if (err) throw err
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Error al solicitar la encuesta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Solicitar nueva encuesta</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label>Nombre de la encuesta *</label>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Satisfacción con gestión 2025"
              required
              disabled={saving}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Descripción / objetivo</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="¿Qué querés medir con esta encuesta?"
              rows={3}
              disabled={saving}
            />
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
// ── Modal: asignar encuesta a equipos ──
function AssignModal({ encuesta, equipos, asignados, onClose, onSaved }) {
  const { perfil }              = useAuth()
  const [selected, setSelected] = useState(new Set(asignados))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function toggle(id) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      for (const equipoId of selected) {
        if (!asignados.includes(equipoId)) {
          const { error: err } = await supabase.from('encuestas_equipo').insert({
            encuesta_id: encuesta.id,
            equipo_id: equipoId,
            asignado_por: perfil?.id,
          })
          if (err && !err.message?.includes('duplicate')) throw err
        }
      }
      for (const equipoId of asignados) {
        if (!selected.has(equipoId)) {
          await supabase.from('encuestas_equipo').delete()
            .eq('encuesta_id', encuesta.id)
            .eq('equipo_id', equipoId)
        }
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar asignaciones')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent} style={{ maxWidth: 520 }}>
        <div className={styles.modalHeader}>
          <h3>Asignar equipos</h3>
          <button className={styles.closeBtn} onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className={styles.modalBody}>
          <p style={{ fontSize: 13, color: 'var(--ink2)', margin: '0 0 12px' }}>
            Seleccioná los equipos para <strong>"{encuesta.nombre}"</strong>:
          </p>
          {equipos.length === 0 ? (
            <p style={{ color: 'var(--ink3)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
              No tenés equipos creados todavía.
            </p>
          ) : (
            <div className={styles.equiposList}>
              {equipos.map(eq => (
                <div key={eq.id}
                  onClick={() => !saving && toggle(eq.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 'var(--r)',
                    border: `1.5px solid ${selected.has(eq.id) ? 'var(--accent)' : 'var(--border)'}`,
                    background: selected.has(eq.id) ? 'var(--accent-light)' : '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                    transition: 'all .15s',
                    marginBottom: 6,
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${selected.has(eq.id) ? 'var(--accent)' : 'var(--border2)'}`,
                    background: selected.has(eq.id) ? 'var(--accent)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {selected.has(eq.id) && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: selected.has(eq.id) ? 'var(--accent)' : 'var(--ink)' }}>{eq.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2, minHeight: 14 }}>
                      {selected.has(eq.id) ? '✓ Seleccionado' : asignados.includes(eq.id) ? 'Ya asignado — clic para deseleccionar' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="button" onClick={handleSave} disabled={saving || equipos.length === 0}>
              {saving ? 'Guardando...' : 'Guardar asignación'}
            </button>
          </div>
        </div>
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
            <h3 style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, margin: 0 }}>
              ⚙️ Configurar muestreo
            </h3>
            <p style={{ fontSize: 12, color: 'var(--ink3)', margin: '2px 0 0' }}>{encuesta.nombre}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--ink3)', lineHeight: 1 }}>×</button>
        </div>
        <MuestreoConfig
          encuestaId={encuesta.id}
          encuesta={encuesta}
          onClose={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>
  )
}
// ── Tarjeta de encuesta (SIN geofencing directo) ──
function EncuestaCard({ encuesta, onApprove, onAssign, onMuestreo, onView }) {
  const cfg = ESTADO_CONFIG[encuesta.estado_produccion] || ESTADO_CONFIG.pendiente
  const esPublicada  = encuesta.estado_produccion === 'publicada'
  const paraRevisar  = encuesta.estado_produccion === 'para_revisar'
  const enProduccion = ['pendiente', 'en_proceso'].includes(encuesta.estado_produccion)
  const equiposAsignados = encuesta.encuestas_equipo?.length || 0

  return (
    <div className={`${styles.encuestaCard} ${esPublicada ? styles.encuestaCardPublicada : ''}`} onClick={onView}>
      <div className={styles.encuestaHeader}>
        <h4>{encuesta.nombre}</h4>
        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {cfg.label}
        </span>
      </div>
      {encuesta.descripcion && <p className={styles.encuestaDesc}>{encuesta.descripcion}</p>}
      <div className={styles.encuestaMeta}>
        Solicitada: {new Date(encuesta.creado_en).toLocaleDateString('es-AR')}
        {equiposAsignados > 0 && (
          <span style={{ marginLeft: 10, padding: '1px 7px', borderRadius: 100, fontSize: 11, background: 'var(--accent-light)', color: 'var(--accent2)', fontWeight: 600 }}>
            {equiposAsignados} equipo{equiposAsignados !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className={styles.encuestaActions} onClick={e => e.stopPropagation()}>
        {paraRevisar && (
          <button onClick={onApprove} style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
            ✓ Aprobar y publicar
          </button>
        )}
        {esPublicada && (
          <>
            <button onClick={onAssign} style={{ padding: '7px 14px', background: 'var(--surface)', color: 'var(--ink2)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              👥 {equiposAsignados > 0 ? `${equiposAsignados} equipo${equiposAsignados !== 1 ? 's' : ''}` : 'Asignar equipos'}
            </button>
            <button onClick={onMuestreo} style={{ padding: '7px 14px', background: encuesta.area_geojson ? 'var(--accent-light)' : 'var(--accent)', color: encuesta.area_geojson ? 'var(--accent2)' : '#fff', border: encuesta.area_geojson ? '1.5px solid var(--accent2)' : 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              {encuesta.area_geojson ? '⚙️ Muestreo ✓' : '⚙️ Configurar muestreo'}
            </button>
          </>
        )}
        {enProduccion && (
          <span className={styles.encuestaNote}>Nuestro equipo está trabajando en tu encuesta.</span>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──
export default function Encuestas() {
  const { perfil }    = useAuth()
  const navigate      = useNavigate()
  const [encuestas,    setEncuestas]    = useState([])
  const [equipos,      setEquipos]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showRequest,  setShowRequest]  = useState(false)
  const [assigning,    setAssigning]    = useState(null)
  const [muestreoData, setMuestreoData] = useState(null)
  const [filtro,       setFiltro]       = useState('todas')

  const fetchData = useCallback(async () => {
    if (!perfil?.organizacion_id) return
    setLoading(true)
    try {
      const [encRes, eqRes] = await Promise.all([
        supabase.from('encuestas')
          .select('*, area_geojson, encuestas_equipo(equipo_id, id)')
          .eq('organizacion_id', perfil.organizacion_id)
          .order('creado_en', { ascending: false }),
        supabase.from('equipos')
          .select('id, nombre, area_geojson')
          .eq('organizacion_id', perfil.organizacion_id)
          .order('nombre'),
      ])
      setEncuestas(encRes.data || [])
      setEquipos(eqRes.data || [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [perfil?.organizacion_id])

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

  const filtradas = encuestas.filter(e => filtro === 'todas' || e.estado_produccion === filtro)

  const conteo = FILTROS.reduce((acc, f) => {
    acc[f] = f === 'todas'
      ? encuestas.length
      : encuestas.filter(e => e.estado_produccion === f).length
    return acc
  }, {})

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

      {assigning && (
        <AssignModal
          encuesta={assigning.encuesta}
          equipos={equipos}
          asignados={assigning.asignados}
          onClose={() => setAssigning(null)}
          onSaved={() => { setAssigning(null); fetchData() }}
        />
      )}

      {muestreoData && (
        <MuestreoModal
          encuesta={muestreoData}
          onClose={() => setMuestreoData(null)}
          onSaved={() => { setMuestreoData(null); fetchData() }}
        />
      )}

      <div className={styles.content}>
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

        {loading ? (
          <Spinner center size="lg" />
        ) : filtradas.length === 0 ? (
          <div className={styles.empty}>
            <p>{filtro === 'todas' ? 'No tenés encuestas todavía.' : `No hay encuestas en "${ESTADO_CONFIG[filtro]?.label}".`}</p>
            <button onClick={() => setShowRequest(true)}
              style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
              Solicitar encuesta
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtradas.map(enc => (
              <EncuestaCard
                key={enc.id}
                encuesta={enc}
                onApprove={() => handleApprove(enc.id)}
                onAssign={() => setAssigning({
                  encuesta: enc,
                  asignados: (enc.encuestas_equipo || []).map(e => e.equipo_id)
                })}
                onMuestreo={() => setMuestreoData(enc)}
                onView={() => navigate(`/encuestas/${enc.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}