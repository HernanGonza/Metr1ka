import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner, Badge } from '../../components/ui'

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink3)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

const PLAN_LABELS = { arranque: 'Arranque', estandar: 'Estándar', territorio: 'Territorio' }
const ESTADO_LABELS = { activa: 'Activa', vencida: 'Vencida', suspendida: 'Suspendida', trial: 'Trial' }
const ESTADO_BADGE = { activa: 'success', vencida: 'danger', suspendida: 'warning', trial: 'info' }

const EMPTY_FORM = { nombre: '', color_primario: '#1a472a', plan: 'arranque', estado_suscripcion: 'trial', fecha_vencimiento: '' }

export default function Organizaciones() {
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nueva' | {id, ...org}
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchOrgs() }, [])

  async function fetchOrgs() {
    setLoading(true)

    const { data: orgsData, error: orgsError } = await supabase
      .from('organizaciones')
      .select('*, suscripciones!suscripciones_organizacion_id_fkey(plan, estado, fecha_vencimiento)')
      .order('creado_en', { ascending: false })

    // Contar usuarios por organización por separado
    const { data: perfilesData } = await supabase
      .from('perfiles')
      .select('organizacion_id')
      .not('organizacion_id', 'is', null)

    const conteoPerfiles = (perfilesData || []).reduce((acc, p) => {
      acc[p.organizacion_id] = (acc[p.organizacion_id] || 0) + 1
      return acc
    }, {})

    const orgsConConteo = (orgsData || []).map(org => ({
      ...org,
      // Supabase devuelve objeto (no array) por el unique constraint en organizacion_id
      suscripcion: Array.isArray(org.suscripciones) ? org.suscripciones[0] : org.suscripciones,
      usuarios_count: conteoPerfiles[org.id] || 0,
    }))

    setOrgs(orgsConConteo)
    setLoading(false)
  }

  function openNueva() {
    setForm(EMPTY_FORM)
    setError('')
    setModal('nueva')
  }

  function openEditar(org) {
    const susc = org.suscripcion
    setForm({
      nombre: org.nombre || '',
      color_primario: org.color_primario || '#1a472a',
      plan: susc?.plan || 'arranque',
      estado_suscripcion: susc?.estado || 'trial',
      fecha_vencimiento: susc?.fecha_vencimiento || '',
    })
    setError('')
    setModal(org)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (modal === 'nueva') {
        // Create org
        const { data: orgData, error: orgErr } = await supabase
          .from('organizaciones')
          .insert({ nombre: form.nombre, color_primario: form.color_primario })
          .select()
          .single()
        if (orgErr) throw orgErr

        // Create subscription
        const { error: suscErr } = await supabase
          .from('suscripciones')
          .insert({
            organizacion_id: orgData.id,
            plan: form.plan,
            estado: form.estado_suscripcion,
            fecha_vencimiento: form.fecha_vencimiento || null,
          })
        if (suscErr) throw suscErr
      } else {
        // Update org
        const { error: orgErr } = await supabase
          .from('organizaciones')
          .update({ nombre: form.nombre, color_primario: form.color_primario })
          .eq('id', modal.id)
        if (orgErr) throw orgErr

        // Upsert subscription
        const { error: suscErr } = await supabase
          .from('suscripciones')
          .upsert({
            organizacion_id: modal.id,
            plan: form.plan,
            estado: form.estado_suscripcion,
            fecha_vencimiento: form.fecha_vencimiento || null,
          }, { onConflict: 'organizacion_id' })
        if (suscErr) throw suscErr
      }

      await fetchOrgs()
      setModal(null)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function toggleActivo(org) {
    await supabase.from('organizaciones').update({ activo: !org.activo }).eq('id', org.id)
    await fetchOrgs()
  }

  const filtered = orgs.filter(o => o.nombre?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="sa-page">
      {modal && (
        <Modal title={modal === 'nueva' ? 'Nueva organización' : 'Editar organización'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Nombre de la organización"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Color primario</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="color" name="color_primario" value={form.color_primario} onChange={handleChange}
                  style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                <input name="color_primario" value={form.color_primario} onChange={handleChange}
                  style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, monospace' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Plan</label>
                <select name="plan" value={form.plan} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                  <option value="arranque">Arranque</option>
                  <option value="estandar">Estándar</option>
                  <option value="territorio">Territorio</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Estado suscripción</label>
                <select name="estado_suscripcion" value={form.estado_suscripcion} onChange={handleChange}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                  <option value="trial">Trial</option>
                  <option value="activa">Activa</option>
                  <option value="vencida">Vencida</option>
                  <option value="suspendida">Suspendida</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Vencimiento suscripción</label>
              <input type="date" name="fecha_vencimiento" value={form.fecha_vencimiento} onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => setModal(null)} style={{ padding: '10px 20px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: saving ? 'var(--accent2)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin</div>
          <h1 className="sa-title">Organizaciones</h1>
        </div>
        <button onClick={openNueva}
          style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
          + Nueva organización
        </button>
      </div>

      <div className="sa-content">
        <div className="sa-card">
          <div className="sa-card-header">
            <div className="sa-card-title">{orgs.length} organizaciones</div>
            <input
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', width: 200, fontFamily: 'DM Sans' }}
            />
          </div>

          {loading ? <div style={{ padding: 40 }}><Spinner center /></div> : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Organización</th>
                  <th>Plan</th>
                  <th>Suscripción</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Usuarios</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(org => {
                  const susc = org.suscripcion
                  return (
                    <tr key={org.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: org.color_primario || 'var(--accent)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{org.nombre}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'monospace' }}>{org.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>
                          {PLAN_LABELS[susc?.plan] || '—'}
                        </span>
                      </td>
                      <td>
                        {susc ? <Badge variant={ESTADO_BADGE[susc.estado]} small>{ESTADO_LABELS[susc.estado]}</Badge> : <span style={{ color: 'var(--ink3)', fontSize: 12 }}>Sin suscripción</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>
                          {susc?.fecha_vencimiento ? new Date(susc.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}
                        </span>
                      </td>
                      <td>
                        <Badge variant={org.activo ? 'success' : 'neutral'} small>
                          {org.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 500 }}>{org.usuarios_count}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditar(org)}
                            style={{ padding: '5px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans' }}>
                            Editar
                          </button>
                          <Link to={`/superadmin/usuarios?org=${org.id}`}
                            style={{ padding: '5px 10px', background: 'var(--accent-light)', color: 'var(--accent2)', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12, textDecoration: 'none', fontFamily: 'DM Sans', fontWeight: 600 }}>
                            Usuarios
                          </Link>
                          <button onClick={() => toggleActivo(org)}
                            style={{ padding: '5px 10px', background: org.activo ? '#fdecea' : 'var(--accent-light)', color: org.activo ? 'var(--danger)' : 'var(--accent2)', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600 }}>
                            {org.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
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