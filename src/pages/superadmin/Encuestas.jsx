import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner, Badge } from '../../components/ui'

const ESTADOS = [
  { key: 'pendiente',    label: 'Pendientes',    color: '#b45309', bg: '#fef3c7', border: '#fed7aa' },
  { key: 'en_proceso',   label: 'En proceso',    color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  { key: 'para_revisar', label: 'Para revisar',  color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  { key: 'publicada',    label: 'Publicadas',    color: '#1a472a', bg: '#d8f3dc', border: '#bbf7d0' },
]

export default function Encuestas() {
  const [encuestas, setEncuestas] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const navigate = useNavigate()

  async function fetchData() {
    setLoading(true)
    const { data: encData } = await supabase.from('encuestas').select(`
        id, nombre, descripcion, estado_produccion, activo, creado_en,
        organizaciones:pedido_por(nombre),
        preguntas(count)
      `).order('creado_en', { ascending: false })
    setEncuestas(encData || [])
    setLoading(false)
  }

  useEffect(() => {
    async function load() { await fetchData() }
    load()
  }, [])

  async function moveEncuesta(id, nuevoEstado) {
    setEncuestas(prev => prev.map(e => e.id === id ? { ...e, estado_produccion: nuevoEstado } : e))
    await supabase.from('encuestas').update({ estado_produccion: nuevoEstado }).eq('id', id)
  }

  // Drag handlers
  function onDragStart(e, encuesta) {
    setDragging(encuesta)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }
  function onDragOver(e, estado) { e.preventDefault(); setDragOver(estado) }
  function onDrop(e, estado) {
    e.preventDefault()
    if (dragging && dragging.estado_produccion !== estado) {
      moveEncuesta(dragging.id, estado)
    }
    setDragOver(null)
  }

  const byEstado = (estado) => encuestas.filter(e => e.estado_produccion === estado)

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
            {ESTADOS.map(col => (
              <div
                key={col.key}
                onDragOver={e => onDragOver(e, col.key)}
                onDrop={e => onDrop(e, col.key)}
                style={{
                  background: dragOver === col.key ? col.bg : 'var(--surface)',
                  borderRadius: 'var(--r2)',
                  border: `2px dashed ${dragOver === col.key ? col.border : 'transparent'}`,
                  transition: 'all .15s',
                  minHeight: 200,
                }}
              >
                {/* Column header */}
                <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700 }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink3)', fontWeight: 600, background: '#fff', padding: '2px 8px', borderRadius: 100 }}>
                    {byEstado(col.key).length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byEstado(col.key).map(enc => (
                    <div
                      key={enc.id}
                      draggable
                      onDragStart={e => onDragStart(e, enc)}
                      onDragEnd={onDragEnd}
                      onClick={() => navigate(`/superadmin/encuestas/${enc.id}`)}
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--r)',
                        padding: 12,
                        cursor: dragging?.id === enc.id ? 'grabbing' : 'grab',
                        opacity: dragging?.id === enc.id ? .4 : 1,
                        transition: 'opacity .15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, lineHeight: 1.3 }}>{enc.nombre}</div>
                      {enc.organizaciones && (
                        <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8 }}>
                          🏢 {enc.organizaciones.nombre}
                        </div>
                      )}
                      {enc.descripcion && (
                        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8, lineHeight: 1.4 }}>
                          {enc.descripcion.substring(0, 80)}{enc.descripcion.length > 80 ? '...' : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
                          {enc.preguntas?.length || 0} preguntas
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink3)' }}>
                          {new Date(enc.creado_en).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      {/* Move buttons for mobile */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                        {ESTADOS.filter(e => e.key !== col.key).map(e => (
                          <button
                            key={e.key}
                            onClick={ev => { ev.stopPropagation(); moveEncuesta(enc.id, e.key) }}
                            style={{ padding: '3px 8px', background: e.bg, color: e.color, border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                            → {e.label.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {byEstado(col.key).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--ink3)', fontSize: 13 }}>
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