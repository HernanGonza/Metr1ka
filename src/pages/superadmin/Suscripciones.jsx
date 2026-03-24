import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner, Badge } from '../../components/ui'

const PLAN_LABELS  = { arranque: 'Arranque', estandar: 'Estándar', territorio: 'Territorio' }
const ESTADO_BADGE = { activa: 'success', vencida: 'danger', suspendida: 'warning', trial: 'info' }
const ESTADO_LABELS= { activa: 'Activa', vencida: 'Vencida', suspendida: 'Suspendida', trial: 'Trial' }

function EditModal({ susc, org, onClose, onSaved }) {
  const [form, setForm] = useState({
    plan: susc?.plan || 'arranque',
    estado: susc?.estado || 'trial',
    fecha_vencimiento: susc?.fecha_vencimiento || '',
    monto: susc?.monto || '',
    notas: susc?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('suscripciones')
      .upsert({
        organizacion_id: org.id,
        plan: form.plan,
        estado: form.estado,
        fecha_vencimiento: form.fecha_vencimiento || null,
        monto: form.monto ? parseFloat(form.monto) : null,
        notas: form.notas || null,
      }, { onConflict: 'organizacion_id' })
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 'var(--r2)', width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700 }}>Suscripción — {org.nombre}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink3)' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                  <option value="arranque">Arranque</option>
                  <option value="estandar">Estándar</option>
                  <option value="territorio">Territorio</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                  <option value="trial">Trial</option>
                  <option value="activa">Activa</option>
                  <option value="vencida">Vencida</option>
                  <option value="suspendida">Suspendida</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Vencimiento</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Monto (ARS)</label>
                <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00"
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notas internas</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={3} placeholder="Notas, referencias de pago, etc."
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans', resize: 'vertical' }} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans' }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Suscripciones() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // { susc, org }
  const [filterEstado, setFilterEstado] = useState('todas')

  async function fetchData() {
    setLoading(true)
    const { data: orgs } = await supabase
      .from('organizaciones')
      .select('id, nombre, color_primario, activo, suscripciones(plan, estado, fecha_vencimiento, monto, notas)')
      .order('nombre')
    setData(orgs || [])
    setLoading(false)
  }

  useEffect(() => {
    async function load() { await fetchData() }
    load()
  }, [])

  const hoy = new Date()
  function diasRestantes(fecha) {
    if (!fecha) return null
    const diff = new Date(fecha) - hoy
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const filtered = data.filter(o => {
    const susc = o.suscripciones?.[0]
    if (filterEstado === 'todas') return true
    return susc?.estado === filterEstado
  })

  const stats = {
    activas:    data.filter(o => o.suscripciones?.[0]?.estado === 'activa').length,
    trial:      data.filter(o => o.suscripciones?.[0]?.estado === 'trial').length,
    vencidas:   data.filter(o => o.suscripciones?.[0]?.estado === 'vencida').length,
    suspendidas:data.filter(o => o.suscripciones?.[0]?.estado === 'suspendida').length,
  }

  return (
    <div className="sa-page">
      {editing && (
        <EditModal
          susc={editing.org.suscripciones?.[0]}
          org={editing.org}
          onClose={() => setEditing(null)}
          onSaved={fetchData}
        />
      )}

      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin</div>
          <h1 className="sa-title">Suscripciones</h1>
        </div>
      </div>

      <div className="sa-content">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Activas',     value: stats.activas,     color: '#1a472a', bg: '#d8f3dc' },
            { label: 'Trial',       value: stats.trial,       color: '#0369a1', bg: '#e0f2fe' },
            { label: 'Vencidas',    value: stats.vencidas,    color: '#c0392b', bg: '#fdecea' },
            { label: 'Suspendidas', value: stats.suspendidas, color: '#b45309', bg: '#fef3c7' },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 'var(--r2)', padding: '16px 20px', cursor: 'pointer' }} onClick={() => setFilterEstado(s.label.toLowerCase() === 'activas' ? 'activa' : s.label.toLowerCase().replace('s',''))}>
              <div style={{ fontFamily: 'Syne', fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: s.color, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="sa-card">
          <div className="sa-card-header">
            <div className="sa-card-title">{filtered.length} organizaciones</div>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
              <option value="todas">Todos los estados</option>
              <option value="activa">Activa</option>
              <option value="trial">Trial</option>
              <option value="vencida">Vencida</option>
              <option value="suspendida">Suspendida</option>
            </select>
          </div>

          {loading ? <div style={{ padding: 40 }}><Spinner center /></div> : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Días restantes</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(org => {
                  const susc = org.suscripciones?.[0]
                  const dias = diasRestantes(susc?.fecha_vencimiento)
                  return (
                    <tr key={org.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: org.color_primario || 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{org.nombre}</span>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 13, fontWeight: 600 }}>{PLAN_LABELS[susc?.plan] || '—'}</span></td>
                      <td>{susc ? <Badge variant={ESTADO_BADGE[susc.estado]} small>{ESTADO_LABELS[susc.estado]}</Badge> : <span style={{ color: 'var(--ink3)', fontSize: 12 }}>—</span>}</td>
                      <td><span style={{ fontSize: 13 }}>{susc?.fecha_vencimiento ? new Date(susc.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</span></td>
                      <td>
                        {dias !== null ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: dias < 0 ? 'var(--danger)' : dias < 7 ? '#b45309' : 'var(--ink2)' }}>
                            {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : dias === 0 ? 'Hoy' : `${dias} días`}
                          </span>
                        ) : <span style={{ color: 'var(--ink3)', fontSize: 12 }}>—</span>}
                      </td>
                      <td><span style={{ fontSize: 13 }}>{susc?.monto ? `$${Number(susc.monto).toLocaleString('es-AR')}` : '—'}</span></td>
                      <td>
                        <button onClick={() => setEditing({ org })}
                          style={{ padding: '5px 12px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600 }}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}