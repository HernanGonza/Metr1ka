import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

const COLS = [
  { key: 'pendiente',    label: 'Pendientes',   color: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
  { key: 'en_proceso',   label: 'En proceso',   color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
  { key: 'para_revisar', label: 'Para revisar', color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' },
  { key: 'publicada',    label: 'Publicadas',   color: '#1a472a', bg: '#d8f3dc', border: '#86efac' },
]

const PASOS = {
  pendiente:    ['en_proceso'],
  en_proceso:   ['para_revisar', 'pendiente'],
  para_revisar: ['publicada', 'en_proceso'],
  publicada:    ['en_proceso'],
}

export default function Encuestas() {
  const [encuestas, setEncuestas]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOver, setDragOver]     = useState(null)
  const navigate = useNavigate()

  async function fetchData() {
    setLoading(true)
    // Sin join a preguntas(count) — causa timeout por RLS
    const { data, error } = await supabase
      .from('encuestas')
      .select('id, nombre, descripcion, estado_produccion, creado_en, organizacion_id, org:organizaciones!organizacion_id(nombre, color_primario)')
      .order('creado_en', { ascending: false })
    if (error) console.error('fetchData error:', error)
    setEncuestas(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function moveEncuesta(id, nuevoEstado) {
    setEncuestas(prev => prev.map(e => e.id === id ? { ...e, estado_produccion: nuevoEstado } : e))
    setDraggingId(null)
    await supabase.from('encuestas').update({ estado_produccion: nuevoEstado }).eq('id', id)
  }

  function onDragStart(e, enc) { setDraggingId(enc.id); e.dataTransfer.effectAllowed = 'move' }
  function onDragEnd() { setDraggingId(null); setDragOver(null) }
  function onDragOver(e, key) { e.preventDefault(); setDragOver(key) }
  function onDrop(e, key) {
    e.preventDefault()
    const enc = encuestas.find(e => e.id === draggingId)
    if (enc && enc.estado_produccion !== key) moveEncuesta(enc.id, key)
    else setDraggingId(null)
    setDragOver(null)
  }

  const byEstado = key => encuestas.filter(e => e.estado_produccion === key)

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin</div>
          <h1 className="sa-title">Encuestas</h1>
        </div>
        <button
          onClick={() => navigate('/superadmin/encuestas/nueva')}
          style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
          + Nueva encuesta
        </button>
      </div>

      <div className="sa-content">
        {loading ? <Spinner center size="lg" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
            {COLS.map(col => (
              <div
                key={col.key}
                onDragOver={e => onDragOver(e, col.key)}
                onDrop={e => onDrop(e, col.key)}
                style={{
                  background: dragOver === col.key ? col.bg : 'var(--surface)',
                  borderRadius: 'var(--r2)',
                  border: `2px dashed ${dragOver === col.key ? col.border : 'transparent'}`,
                  transition: 'all .15s',
                  minHeight: 120,
                }}
              >
                <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 700, background: '#fff', padding: '1px 8px', borderRadius: 100 }}>
                    {byEstado(col.key).length}
                  </span>
                </div>
                <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byEstado(col.key).map(enc => (
                    <KanbanCard
                      key={enc.id}
                      enc={enc}
                      col={col}
                      isDragging={draggingId === enc.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onMove={moveEncuesta}
                      onClick={() => navigate(`/superadmin/encuestas/${enc.id}`)}
                    />
                  ))}
                  {byEstado(col.key).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--ink3)', fontSize: 12 }}>
                      Sin encuestas
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanCard({ enc, col, isDragging, onDragStart, onDragEnd, onMove, onClick }) {
  const pasos = PASOS[enc.estado_produccion] || []
  const esPendiente = enc.estado_produccion === 'pendiente'

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, enc)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: '#fff',
        border: `1px solid ${esPendiente ? '#fcd34d' : 'var(--border)'}`,
        borderRadius: 'var(--r)',
        padding: 12,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? .3 : 1,
        transition: 'opacity .1s, box-shadow .15s',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,.06)',
        userSelect: 'none',
      }}
    >
      {esPendiente && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 800, background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: 100, letterSpacing: .5, textTransform: 'uppercase' }}>
            Nueva solicitud
          </span>
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, lineHeight: 1.3 }}>{enc.nombre}</div>
      {enc.org && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: enc.org.color_primario || 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{enc.org.nombre}</span>
        </div>
      )}
      {enc.descripcion && (
        <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.4 }}>
          {enc.descripcion.length > 70 ? enc.descripcion.substring(0, 70) + '…' : enc.descripcion}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--ink3)' }}>{new Date(enc.creado_en).toLocaleDateString('es-AR')}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {pasos.map(paso => {
          const dest = COLS.find(c => c.key === paso)
          if (!dest) return null
          return (
            <button key={paso} onClick={() => onMove(enc.id, paso)} style={{
              padding: '4px 9px', background: dest.bg, color: dest.color,
              border: `1px solid ${dest.border}`, borderRadius: 6,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans',
            }}>
              {paso === 'para_revisar' ? '📤 Enviar a revisión' :
               paso === 'publicada'    ? '✓ Publicar'          :
               paso === 'en_proceso'   ? '▶ Tomar'             :
               paso === 'pendiente'    ? '↩ Devolver'          : `→ ${dest.label}`}
            </button>
          )
        })}
      </div>
    </div>
  )
}