import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

const TIPOS = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'checkbox',        label: 'Checkbox (múltiple)' },
  { value: 'si_no',           label: 'Sí / No' },
  { value: 'escala',          label: 'Escala 1-10' },
  { value: 'texto_libre',     label: 'Texto libre' },
  { value: 'desplegable',     label: 'Desplegable' },
]
const TIPOS_CON_OPCIONES = ['opcion_multiple', 'checkbox', 'desplegable']
const ESTADO_CONFIG = {
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: '#fef3c7' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff' },
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: '#d8f3dc' },
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid var(--border2)', borderRadius: 'var(--r)',
  fontSize: 13, outline: 'none', fontFamily: 'DM Sans', background: '#fff',
}
const labelStyle = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }

function PreguntaCard({ pregunta, index, total, onUpdate, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true)
  const tieneOpciones = TIPOS_CON_OPCIONES.includes(pregunta.tipo)

  function addOpcion() {
    onUpdate({ ...pregunta, opciones: [...(pregunta.opciones || []), { texto: '', orden: (pregunta.opciones?.length || 0) + 1 }] })
  }
  function updateOpcion(i, texto) {
    onUpdate({ ...pregunta, opciones: pregunta.opciones.map((o, idx) => idx === i ? { ...o, texto } : o) })
  }
  function removeOpcion(i) {
    onUpdate({ ...pregunta, opciones: pregunta.opciones.filter((_, idx) => idx !== i).map((o, j) => ({ ...o, orden: j + 1 })) })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      {/* Header */}
      <div
        style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderBottom: expanded ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontFamily: 'Syne', fontSize: 11, fontWeight: 700, color: 'var(--ink3)', minWidth: 22 }}>P{index + 1}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: pregunta.texto ? 'var(--ink)' : 'var(--ink3)', fontStyle: pregunta.texto ? 'normal' : 'italic', lineHeight: 1.3 }}>
          {pregunta.texto || 'Nueva pregunta...'}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink3)', background: '#fff', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
          {TIPOS.find(t => t.value === pregunta.tipo)?.label}
        </span>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .35 : 1, fontSize: 12 }}>↑</button>
          <button onClick={() => onMove(index,  1)} disabled={index === total-1} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: index === total-1 ? 'not-allowed' : 'pointer', opacity: index === total-1 ? .35 : 1, fontSize: 12 }}>↓</button>
          <button onClick={() => onDelete(index)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--danger)' }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Texto de la pregunta</label>
            <textarea value={pregunta.texto} onChange={e => onUpdate({ ...pregunta, texto: e.target.value })} placeholder="Escribí la pregunta..." rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={labelStyle}>Tipo</label>
              <select value={pregunta.tipo}
                onChange={e => onUpdate({ ...pregunta, tipo: e.target.value, opciones: TIPOS_CON_OPCIONES.includes(e.target.value) ? (pregunta.opciones || []) : [] })}
                style={inputStyle}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500, paddingBottom: 9 }}>
                <input type="checkbox" checked={pregunta.requerida} onChange={e => onUpdate({ ...pregunta, requerida: e.target.checked })} />
                Requerida
              </label>
            </div>
          </div>

          {tieneOpciones && (
            <div>
              <label style={labelStyle}>Opciones</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(pregunta.opciones || []).map((op, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, width: 18, textAlign: 'center' }}>{String.fromCharCode(65+i)}</span>
                    <input value={op.texto} onChange={e => updateOpcion(i, e.target.value)} placeholder={`Opción ${String.fromCharCode(65+i)}`}
                      style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => removeOpcion(i)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, flexShrink: 0 }}>×</button>
                  </div>
                ))}
                <button onClick={addOpcion}
                  style={{ padding: '7px 14px', border: '1.5px dashed var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent2)', fontWeight: 600, fontFamily: 'DM Sans', marginTop: 2 }}>
                  + Agregar opción
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function EncuestaBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [orgs, setOrgs]         = useState([])
  const [loading, setLoading]   = useState(isEditing)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [bloqueado, setBloqueado] = useState(false)  // tiene respuestas → no editar

  const [meta, setMeta] = useState({
    nombre: '', descripcion: '', pedido_por: '', estado_produccion: 'pendiente',
  })
  const [preguntas, setPreguntas] = useState([])

  useEffect(() => {
    supabase.from('organizaciones').select('id, nombre').order('nombre').then(({ data }) => setOrgs(data || []))
    if (id) loadEncuesta()
  }, [id]) // eslint-disable-line

  async function loadEncuesta() {
    setLoading(true)
    const { data: enc } = await supabase
      .from('encuestas')
      .select('*, preguntas(*, opciones_pregunta(*))')
      .eq('id', id).single()

    if (enc) {
      setMeta({
        nombre: enc.nombre || '', descripcion: enc.descripcion || '',
        pedido_por: enc.pedido_por || '', estado_produccion: enc.estado_produccion || 'pendiente',
      })
      const pqs = (enc.preguntas || [])
        .sort((a, b) => a.orden - b.orden)
        .map(p => ({ ...p, opciones: (p.opciones_pregunta || []).sort((a, b) => a.orden - b.orden) }))
      setPreguntas(pqs)

      // Verificar si hay respuestas (bloquear edición)
      // sesiones_respuesta → asignaciones_encuesta → encuestas_equipo → encuesta_id
      const { data: asignaciones } = await supabase
        .from('asignaciones_encuesta')
        .select('id, encuestas_equipo!inner(encuesta_id)')
        .eq('encuestas_equipo.encuesta_id', id)
      if (asignaciones && asignaciones.length > 0) {
        const asignacionIds = asignaciones.map(a => a.id)
        const { count } = await supabase
          .from('sesiones_respuesta')
          .select('id', { count: 'exact', head: true })
          .in('asignacion_id', asignacionIds)
        if (count > 0) setBloqueado(true)
      }
    }
    setLoading(false)
  }

  function addPregunta() {
    setPreguntas(prev => [...prev, { _tempId: Date.now(), texto: '', tipo: 'opcion_multiple', requerida: true, orden: prev.length + 1, opciones: [] }])
  }
  function updatePregunta(i, updated) { setPreguntas(prev => prev.map((p, idx) => idx === i ? updated : p)) }
  function deletePregunta(i)          { setPreguntas(prev => prev.filter((_, idx) => idx !== i).map((p, j) => ({ ...p, orden: j + 1 }))) }
  function movePregunta(i, dir) {
    const ni = i + dir
    if (ni < 0 || ni >= preguntas.length) return
    const arr = [...preguntas];
    [arr[i], arr[ni]] = [arr[ni], arr[i]]
    setPreguntas(arr.map((p, j) => ({ ...p, orden: j + 1 })))
  }

  async function handleSave() {
    if (!meta.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (bloqueado) { setError('Esta encuesta tiene respuestas y no puede editarse'); return }
    setSaving(true); setError('')
    try {
      let encuestaId = id
      if (isEditing) {
        const { error: e } = await supabase.from('encuestas').update({
          nombre: meta.nombre, descripcion: meta.descripcion || null,
          pedido_por: meta.pedido_por || null, estado_produccion: meta.estado_produccion,
        }).eq('id', id)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('encuestas').insert({
          nombre: meta.nombre, descripcion: meta.descripcion || null,
          pedido_por: meta.pedido_por || null, estado_produccion: meta.estado_produccion,
          organizacion_id: meta.pedido_por || null,
        }).select().single()
        if (e) throw e
        encuestaId = data.id
      }

      if (isEditing) await supabase.from('preguntas').delete().eq('encuesta_id', encuestaId)

      for (let i = 0; i < preguntas.length; i++) {
        const p = preguntas[i]
        const { data: pData, error: pErr } = await supabase.from('preguntas').insert({
          encuesta_id: encuestaId, texto: p.texto, tipo: p.tipo, requerida: p.requerida, orden: i + 1,
        }).select().single()
        if (pErr) throw pErr
        if (p.opciones?.length > 0) {
          const { error: oErr } = await supabase.from('opciones_pregunta').insert(
            p.opciones.map((o, j) => ({ pregunta_id: pData.id, texto: o.texto, orden: j + 1 }))
          )
          if (oErr) throw oErr
        }
      }
      navigate('/superadmin/encuestas')
    } catch (err) { setError(err.message) }
    setSaving(false)
  }

  async function handleEnviarRevision() {
    await supabase.from('encuestas').update({ estado_produccion: 'para_revisar' }).eq('id', id)
    navigate('/superadmin/encuestas')
  }

  if (loading) return <div className="sa-page"><div style={{ padding: 60 }}><Spinner center size="lg" /></div></div>

  const cfg = ESTADO_CONFIG[meta.estado_produccion]
  const esParaRevisar = meta.estado_produccion === 'para_revisar'
  const esPublicada   = meta.estado_produccion === 'publicada'

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin / Encuestas</div>
          <h1 className="sa-title">{isEditing ? 'Editar encuesta' : 'Nueva encuesta'}</h1>
          {isEditing && (
            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/superadmin/encuestas')}
            style={{ padding: '9px 18px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans' }}>
            Cancelar
          </button>
          {/* Botón "Enviar a revisión" — solo cuando está en proceso */}
          {isEditing && meta.estado_produccion === 'en_proceso' && (
            <button onClick={handleEnviarRevision}
              style={{ padding: '9px 18px', background: '#f3e8ff', color: '#7c3aed', border: '1.5px solid #c4b5fd', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans' }}>
              📤 Enviar a revisión
            </button>
          )}
          {/* No permite guardar si está publicada o bloqueada */}
          {!esPublicada && !bloqueado && (
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '9px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'DM Sans', opacity: saving ? .6 : 1 }}>
              {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear encuesta'}
            </button>
          )}
        </div>
      </div>

      <div className="sa-content">
        {/* Aviso encuesta bloqueada */}
        {bloqueado && (
          <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: 'var(--r)', fontSize: 13, color: '#b45309', marginBottom: 20, borderLeft: '3px solid #fcd34d', fontWeight: 500 }}>
            ⚠️ Esta encuesta tiene respuestas registradas y no puede editarse.
          </div>
        )}
        {/* Aviso encuesta publicada */}
        {esPublicada && !bloqueado && (
          <div style={{ padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--accent2)', marginBottom: 20, borderLeft: '3px solid var(--accent)', fontWeight: 500 }}>
            ✅ Esta encuesta está publicada. Para editarla volvela a "En proceso" desde el kanban.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Panel izquierdo — Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="sa-card" style={{ padding: 18 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Información</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input value={meta.nombre} onChange={e => setMeta(m => ({ ...m, nombre: e.target.value }))}
                    placeholder="Nombre de la encuesta" style={inputStyle} disabled={bloqueado || esPublicada} />
                </div>
                <div>
                  <label style={labelStyle}>Descripción</label>
                  <textarea value={meta.descripcion} onChange={e => setMeta(m => ({ ...m, descripcion: e.target.value }))}
                    placeholder="Descripción breve..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} disabled={bloqueado || esPublicada} />
                </div>
                <div>
                  <label style={labelStyle}>Organización (cliente)</label>
                  <select value={meta.pedido_por} onChange={e => setMeta(m => ({ ...m, pedido_por: e.target.value }))}
                    style={inputStyle} disabled={bloqueado || esPublicada}>
                    <option value="">Sin asignar</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estado de producción</label>
                  <select value={meta.estado_produccion} onChange={e => setMeta(m => ({ ...m, estado_produccion: e.target.value }))}
                    style={inputStyle} disabled={bloqueado}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="para_revisar">Para revisar</option>
                    <option value="publicada">Publicada</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sa-card" style={{ padding: 14 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Resumen</div>
              <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 8 }}>{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}</div>
              {preguntas.length > 0 && Object.entries(
                preguntas.reduce((acc, p) => { acc[p.tipo] = (acc[p.tipo] || 0) + 1; return acc }, {})
              ).map(([tipo, count]) => (
                <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--ink3)' }}>{TIPOS.find(t => t.value === tipo)?.label}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel derecho — Preguntas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)' }}>{error}</div>
            )}

            {preguntas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', color: 'var(--ink3)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sin preguntas todavía</div>
                <div style={{ fontSize: 12 }}>Hacé clic en "Agregar pregunta" para empezar</div>
              </div>
            )}

            {preguntas.map((p, i) => (
              <PreguntaCard
                key={p.id || p._tempId}
                pregunta={p}
                index={i}
                total={preguntas.length}
                onUpdate={updated => updatePregunta(i, updated)}
                onDelete={deletePregunta}
                onMove={movePregunta}
              />
            ))}

            {!bloqueado && !esPublicada && (
              <button onClick={addPregunta}
                style={{ padding: '12px', border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent2)', fontWeight: 600, fontFamily: 'DM Sans', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-light)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'none' }}
              >
                + Agregar pregunta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}