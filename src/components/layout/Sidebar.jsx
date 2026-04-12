import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { Avatar } from '../ui'
import styles from './Sidebar.module.css'
import LogoMetr1ka from '../../assets/LogoMetr1ka.svg'
import {
  LayoutDashboard, Map, FileText, Users, UserCheck, User,
  BarChart2, Settings, CreditCard, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, Menu
} from 'lucide-react'

const NAV_ADMIN = [
  { group: 'Principal', items: [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/mapa',          icon: Map,             label: 'Mapa en vivo' },
  ]},
  { group: 'Gestión', items: [
    { to: '/encuestas',     icon: FileText,        label: 'Encuestas' },
    { to: '/equipos',       icon: Users,           label: 'Equipos' },
    { to: '/coordinadores', icon: UserCheck,       label: 'Coordinadores' },
    { to: '/encuestadores', icon: User,            label: 'Encuestadores' },
  ]},
  { group: 'Herramientas', items: [
    { to: '/reportes',      icon: BarChart2,       label: 'Reportes' },
    { to: '/configuracion', icon: Settings,        label: 'Configuración' },
    { to: '/suscripcion',   icon: CreditCard,      label: 'Suscripción' },
  ]},
]

const NAV_GESTOR = [
  { group: 'Principal', items: [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/mapa',          icon: Map,             label: 'Mapa en vivo' },
  ]},
  { group: 'Gestión', items: [
    { to: '/encuestas',     icon: FileText,        label: 'Encuestas' },
    { to: '/equipos',       icon: Users,           label: 'Equipos' },
    { to: '/coordinadores', icon: UserCheck,       label: 'Coordinadores' },
    { to: '/encuestadores', icon: User,            label: 'Encuestadores' },
  ]},
  { group: 'Herramientas', items: [
    { to: '/reportes',      icon: BarChart2,       label: 'Reportes' },
    { to: '/configuracion', icon: Settings,        label: 'Configuración' },
  ]},
]

const NAV_COORDINADOR = [
  { group: 'Principal', items: [
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/mapa',          icon: Map,             label: 'Mapa en vivo' },
  ]},
  { group: 'Mi equipo', items: [
    { to: '/equipo',        icon: Users,           label: 'Mi equipo' },
    { to: '/encuestas',     icon: FileText,        label: 'Encuestas' },
  ]},
]

export function Sidebar() {
  const { perfil, rol, organizacion, signOut } = useAuth()
  const { theme, toggle, isDark } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = rol === 'coordinador' ? NAV_COORDINADOR : rol === 'gestor' ? NAV_GESTOR : NAV_ADMIN

  const initials = perfil
    ? (perfil.nombre_completo || '').split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
    : '?'

  async function handleSignOut() {
    await signOut(); navigate('/')
  }

  function toggleCollapse() {
    setCollapsed(c => {
      const next = !c
      document.documentElement.setAttribute('data-sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }

  const sidebarClass = [
    styles.sidebar,
    collapsed ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* Mobile hamburger */}
      <button className={styles.mobileToggle} onClick={() => setMobileOpen(o => !o)}>
        <Menu size={20} />
      </button>

      {/* Overlay mobile */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}

      <aside className={sidebarClass}>
        <div className={styles.brand}>
          {organizacion?.logo_url
            ? <img src={organizacion.logo_url} alt={organizacion.nombre} className={styles.orgLogo} />
            : <img src={LogoMetr1ka} alt="Metr1ka" className={styles.logo} />
          }
          <button
            className={styles.collapseBtn}
            onClick={toggleCollapse}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <nav className={styles.nav}>
          {nav.map(({ group, items }) => (
            <div key={group} className={styles.group}>
              {!collapsed && <div className={styles.groupLabel}>{group}</div>}
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => [styles.item, isActive ? styles.active : ''].join(' ')}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={17} strokeWidth={2} className={styles.icon} />
                  {!collapsed && <span className={styles.label}>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          {!collapsed && (
            <div className={styles.userBlock}>
              <Avatar initials={initials} src={perfil?.foto_url} size="sm" />
              <div className={styles.userInfo}>
                <div className={styles.userName}>{perfil?.nombre_completo || 'Usuario'}</div>
                <div className={styles.userRole}>{rol}</div>
              </div>
            </div>
          )}
          <div className={styles.footerActions}>
            <button className={styles.iconBtn} onClick={toggle} title={isDark ? 'Modo claro' : 'Modo oscuro'}>
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button className={styles.iconBtn} onClick={handleSignOut} title="Cerrar sesión">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}