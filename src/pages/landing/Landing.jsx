import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, BarChart2, Smartphone, Users, Shield, Zap, ChevronUp, Menu, X, Sun, Moon, CheckCircle, ArrowRight, Mail, MessageSquare, Send, Globe, Clock, TrendingUp } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import Chart from 'chart.js/auto'
import styles from './Landing.module.css'
import LogoMetr1ka from '../../assets/LogoMetr1ka.svg'
import logoEnfoque from '../../assets/logo-enfoque.png'
import logoParalelo from '../../assets/logo-paralelo.webp'
import { SECTIONS, FLOW_STEPS, ROLES, PLANS, TESTIMONIALS, DASHBOARD_DATA } from './landingData'

/* ── Theme Toggle ── */
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className={styles.themeToggle}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {theme === 'dark'
        ? <Sun size={16} strokeWidth={2} />
        : <Moon size={16} strokeWidth={2} />
      }
    </button>
  )
}

/* ── Scroll to Top ── */
function ScrollToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 600)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!visible) return null
  return (
    <button
      className={styles.scrollTop}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Volver arriba"
    >
      <ChevronUp size={20} strokeWidth={2.5} />
    </button>
  )
}

/* ── Cookie Banner ── */
function CookieBanner() {
  const [visible, setVisible] = useState(() => !localStorage.getItem('metr1ka-cookies'))
  if (!visible) return null
  return (
    <div className={styles.cookieBanner}>
      <div className={styles.cookieContent}>
        <span>🍪 Usamos cookies para mejorar tu experiencia en Metr1ka.</span>
        <div className={styles.cookieBtns}>
          <button className={styles.cookieDecline} onClick={() => { localStorage.setItem('metr1ka-cookies', 'decline'); setVisible(false) }}>Rechazar</button>
          <button className={styles.cookieAccept} onClick={() => { localStorage.setItem('metr1ka-cookies', 'accept'); setVisible(false) }}>Aceptar</button>
        </div>
      </div>
    </div>
  )
}

