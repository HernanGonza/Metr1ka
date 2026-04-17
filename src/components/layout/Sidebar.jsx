import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { Avatar } from '../ui'
import styles from './Sidebar.module.css'
import {
  LayoutDashboard, Map, FileText, Users, UserCheck, User,
  BarChart2, Settings, CreditCard, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, Menu
} from 'lucide-react'

// Logo SVG inline — cambia de color según el tema
function LogoSvgPanel({ isDark }) {
  const color = isDark ? '#ffffff' : '#0a0a0a'
  const accent = '#52B788'
  return (
    <svg width="110" height="9" viewBox="0 0 751 62" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: 130, height: 'auto' }}>
      <path d="M76.224 54.144H61.824L114.24 0H138.24V61.44H114.24V19.584L121.44 22.56L83.52 61.44H54.72L16.704 22.656L24 19.68V61.44H0V0H24L76.224 54.144Z" fill={color}/>
      <path d="M174.727 35.52V43.2H247.688V61.44H150.727V0H247.495V18.24H174.727V25.92H234.247V35.52H174.727Z" fill={color}/>
      <path d="M255.334 0H355.174V18.24H255.334V0ZM293.254 16.992H317.254V61.44H293.254V16.992Z" fill={color}/>
      <path d="M363.776 61.44V0H437.984C443.808 0 449.024 0.672001 453.632 2.016C458.304 3.296 461.984 5.472 464.672 8.544C467.424 11.616 468.8 15.808 468.8 21.12C468.8 24.64 468.16 27.552 466.88 29.856C465.6 32.16 463.84 33.952 461.6 35.232C459.36 36.512 456.8 37.44 453.92 38.016C451.04 38.592 448.032 38.944 444.896 39.072L437.888 37.728C445.504 37.792 451.36 38.112 455.456 38.688C459.616 39.264 462.496 40.32 464.096 41.856C465.76 43.328 466.592 45.472 466.592 48.288V61.44H442.592V51.168C442.592 49.248 442.208 47.808 441.44 46.848C440.736 45.824 439.136 45.12 436.64 44.736C434.208 44.352 430.432 44.16 425.312 44.16H387.776V61.44H363.776ZM387.776 28.128H437.984C439.904 28.128 441.504 27.808 442.784 27.168C444.128 26.528 444.8 25.312 444.8 23.52C444.8 21.856 444.128 20.736 442.784 20.16C441.504 19.52 439.904 19.2 437.984 19.2H387.776V28.128Z" fill={color}/>
      <path d="M476.809 32.64V14.4H518.473V61.44H495.433V32.64H476.809Z" fill={accent}/>
      <path d="M582.149 31.2V25.824L637.541 61.44H601.829L554.789 28.8L598.181 0H632.357L582.149 31.2ZM530.981 0H554.981V61.44H530.981V0Z" fill={color}/>
      <path d="M662.39 52.128V37.728H728.054V52.128H662.39ZM640.886 61.44L682.07 0H708.758L750.326 61.44H723.926L688.31 6.432H702.614L667.286 61.44H640.886Z" fill={color}/>
    </svg>
  )
}


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
            : <LogoSvgPanel isDark={isDark} />
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