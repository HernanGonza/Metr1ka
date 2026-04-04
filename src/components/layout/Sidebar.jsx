import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Avatar } from '../ui'
import styles from './Sidebar.module.css'

const NAV_ADMIN = [
  { group: 'Principal',    items: [
    { to: '/dashboard',      icon: '📊', label: 'Dashboard' },
    { to: '/mapa',           icon: '🗺️', label: 'Mapa en vivo' },
  ]},
  { group: 'Gestión',      items: [
    { to: '/encuestas',      icon: '📋', label: 'Encuestas' },
    { to: '/equipos',        icon: '👥', label: 'Equipos' },
    { to: '/coordinadores',  icon: '👔', label: 'Coordinadores y Gestores' },
    { to: '/encuestadores',  icon: '👤', label: 'Encuestadores' },
  ]},
  { group: 'Herramientas', items: [
    { to: '/reportes',       icon: '📁', label: 'Reportes' },
    { to: '/configuracion',  icon: '⚙️', label: 'Configuración' },
    { to: '/suscripcion',    icon: '💳', label: 'Suscripción' },
  ]},
]

const NAV_GESTOR = [
  { group: 'Principal',    items: [
    { to: '/dashboard',      icon: '📊', label: 'Dashboard' },
    { to: '/mapa',           icon: '🗺️', label: 'Mapa en vivo' },
  ]},
  { group: 'Gestión',      items: [
    { to: '/encuestas',      icon: '📋', label: 'Encuestas' },
    { to: '/equipos',        icon: '👥', label: 'Equipos' },
    { to: '/coordinadores',  icon: '👔', label: 'Coordinadores' },
    { to: '/encuestadores',  icon: '👤', label: 'Encuestadores' },
  ]},
  { group: 'Herramientas', items: [
    { to: '/reportes',       icon: '📁', label: 'Reportes' },
    { to: '/configuracion',  icon: '⚙️', label: 'Configuración' },
  ]},
]

const NAV_COORDINADOR = [
  { group: 'Principal',    items: [
    { to: '/dashboard',      icon: '📊', label: 'Dashboard' },
    { to: '/mapa',           icon: '🗺️', label: 'Mapa en vivo' },
  ]},
  { group: 'Mi equipo',    items: [
    { to: '/equipo',         icon: '👥', label: 'Mi equipo' },
    { to: '/encuestas',      icon: '📋', label: 'Encuestas' },
  ]},
]

export function Sidebar() {
  const { perfil, rol, organizacion, signOut } = useAuth()
  const navigate = useNavigate()

  const nav = rol === 'coordinador' ? NAV_COORDINADOR : rol === 'gestor' ? NAV_GESTOR : NAV_ADMIN

  const initials = perfil
    ? (perfil.nombre_completo || '').split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        {organizacion?.logo_url
          ? <img src={organizacion.logo_url} alt={organizacion.nombre} className={styles.logo} />
          : <div className={styles.brandName}>
              <img src="src/assets/LogoMetr1ka.svg" alt="Metr1ka" />
            </div>
        }
      </div>

      <nav className={styles.nav}>
        {nav.map(({ group, items }) => (
          <div key={group} className={styles.group}>
            <div className={styles.groupLabel}>{group}</div>
            {items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [styles.item, isActive ? styles.active : ''].join(' ')
                }
              >
                <span className={styles.icon}>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <Avatar initials={initials} src={perfil?.foto_url} size="sm" />
        <div className={styles.userInfo}>
          <div className={styles.userName}>{perfil?.nombre_completo || 'Usuario'}</div>
          <div className={styles.userRole}>{rol}</div>
        </div>
        <button className={styles.signOut} onClick={handleSignOut} title="Cerrar sesión">
          ↩
        </button>
      </div>
    </aside>
  )
}