/* ── Contact Modal ── */
function ContactModal({ onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre || !form.email || !form.mensaje) { setError('Completá todos los campos'); return }
    setSending(true); setError('')
    // Simular envío (en producción conectar con edge function o Resend)
    await new Promise(r => setTimeout(r, 1200))
    setSent(true)
    setSending(false)
  }

  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Hablemos</h3>
            <p className={styles.modalSub}>Te respondemos en menos de 24 horas</p>
          </div>
          <button className={styles.modalClose} onClick={onClose}><X size={20} /></button>
        </div>

        {sent ? (
          <div className={styles.modalSuccess}>
            <div className={styles.successIcon}>✓</div>
            <h4>¡Mensaje enviado!</h4>
            <p>Gracias por escribirnos. Te contactaremos a <strong>{form.email}</strong> a la brevedad.</p>
            <button className={styles.btnPrimary} onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Nombre *</label>
                <input placeholder="Tu nombre" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} />
              </div>
              <div className={styles.formGroup}>
                <label>Email *</label>
                <input type="email" placeholder="tu@email.com" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Mensaje *</label>
              <textarea rows={4} placeholder="Contanos sobre tu proyecto o consulta..." value={form.mensaje} onChange={e => setForm(f => ({...f, mensaje: e.target.value}))} />
            </div>
            {error && <div className={styles.formError}>{error}</div>}
            <div className={styles.formFooter}>
              <span className={styles.formNote}><Mail size={14} /> hola@metr1ka.com</span>
              <button type="submit" className={styles.btnPrimary} disabled={sending}>
                {sending ? 'Enviando...' : <><Send size={15} /> Enviar mensaje</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ── Nav ── */
function Nav({ active, onContact }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { theme, toggle, isDark } = useTheme()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <>
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <button className={styles.navBrand} onClick={() => scrollTo('inicio')}>
            <img src={LogoMetr1ka} alt="Metr1ka" className={styles.brandLogo}
              style={{ filter: isDark ? 'invert(1) brightness(2)' : 'none' }} />
          </button>

          <div className={styles.navTabs}>
            {SECTIONS.filter(s => s.id !== 'clientes').map(s => (
              <button key={s.id} className={`${styles.navTab} ${active === s.id ? styles.navTabActive : ''}`} onClick={() => scrollTo(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.navActions}>
            <ThemeToggle />
            <button className={styles.navContact} onClick={onContact}>Contacto</button>
            <Link to="/login" className={styles.navLogin}>Ingresar →</Link>
            <button className={styles.navHamburger} onClick={() => setMenuOpen(o => !o)} aria-label="Menú">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {SECTIONS.map(s => (
            <button key={s.id} className={styles.mobileMenuItem} onClick={() => scrollTo(s.id)}>{s.label}</button>
          ))}
          <div className={styles.mobileMenuDivider} />
          <button className={styles.mobileMenuContact} onClick={() => { onContact(); setMenuOpen(false) }}>Contacto</button>
          <Link to="/login" className={styles.mobileMenuLogin}>Ingresar →</Link>
        </div>
      )}
    </>
  )
}

/* ── Hero ── */
function Hero({ onContact }) {
  return (
    <section id="inicio" className={styles.hero}>
      <div className={styles.heroBg}>
        <div className={styles.heroBgGrad} />
        <div className={styles.heroBgGrid} />
      </div>
      <div className={styles.container}>
        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            Sistema de encuestas de campo
          </div>
          <h1 className={styles.heroH1}>
            Datos de campo<br />
            <em>en tiempo real.</em><br />
            Sin papel. Sin espera.
          </h1>
          <p className={styles.heroSub}>
            Metr1ka es la plataforma que conecta a tus encuestadores en campo con tu panel de análisis. Control de zonas, GPS en vivo y resultados al instante.
          </p>
          <div className={styles.heroBtns}>
            <button className={styles.btnPrimary} onClick={onContact}>
              <MessageSquare size={16} /> Solicitar demo
            </button>
            <button className={styles.btnOutline} onClick={() => document.getElementById('flujo')?.scrollIntoView({ behavior: 'smooth' })}>
              Ver cómo funciona <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className={styles.heroViz}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardDot} style={{ background: '#ef4444' }} />
              <div className={styles.heroCardDot} style={{ background: '#f59e0b' }} />
              <div className={styles.heroCardDot} style={{ background: '#22c55e' }} />
              <span className={styles.heroCardTitle}>Panel en vivo</span>
            </div>
            <div className={styles.heroCardBody}>
              <div className={styles.heroKpiRow}>
                {[
                  { label: 'Respuestas hoy', value: '412', icon: <BarChart2 size={14} />, color: '#1a472a' },
                  { label: 'En campo', value: '23', icon: <Users size={14} />, color: '#0369a1' },
                  { label: 'Zonas activas', value: '5', icon: <MapPin size={14} />, color: '#7c3aed' },
                ].map((k, i) => (
                  <div key={i} className={styles.heroKpi}>
                    <div className={styles.heroKpiIcon} style={{ color: k.color }}>{k.icon}</div>
                    <div className={styles.heroKpiVal} style={{ color: k.color }}>{k.value}</div>
                    <div className={styles.heroKpiLabel}>{k.label}</div>
                  </div>
                ))}
              </div>
              <HeroMiniMap />
              <div className={styles.heroEncuestadores}>
                {DASHBOARD_DATA.encuestadores.slice(0, 3).map((e, i) => (
                  <div key={i} className={styles.heroEnc}>
                    <div className={styles.heroEncAvatar} style={{ background: e.bg, color: e.tc }}>{e.initials}</div>
                    <div className={styles.heroEncInfo}>
                      <span className={styles.heroEncName}>{e.name}</span>
                      <span className={styles.heroEncCount}>{e.count} enc.</span>
                    </div>
                    <div className={`${styles.heroEncStatus} ${e.status === 'active' ? styles.heroEncActive : styles.heroEncIdle}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.heroStats}>
        {[
          { num: '10x', label: 'Más rápido que papel' },
          { num: '99%', label: 'Uptime garantizado' },
          { num: '< 1s', label: 'Datos en tiempo real' },
          { num: '100%', label: 'Mobile-first' },
        ].map((s, i) => (
          <div key={i} className={styles.heroStat}>
            <div className={styles.heroStatNum}>{s.num}</div>
            <div className={styles.heroStatLabel}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function HeroMiniMap() {
  const pins = [
    { x: 22, y: 38, color: '#1a472a' },
    { x: 55, y: 58, color: '#0369a1' },
    { x: 73, y: 32, color: '#b45309' },
  ]
  return (
    <div className={styles.miniMap}>
      <svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="none">
        <rect width="100" height="80" fill="var(--surface2)" rx="6" />
        <path d="M0 40 Q25 30 50 40 Q75 50 100 40" stroke="var(--border2)" strokeWidth="1" fill="none" />
        <path d="M50 0 L50 80" stroke="var(--border)" strokeWidth="0.5" fill="none" />
        <rect x="8" y="12" width="18" height="10" fill="var(--surface3)" rx="2" />
        <rect x="35" y="20" width="15" height="8" fill="var(--surface3)" rx="2" />
        <rect x="62" y="48" width="20" height="12" fill="var(--surface3)" rx="2" />
        <polygon points="15,15 45,12 48,48 18,50" fill="rgba(26,71,42,0.1)" stroke="#1a472a" strokeWidth="0.8" strokeDasharray="3,2" />
        {pins.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill={p.color} opacity="0.2" />
            <circle cx={p.x} cy={p.y} r="2.5" fill={p.color} />
            <circle cx={p.x} cy={p.y} r="5" fill="none" stroke={p.color} strokeWidth="0.8" opacity="0.6" />
          </g>
        ))}
      </svg>
      <div className={styles.miniMapLabel}><span className={styles.liveDot} /> En vivo</div>
    </div>
  )
}


/* ── Sobre Nosotros ── */
function SobreNosotros({ onContact }) {
  return (
    <section id="nosotros" className={styles.sobreSection}>
      <div className={styles.container}>
        <div className={styles.sobreGrid}>
          <div className={styles.sobreContent}>
            <div className={styles.sectionLabel}>Sobre nosotros</div>
            <h2 className={styles.sectionTitle}>Nacimos para resolver<br />un problema real</h2>
            <p className={styles.sobreText}>
              Metr1ka es un producto de <strong>Paralelo Software Studio</strong>, desarrollado junto a
              <strong> Enfoque Misiones</strong> para cubrir una necesidad que vimos de primera mano:
              los equipos de campo seguían usando papel, planillas de Excel y llamadas telefónicas
              para coordinar encuestas.
            </p>
            <p className={styles.sobreText}>
              Construimos una plataforma que digitaliza todo el proceso — desde la configuración de
              zonas geográficas hasta la visualización de resultados en tiempo real — para que los
              datos lleguen cuando importan: mientras pasan.
            </p>
            <div className={styles.sobrePartners}>
              <a href="mailto:paralelo.software.studio@gmail.com" className={styles.partnerCard}>
                <img src={logoParalelo} alt="Paralelo Software Studio" className={styles.partnerLogo} />
                <div>
                  <div className={styles.partnerName}>Paralelo Software Studio</div>
                  <div className={styles.partnerRole}>Desarrollo de producto</div>
                </div>
              </a>
              <a href="mailto:enfoquemisiones@gmail.com" className={styles.partnerCard}>
                <img src={logoEnfoque} alt="Enfoque Misiones" className={styles.partnerLogo} />
                <div>
                  <div className={styles.partnerName}>Enfoque Misiones</div>
                  <div className={styles.partnerRole}>Partner estratégico</div>
                </div>
              </a>
            </div>
          </div>
          <div className={styles.sobreStats}>
            {[
              { num: '2025', label: 'Año de lanzamiento' },
              { num: '+50', label: 'Encuestadores en campo' },
              { num: '100%', label: 'Hecho en Misiones' },
              { num: '0', label: 'Papel usado' },
            ].map((s, i) => (
              <div key={i} className={styles.sobreStat}>
                <div className={styles.sobreStatNum}>{s.num}</div>
                <div className={styles.sobreStatLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Features ── */
function Features() {
  const features = [
    { icon: <MapPin size={22} />, title: 'Control de zona inteligente', desc: 'Delimitá zonas geográficas por equipo. Si un encuestador sale del área, la app se desactiva automáticamente.', color: '#1a472a' },
    { icon: <Zap size={22} />, title: 'Respuestas en tiempo real', desc: 'Cada respuesta llega al panel central en menos de un segundo. Sin sincronizaciones manuales ni esperas.', color: '#7c3aed' },
    { icon: <Smartphone size={22} />, title: 'App móvil nativa', desc: 'Aplicación para iOS y Android. Funciona en modo offline y sincroniza cuando recupera señal.', color: '#0369a1' },
    { icon: <BarChart2 size={22} />, title: 'Gráficos automáticos', desc: 'Los resultados se visualizan en gráficos interactivos automáticamente, sin configuración adicional.', color: '#b45309' },
    { icon: <Shield size={22} />, title: 'Roles y permisos', desc: 'Admin, gestor, coordinador y encuestador. Cada uno ve solo lo que necesita para su rol.', color: '#dc2626' },
    { icon: <TrendingUp size={22} />, title: 'Reportes exportables', desc: 'Exportá los resultados en Excel o PDF con un clic. Con filtros por equipo, zona y fecha.', color: '#059669' },
  ]

  return (
    <section id="sistema" className={styles.features}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>El sistema</div>
          <h2 className={styles.sectionTitle}>Todo lo que necesitás<br />para el trabajo de campo</h2>
          <p className={styles.sectionSub}>Diseñado para organizaciones que necesitan datos confiables, rápidos y verificables desde el campo.</p>
        </div>
        <div className={styles.featuresGrid}>
          {features.map((f, i) => (
            <div key={i} className={styles.featureCard}>
              <div className={styles.featureIcon} style={{ color: f.color, background: `${f.color}15` }}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Flujo ── */
function Flujo() {
  const [active, setActive] = useState(0)
  const step = FLOW_STEPS[active]

  return (
    <section id="flujo" className={styles.flujo}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Flujo de trabajo</div>
          <h2 className={styles.sectionTitle}>De la configuración<br />al campo en minutos</h2>
        </div>
        <div className={styles.flujoLayout}>
          <div className={styles.flujoSteps}>
            {FLOW_STEPS.map((s, i) => (
              <button key={i} className={`${styles.flujoStep} ${active === i ? styles.flujoStepActive : ''}`} onClick={() => setActive(i)}>
                <div className={styles.flujoStepNum}>{i + 1}</div>
                <div className={styles.flujoStepText}>{s.title}</div>
                {active === i && <ArrowRight size={16} className={styles.flujoStepArrow} />}
              </button>
            ))}
          </div>
          <div className={styles.flujoDetail}>
            <h3 className={styles.flujoDetailTitle}>{step.title}</h3>
            <p className={styles.flujoDetailDesc}>{step.detail}</p>
            <div className={styles.flujoChips}>
              {step.chips.map((c, i) => (
                <span key={i} className={styles.flujoChip}><CheckCircle size={12} /> {c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Roles ── */
function Roles() {
  return (
    <section id="roles" className={styles.roles}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Roles del sistema</div>
          <h2 className={styles.sectionTitle}>Cada rol, con lo que necesita</h2>
          <p className={styles.sectionSub}>Un sistema de permisos jerárquico que garantiza que cada persona vea y haga exactamente lo que le corresponde.</p>
        </div>
        <div className={styles.rolesGrid}>
          {ROLES.map((r, i) => (
            <div key={i} className={`${styles.roleCard} ${styles[`roleCard_${r.key}`]}`}>
              <div className={styles.roleBadge}>{r.label}</div>
              <h3 className={styles.roleTitle}>{r.title}</h3>
              <p className={styles.roleDesc}>{r.desc}</p>
              <ul className={styles.rolePerms}>
                {r.perms.map((p, j) => (
                  <li key={j}><CheckCircle size={13} className={styles.roleCheck} /> {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Dashboard Preview ── */
function DashboardPreview() {
  const barRef = useRef(null)

  useEffect(() => {
    if (!barRef.current) return
    const c = new Chart(barRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
        datasets: [{ data: [65, 89, 120, 98, 145, 87, 112], backgroundColor: '#1a472a', borderRadius: 6, borderSkipped: false }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9ca3af' } },
          y: { display: false, beginAtZero: true },
        },
      },
    })
    return () => c.destroy()
  }, [])

  return (
    <section id="panel" className={styles.dashSection}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Panel de control</div>
          <h2 className={styles.sectionTitle}>Todo el campo,<br />en una sola pantalla</h2>
          <p className={styles.sectionSub}>Monitorea encuestadores, zonas y resultados desde el panel web. Actualización automática sin recargar.</p>
        </div>

        <div className={styles.dashWindow}>
          <div className={styles.dashTitleBar}>
            <div className={styles.dashDot} style={{ background: '#ef4444' }} />
            <div className={styles.dashDot} style={{ background: '#f59e0b' }} />
            <div className={styles.dashDot} style={{ background: '#22c55e' }} />
            <span className={styles.dashUrl}>panel.metr1ka.com/dashboard</span>
          </div>
          <div className={styles.dashBody}>
            <div className={styles.dashKpis}>
              {DASHBOARD_DATA.kpis.map((k, i) => (
                <div key={i} className={styles.dashKpi}>
                  <div className={styles.dashKpiVal}>{k.v}</div>
                  <div className={styles.dashKpiLabel}>{k.l}</div>
                  <div className={styles.dashKpiSub}>{k.s}</div>
                </div>
              ))}
            </div>
            <div className={styles.dashChartRow}>
              <div className={styles.dashChartCard}>
                <div className={styles.dashChartTitle}>Respuestas por día</div>
                <div style={{ height: 100 }}><canvas ref={barRef} /></div>
              </div>
              <div className={styles.dashEncsCard}>
                <div className={styles.dashChartTitle}>Encuestadores activos</div>
                {DASHBOARD_DATA.encuestadores.map((e, i) => (
                  <div key={i} className={styles.dashEnc}>
                    <div className={styles.dashEncAv} style={{ background: e.bg, color: e.tc }}>{e.initials}</div>
                    <div className={styles.dashEncInfo}>
                      <span className={styles.dashEncName}>{e.name}</span>
                      <span className={styles.dashEncZone}>{e.zone}</span>
                    </div>
                    <span className={`${styles.dashEncBadge} ${e.status === 'active' ? styles.dashEncBadgeActive : styles.dashEncBadgeIdle}`}>
                      {e.status === 'active' ? 'Activo' : 'Pausado'}
                    </span>
                    <span className={styles.dashEncCount}>{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Mobile App ── */
function MobileApp() {
  const [tab, setTab] = useState('encuestador')
  const roles = [
    { key: 'encuestador', label: 'Encuestador' },
    { key: 'coordinador', label: 'Coordinador' },
    { key: 'admin', label: 'Admin' },
  ]
  const features = {
    encuestador: [
      { icon: <Smartphone size={18} />, title: 'Encuestas asignadas', desc: 'Solo ve las encuestas que le tocaron a él. Interfaz limpia y simple.' },
      { icon: <Zap size={18} />, title: 'Envío en tiempo real', desc: 'Respuestas al instante, sin esperar sincronización.' },
      { icon: <MapPin size={18} />, title: 'Navegación GPS', desc: 'La app le dice a dónde ir y cuándo llegó a la parcela.' },
      { icon: <Shield size={18} />, title: 'Control de zona', desc: 'Si sale del área, la app se bloquea automáticamente.' },
    ],
    coordinador: [
      { icon: <Globe size={18} />, title: 'Mapa en vivo', desc: 'Ve la posición de cada encuestador de su equipo en tiempo real.' },
      { icon: <Users size={18} />, title: 'Estado del equipo', desc: 'Quién está activo, cuántas encuestas completó cada uno.' },
      { icon: <BarChart2 size={18} />, title: 'Progreso por zona', desc: 'Porcentaje de parcelas completadas por zona.' },
      { icon: <Clock size={18} />, title: 'Última actividad', desc: 'Ve hace cuánto tiempo estuvo activo cada encuestador.' },
    ],
    admin: [
      { icon: <BarChart2 size={18} />, title: 'Resultados en vivo', desc: 'Gráficos y contadores actualizados en tiempo real.' },
      { icon: <TrendingUp size={18} />, title: 'Seleccionar encuesta', desc: 'Cambia entre encuestas activas con un toque.' },
      { icon: <Users size={18} />, title: 'Todos los equipos', desc: 'Ve el estado de todos los equipos sin filtros.' },
      { icon: <Zap size={18} />, title: 'Notificaciones', desc: 'Alertas cuando hay actividad relevante en el campo.' },
    ],
  }

  return (
    <section id="app" className={styles.mobileSection}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>App móvil</div>
          <h2 className={styles.sectionTitle}>El campo en tu bolsillo</h2>
          <p className={styles.sectionSub}>Una sola app para todos los roles. Cada usuario ve exactamente lo que necesita.</p>
        </div>

        <div className={styles.mobileTabs}>
          {roles.map(r => (
            <button key={r.key} className={`${styles.mobileTab} ${tab === r.key ? styles.mobileTabActive : ''}`} onClick={() => setTab(r.key)}>
              {r.label}
            </button>
          ))}
        </div>

        <div className={styles.mobileLayout}>
          <div className={styles.mobileFeatures}>
            {features[tab].map((f, i) => (
              <div key={i} className={styles.mobileFeature}>
                <div className={styles.mobileFeatureIcon}>{f.icon}</div>
                <div>
                  <div className={styles.mobileFeatureTitle}>{f.title}</div>
                  <div className={styles.mobileFeatureDesc}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.mobilePhone}>
            <div className={styles.phoneMock}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <div className={styles.phoneHeader}>
                  <span className={styles.phoneTitle}>Metr1ka</span>
                  <span className={styles.phoneLive}><span className={styles.liveDot} /> En vivo</span>
                </div>
                <div className={styles.phoneBody}>
                  <div className={styles.phoneKpis}>
                    <div className={styles.phoneKpi}><span className={styles.phoneKpiNum}>412</span><span className={styles.phoneKpiLabel}>respuestas</span></div>
                    <div className={styles.phoneKpi}><span className={styles.phoneKpiNum}>23</span><span className={styles.phoneKpiLabel}>activos</span></div>
                  </div>
                  <div className={styles.phoneMap}><HeroMiniMap /></div>
                  <div className={styles.phoneBtnRow}>
                    <div className={styles.phoneBtn}>Comenzar encuesta</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Pricing ── */
function Pricing({ onContact }) {
  return (
    <section id="precios" className={styles.pricing}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Planes</div>
          <h2 className={styles.sectionTitle}>Elegí el plan<br />para tu organización</h2>
          <p className={styles.sectionSub}>Precios transparentes, sin sorpresas. Todos los planes incluyen la app móvil y acceso al panel web.</p>
        </div>

        <div className={styles.plansGrid}>
          {PLANS.map((plan, i) => (
            <div key={i} className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : ''}`}>
              {plan.featured && <div className={styles.planBadge}>Más elegido</div>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <p className={styles.planDesc}>{plan.desc}</p>
              <ul className={styles.planFeatures}>
                {plan.features.map((f, j) => (
                  <li key={j} className={typeof f === 'object' && f.muted ? styles.planFeatureMuted : ''}>
                    <CheckCircle size={14} className={styles.planCheck} />
                    {typeof f === 'object' ? f.text : f}
                  </li>
                ))}
              </ul>
              <button className={plan.featured ? styles.btnPrimary : styles.btnOutline} onClick={onContact}>
                Consultar precio
              </button>
            </div>
          ))}
        </div>


      </div>
    </section>
  )
}

/* ── Testimonials ── */
function Testimonials() {
  return (
    <section id="clientes" className={styles.testimonials}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Testimonios</div>
          <h2 className={styles.sectionTitle}>Lo que dicen quienes<br />trabajan con Metr1ka</h2>
        </div>
        <div className={styles.testimonialsGrid}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={styles.testimonialCard}>
              <div className={styles.testimonialQuote}>"</div>
              <p className={styles.testimonialText}>{t.quote}</p>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar} style={{ background: t.bg, color: t.tc }}>{t.initials}</div>
                <div>
                  <div className={styles.testimonialName}>{t.name}</div>
                  <div className={styles.testimonialRole}>{t.role} · {t.org}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Footer ── */
function Footer({ onContact }) {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <img src={LogoMetr1ka} alt="Metr1ka" className={styles.footerLogo} />
              <p className={styles.footerTagline}>Sistema profesional de encuestas de campo. Datos reales, en tiempo real.</p>
              <div className={styles.footerPartners}>
                <span className={styles.footerPartnerLabel}>Desarrollado por</span>
                <a href="mailto:paralelo.software.studio@gmail.com">
                  <img src={logoParalelo} alt="Paralelo Software Studio" className={`${styles.footerPartnerLogo} ${styles.footerLogoParalelo}`} />
                </a>
              </div>
              <div className={styles.footerPartners} style={{ marginTop: 8 }}>
                <span className={styles.footerPartnerLabel}>Impulsado por</span>
                <a href="mailto:enfoquemisiones@gmail.com">
                  <img src={logoEnfoque} alt="Enfoque Misiones" className={`${styles.footerPartnerLogo} ${styles.footerLogoEnfoque}`} />
                </a>
              </div>
            </div>

            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Producto</h4>
              {[['inicio','Inicio'],['sistema','El sistema'],['flujo','Flujo'],['app','App móvil'],['precios','Precios']].map(([id, label]) => (
                <button key={id} className={styles.footerLink} onClick={() => scrollTo(id)}>{label}</button>
              ))}
            </div>

            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Empresa</h4>
              <button className={styles.footerLink} onClick={() => scrollTo('clientes')}>Clientes</button>
              <button className={styles.footerLink} onClick={onContact}>Contacto</button>
              <a href="mailto:hola@metr1ka.com" className={styles.footerLink}>hola@metr1ka.com</a>
            </div>

            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Legal</h4>
              <span className={styles.footerLink}>Política de privacidad</span>
              <span className={styles.footerLink}>Términos de uso</span>
              <span className={styles.footerLink}>Política de cookies</span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <div className={styles.container}>
          <div className={styles.footerBottomRow}>
            <span>© {new Date().getFullYear()} METR1KA · Todos los derechos reservados</span>
            <span>Hecho en Misiones, Argentina 🇦🇷</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ── Landing Page ── */
export default function Landing() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    const fn = () => {
      const ids = ['inicio', 'nosotros', 'sistema', 'flujo', 'roles', 'panel', 'app', 'precios', 'clientes']
      const sy = window.scrollY + window.innerHeight * 0.35
      let cur = 'inicio'
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.offsetTop <= sy) cur = id
      }
      setActiveSection(cur)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <div className={styles.page}>
      <Nav active={activeSection} onContact={() => setContactOpen(true)} />
      <main>
        <Hero onContact={() => setContactOpen(true)} />
        <SobreNosotros onContact={() => setContactOpen(true)} />
        <Features />
        <Flujo />
        <Roles />
        <DashboardPreview />
        <MobileApp />
        <Pricing onContact={() => setContactOpen(true)} />
        <Testimonials />
      </main>
      <Footer onContact={() => setContactOpen(true)} />
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      <CookieBanner />
      <ScrollToTop />
    </div>
  )
}