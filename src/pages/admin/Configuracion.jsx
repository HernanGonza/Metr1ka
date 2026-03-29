import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Configuracion() {
  const { perfil, rol } = useAuth()

  const ROL_LABELS = { admin: 'Admin', gestor: 'Gestor', coordinador: 'Coordinador', encuestador: 'Encuestador' }

  return (
    <div className={styles.page}>
      <Topbar title="Configuración" />
      <div className={styles.content}>
        <h2 style={{ fontFamily: 'Syne', fontSize: 18, fontWeight: 800, marginBottom: 16, letterSpacing: -.5 }}>Mi cuenta</h2>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: 24 }}>
          {[
            { label: 'Nombre completo',  value: perfil?.nombre_completo },
            { label: 'Teléfono',         value: perfil?.telefono },
            { label: 'DNI',              value: perfil?.dni },
            { label: 'Organización',     value: perfil?.organizaciones?.nombre },
            { label: 'Rol',              value: ROL_LABELS[rol] || rol },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink3)' }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{item.value || '—'}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r2)', padding: '16px 20px', fontSize: 13, color: 'var(--ink3)' }}>
          Para modificar tus datos de perfil, contactá al administrador o escribinos a{' '}
          <a href="mailto:hola@metr1ka.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>hola@metr1ka.com</a>.
        </div>
      </div>
    </div>
  )
}