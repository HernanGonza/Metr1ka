import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner, Badge } from '../../components/ui'

const ROL_BADGE  = { superadmin: 'danger', admin: 'admin', gestor: 'info', coordinador: 'coordinador', encuestador: 'encuestador', editor: 'info' }
const ROL_LABELS = { superadmin: 'Superadmin', admin: 'Admin', gestor: 'Gestor', coordinador: 'Coordinador', encuestador: 'Encuestador', editor: 'Editor' }

function InviteModal({ orgs, onClose, onSaved }) {
  const [form, setForm] = useState({ email: '', rol: 'admin', organizacion_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const needsOrg = ['admin', 'coordinador', 'encuestador'].includes(form.rol)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    console.log('session token:', session?.access_token?.substring(0, 20))

    if (!session) {
      setError('No hay sesión activa')
      setSaving(false)
      return
    }

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`
    console.log('Calling:', functionUrl)

    let res, json
    try {
      res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: form.email,
          rol: form.rol,
          organizacion_id: needsOrg ? form.organizacion_id : null,
          redirect_to: `${window.location.origin}/set-password`,
        }),
      })
      console.log('res status:', res.status)
      json = await res.json()
      console.log('res json:', json)
    } catch (fetchErr) {
      console.error('fetch error:', fetchErr)
      setError('Error de red: ' + fetchErr.message)
      setSaving(false)
      return
    }

    if (!res.ok || json.error) {
      setError(json.error || 'Error al enviar la invitación')
      setSaving(false)
      return
    }

    setSent(true)
    setSaving(false)
    setTimeout(() => { onSaved(); onClose() }, 1500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r2)', width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700 }}>Invitar usuario</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink3)' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
              <div style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invitación enviada</div>
              <div style={{ fontSize: 14, color: 'var(--ink2)' }}>Le llegará un email a <strong>{form.email}</strong></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="usuario@email.com"
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Rol</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value, organizacion_id: '' }))}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                  <option value="admin">Admin (cliente)</option>
                  <option value="gestor">Gestor</option>
                  <option value="coordinador">Coordinador</option>
                  <option value="encuestador">Encuestador</option>
                  <option value="editor">Editor (Enfoque)</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              {needsOrg && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Organización</label>
                  <select value={form.organizacion_id} onChange={e => setForm(f => ({ ...f, organizacion_id: e.target.value }))} required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans' }}>
                    <option value="">Seleccionar organización</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                  </select>
                </div>
              )}
              {error && <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={onClose} style={{ padding: '10px 20px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
                  {saving ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const [searchParams] = useSearchParams()
  const [usuarios, setUsuarios] = useState([])
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRol, setFilterRol] = useState('todos')
  const [filterOrg, setFilterOrg] = useState(searchParams.get('org') || 'todas')

  async function fetchData() {
    setLoading(true)
    const [usuariosRes, orgsRes] = await Promise.all([
      supabase.from('perfiles').select(`
        id, rol, nombre_completo, activo, creado_en, perfil_completo, email,
        organizaciones(id, nombre)
      `).order('creado_en', { ascending: false }),
      supabase.from('organizaciones').select('id, nombre').order('nombre'),
    ])
    setUsuarios(usuariosRes.data || [])
    setOrgs(orgsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    async function load() { await fetchData() }
    load()
  }, [])

  async function toggleActivo(u) {
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id)
    await fetchData()
  }

  const filtered = usuarios.filter(u => {
    const matchSearch = !search || u.nombre_completo?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRol = filterRol === 'todos' || u.rol === filterRol
    const matchOrg = filterOrg === 'todas' || u.organizaciones?.id === filterOrg
    return matchSearch && matchRol && matchOrg
  })

  return (
    <div className="sa-page">
      {showInvite && <InviteModal orgs={orgs} onClose={() => setShowInvite(false)} onSaved={fetchData} />}

      <div className="sa-topbar">
        <div className="sa-topbar-left">
          <div className="sa-eyebrow">Superadmin</div>
          <h1 className="sa-title">Usuarios</h1>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans' }}>
          + Invitar usuario
        </button>
      </div>

      <div className="sa-content">
        <div className="sa-card">
          <div className="sa-card-header">
            <div className="sa-card-title">{filtered.length} usuarios</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', width: 180, fontFamily: 'DM Sans' }} />
              <select value={filterRol} onChange={e => setFilterRol(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
                <option value="todos">Todos los roles</option>
                <option value="superadmin">Superadmin</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
                <option value="coordinador">Coordinador</option>
                <option value="encuestador">Encuestador</option>
              </select>
              <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans' }}>
                <option value="todas">Todas las orgs</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
          </div>

          {loading ? <div style={{ padding: 40 }}><Spinner center /></div> : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Organización</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                  <th>Alta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {(u.nombre_completo || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre_completo || <span style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>Sin nombre</span>}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 1 }}>{u.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'monospace' }}>{u.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant={ROL_BADGE[u.rol] || 'neutral'} small>{ROL_LABELS[u.rol] || u.rol}</Badge></td>
                    <td><span style={{ fontSize: 13 }}>{u.organizaciones?.nombre || <span style={{ color: 'var(--ink3)' }}>—</span>}</span></td>
                    <td><Badge variant={u.perfil_completo ? 'success' : 'warning'} small>{u.perfil_completo ? 'Completo' : 'Pendiente'}</Badge></td>
                    <td><Badge variant={u.activo ? 'success' : 'neutral'} small>{u.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td><span style={{ fontSize: 12, color: 'var(--ink3)' }}>{new Date(u.creado_en).toLocaleDateString('es-AR')}</span></td>
                    <td>
                      <button onClick={() => toggleActivo(u)}
                        style={{ padding: '5px 10px', background: u.activo ? '#fdecea' : 'var(--accent-light)', color: u.activo ? 'var(--danger)' : 'var(--accent2)', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans', fontWeight: 600 }}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}