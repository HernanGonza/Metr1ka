import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

const TIPOS = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'checkbox',        label: 'Checkbox (múltiple selección)' },
  { value: 'si_no',           label: 'Sí / No' },
  { value: 'escala',          label: 'Escala 1-10' },
  { value: 'texto_libre',     label: 'Texto libre' },
  { value: 'desplegable',     label: 'Desplegable' },
]

const TIPOS_CON_OPCIONES = ['opcion_multiple', 'checkbox', 'desplegable']

function PreguntaCard({ pregunta, index, total, onUpdate, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(true)
  const tieneOpciones = TIPOS_CON_OPCIONES.includes(pregunta.tipo)

  function addOpcion() {
    const opciones = [...(pregunta.opciones || []), { texto: '', orden: (pregunta.opciones?.length || 0) + 1 }]
    onUpdate({ ...pregunta, opciones })
  }

  function updateOpcion(i, texto) {
    const opciones = pregunta.opciones.map((o, idx) => idx === i ? { ...o, texto } : o)
    onUpdate({ ...pregunta, opciones })
  }

  function removeOpcion(i) {
    const opciones = pregunta.opciones.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, orden: idx + 1 }))
    onUpdate({ ...pregunta, opciones })
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderBottom: expanded ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, cursor: 'grab', padding: '2px 4px', color: 'var(--ink3)' }}>
          <div style={{ width: 16, height: 2, background: 'currentColor', borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: 'currentColor', borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: 'currentColor', borderRadius: 1 }} />
        </div>
        <span style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, color: 'var(--ink3)', minWidth: 24 }}>P{index + 1}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: pregunta.texto ? 'var(--ink)' : 'var(--ink3)', fontStyle: pregunta.texto ? 'normal' : 'italic' }}>
          {pregunta.texto || 'Nueva pregunta...'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--ink3)', background: '#fff', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)' }}>
          {TIPOS.find(t => t.value === pregunta.tipo)?.label || pregunta.tipo}
        </span>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .4 : 1, fontSize: 12 }}>↑</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: index === total-1 ? 'not-allowed' : 'pointer', opacity: index === total-1 ? .4 : 1, fontSize: 12 }}>↓</button>
          <button onClick={() => onDelete(index)} style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--danger)' }}>×</button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Texto de la pregunta</label>
            <textarea
              value={pregunta.texto}
              onChange={e => onUpdate({ ...pregunta, texto: e.target.value })}
              placeholder="Escribí la pregunta..."
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Tipo de pregunta</label>
              <select
                value={pregunta.tipo}
                onChange={e => onUpdate({ ...pregunta, tipo: e.target.value, opciones: TIPOS_CON_OPCIONES.includes(e.target.value) ? (pregunta.opciones || []) : [] })}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={pregunta.requerida} onChange={e => onUpdate({ ...pregunta, requerida: e.target.checked })} />
                Requerida
              </label>
            </div>
          </div>

          {tieneOpciones && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--ink2)' }}>Opciones</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(pregunta.opciones || []).map((op, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, width: 20, textAlign: 'center' }}>{String.fromCharCode(65+i)}</span>
                    <input
                      value={op.texto}
                      onChange={e => updateOpcion(i, e.target.value)}
                      placeholder={`Opción ${String.fromCharCode(65+i)}`}
                      style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}
                    />
                    <button onClick={() => removeOpcion(i)} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', color: 'var(--danger)', fontSize: 14 }}>×</button>
                  </div>
                ))}
                <button onClick={addOpcion} style={{ padding: '8px 14px', border: '1.5px dashed var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent2)', fontWeight: 600, fontFamily: 'DM Sans', marginTop: 4 }}>
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

  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [meta, setMeta] = useState({
    nombre: '',
    descripcion: '',
    pedido_por: '',
    estado_produccion: 'pendiente',
  })

  const [preguntas, setPreguntas] = useState([])

  useEffect(() => {
    supabase.from('organizaciones').select('id, nombre').order('nombre').then(({ data }) => setOrgs(data || []))
    if (id) loadEncuesta()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEncuesta() {
    setLoading(true)
    const { data: enc } = await supabase
      .from('encuestas')
      .select('*, preguntas(*, opciones_pregunta(*))')
      .eq('id', id)
      .single()

    if (enc) {
      setMeta({
        nombre: enc.nombre || '',
        descripcion: enc.descripcion || '',
        pedido_por: enc.pedido_por || '',
        estado_produccion: enc.estado_produccion || 'pendiente',
      })
      const pqs = (enc.preguntas || [])
        .sort((a, b) => a.orden - b.orden)
        .map(p => ({
          ...p,
          opciones: (p.opciones_pregunta || []).sort((a, b) => a.orden - b.orden),
        }))
      setPreguntas(pqs)
    }
    setLoading(false)
  }

  function addPregunta() {
    setPreguntas(prev => [...prev, {
      _tempId: Date.now(),
      texto: '',
      tipo: 'opcion_multiple',
      requerida: true,
      orden: prev.length + 1,
      opciones: [],
    }])
  }

  function updatePregunta(index, updated) {
    setPreguntas(prev => prev.map((p, i) => i === index ? updated : p))
  }

  function deletePregunta(index) {
    setPreguntas(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, orden: i + 1 })))
  }

  function movePregunta(index, direction) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= preguntas.length) return
    const updated = [...preguntas]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setPreguntas(updated.map((p, i) => ({ ...p, orden: i + 1 })))
  }

  async function handleSave() {
    if (!meta.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')

    try {
      let encuestaId = id

      if (isEditing) {
        const { error: e } = await supabase.from('encuestas').update({
          nombre: meta.nombre,
          descripcion: meta.descripcion || null,
          pedido_por: meta.pedido_por || null,
          estado_produccion: meta.estado_produccion,
        }).eq('id', id)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('encuestas').insert({
          nombre: meta.nombre,
          descripcion: meta.descripcion || null,
          pedido_por: meta.pedido_por || null,
          estado_produccion: meta.estado_produccion,
          organizacion_id: meta.pedido_por || null,
        }).select().single()
        if (e) throw e
        encuestaId = data.id
      }

      // Delete existing preguntas if editing
      if (isEditing) {
        await supabase.from('preguntas').delete().eq('encuesta_id', encuestaId)
      }

      // Insert preguntas
      for (let i = 0; i < preguntas.length; i++) {
        const p = preguntas[i]
        const { data: pData, error: pErr } = await supabase.from('preguntas').insert({
          encuesta_id: encuestaId,
          texto: p.texto,
          tipo: p.tipo,
          requerida: p.requerida,
          orden: i + 1,
        }).select().single()
        if (pErr) throw pErr

        // Insert opciones
        if (p.opciones?.length > 0) {
          const { error: oErr } = await supabase.from('opciones_pregunta').insert(
            p.opciones.map((o, j) => ({ pregunta_id: pData.id, texto: o.texto, orden: j + 1 }))
          )
          if (oErr) throw oErr
        }
      }

      navigate('/superadmin/encuestas')
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 40 }}><Spinner center size="lg" /></div>

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin / Encuestas</div>
          <h1 className="sa-title">{isEditing ? 'Editar encuesta' : 'Nueva encuesta'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/superadmin/encuestas')}
            style={{ padding: '10px 20px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear encuesta'}
          </button>
        </div>
      </div>

      <div className="sa-content">
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="sa-card" style={{ padding: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Información</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Nombre *</label>
                  <input value={meta.nombre} onChange={e => setMeta(m => ({ ...m, nombre: e.target.value }))} placeholder="Nombre de la encuesta"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Descripción</label>
                  <textarea value={meta.descripcion} onChange={e => setMeta(m => ({ ...m, descripcion: e.target.value }))} placeholder="Descripción breve..." rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Organización (cliente)</label>
                  <select value={meta.pedido_por} onChange={e => setMeta(m => ({ ...m, pedido_por: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
                    <option value="">Sin asignar</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--ink2)' }}>Estado de producción</label>
                  <select value={meta.estado_produccion} onChange={e => setMeta(m => ({ ...m, estado_produccion: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="para_revisar">Para revisar</option>
                    <option value="publicada">Publicada</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sa-card" style={{ padding: 16 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Resumen</div>
              <div style={{ fontSize: 13, color: 'var(--ink2)' }}>{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}</div>
              {preguntas.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.entries(
                    preguntas.reduce((acc, p) => { acc[p.tipo] = (acc[p.tipo] || 0) + 1; return acc }, {})
                  ).map(([tipo, count]) => (
                    <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--ink3)' }}>{TIPOS.find(t => t.value === tipo)?.label}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preguntas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)' }}>{error}</div>
            )}

            {preguntas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', color: 'var(--ink3)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Sin preguntas todavía</div>
                <div style={{ fontSize: 13 }}>Hacé clic en "Agregar pregunta" para empezar</div>
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

            <button onClick={addPregunta}
              style={{ padding: '14px', border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--accent2)', fontWeight: 600, fontFamily: 'DM Sans', transition: 'all .15s' }}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--accent-light)' }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'none' }}
            >
              + Agregar pregunta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}