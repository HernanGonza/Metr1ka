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
import LegalModal from './LegalModal'
import { PRIVACY_POLICY, TERMS, COOKIES } from './legalTexts'


/* ── Logo SVG Web (inline, acepta color) ── */
function LogoSvgWeb({ width = 120, color = '#0f0f0f', accentColor = '#52B788' }) {
  const height = Math.round(width * (62 / 751))
  return (
    <svg width={width} height={height} viewBox="0 0 751 62" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M76.224 54.144H61.824L114.24 0H138.24V61.44H114.24V19.584L121.44 22.56L83.52 61.44H54.72L16.704 22.656L24 19.68V61.44H0V0H24L76.224 54.144Z" fill={color}/>
      <path d="M174.727 35.52V43.2H247.688V61.44H150.727V0H247.495V18.24H174.727V25.92H234.247V35.52H174.727Z" fill={color}/>
      <path d="M255.334 0H355.174V18.24H255.334V0ZM293.254 16.992H317.254V61.44H293.254V16.992Z" fill={color}/>
      <path d="M363.776 61.44V0H437.984C443.808 0 449.024 0.672001 453.632 2.016C458.304 3.296 461.984 5.472 464.672 8.544C467.424 11.616 468.8 15.808 468.8 21.12C468.8 24.64 468.16 27.552 466.88 29.856C465.6 32.16 463.84 33.952 461.6 35.232C459.36 36.512 456.8 37.44 453.92 38.016C451.04 38.592 448.032 38.944 444.896 39.072L437.888 37.728C445.504 37.792 451.36 38.112 455.456 38.688C459.616 39.264 462.496 40.32 464.096 41.856C465.76 43.328 466.592 45.472 466.592 48.288V61.44H442.592V51.168C442.592 49.248 442.208 47.808 441.44 46.848C440.736 45.824 439.136 45.12 436.64 44.736C434.208 44.352 430.432 44.16 425.312 44.16H387.776V61.44H363.776ZM387.776 28.128H437.984C439.904 28.128 441.504 27.808 442.784 27.168C444.128 26.528 444.8 25.312 444.8 23.52C444.8 21.856 444.128 20.736 442.784 20.16C441.504 19.52 439.904 19.2 437.984 19.2H387.776V28.128Z" fill={color}/>
      <path d="M476.809 32.64V14.4H518.473V61.44H495.433V32.64H476.809Z" fill={accentColor}/>
      <path d="M582.149 31.2V25.824L637.541 61.44H601.829L554.789 28.8L598.181 0H632.357L582.149 31.2ZM530.981 0H554.981V61.44H530.981V0Z" fill={color}/>
      <path d="M662.39 52.128V37.728H728.054V52.128H662.39ZM640.886 61.44L682.07 0H708.758L750.326 61.44H723.926L688.31 6.432H702.614L667.286 61.44H640.886Z" fill={color}/>
    </svg>
  )
}

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
            <LogoSvgWeb width={110} color={isDark ? '#ffffff' : '#0f0f0f'} accentColor="#52B788" />
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
            Tomá el pulso del territorio <em>en tiempo real</em>
          </h1>
          <p className={styles.heroSub}>
            Una plataforma completa para que cualquier organización haga encuestas de campo con su propio equipo y vea los resultados al instante.
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
            <div className={styles.sectionLabel}>Nuestra historia</div>
            <h2 className={styles.sectionTitle}>Sobre METR1KA</h2>
            <p className={styles.sobreText}>
              METR1KA nace como un proyecto conjunto entre <strong>Enfoque Misiones</strong> y <strong>Paralelo Software Studio</strong>, con el propósito de transformar la forma en que se crean, gestionan y analizan las encuestas en Misiones.
            </p>
            <p className={styles.sobreText}>
              Enfoque Misiones, el diario digital referente de la provincia, identificó una necesidad recurrente en su trabajo diario: las herramientas de encuestas tradicionales eran lentas, poco intuitivas y limitadas a la hora de generar datos útiles en tiempo real.
            </p>
            <p className={styles.sobreText}>
              Fue así como decidimos unir fuerzas: la experiencia periodística y el profundo conocimiento del territorio de Enfoque Misiones, junto con la capacidad técnica de <strong>Paralelo Software Studio</strong>, especializada en crear soluciones digitales escalables y centradas en la experiencia del usuario.
            </p>
            <div className={styles.sobreHighlight}>
              <p><strong>El resultado es METR1KA:</strong> una plataforma moderna de encuestas en tiempo real que permite:</p>
              <ul>
                <li>Crear encuestas profesionales y asignarlas a equipos de campo</li>
                <li>Recolectar respuestas de forma instantánea con GPS</li>
                <li>Visualizar resultados en vivo con gráficos claros</li>
                <li>Controlar zonas de trabajo con geofencing por equipo</li>
              </ul>
            </div>
            <p className={styles.sobreText}>
              Nuestra misión es democratizar el acceso a herramientas de investigación de campo, permitiendo a organizaciones, empresas y gobiernos tomar decisiones basadas en datos reales, comenzando desde Misiones hacia todo el país.
            </p>
            <div className={styles.sobrePartners}>
              <a href="mailto:paralelo.software.studio@gmail.com" className={styles.partnerCard}>
                <img src={logoParalelo} alt="Paralelo Software Studio" className={`${styles.partnerLogoBase} ${styles.partnerLogoParalelo}`} />
                <div>
                  <div className={styles.partnerName}>Paralelo Software Studio</div>
                  <div className={styles.partnerRole}>Desarrollo de producto</div>
                </div>
              </a>
              <a href="mailto:enfoquemisiones@gmail.com" className={styles.partnerCard}>
                <img src={logoEnfoque} alt="Enfoque Misiones" className={`${styles.partnerLogoBase} ${styles.partnerLogoEnfoque}`} />
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
function Footer({ onContact, onOpenLegal }) {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <LogoSvgWeb width={130} color="#ffffff" accentColor="#52B788" style={{ marginBottom: 16 }} />
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
              {[['inicio','Inicio'],['sistema','El sistema'],['nosotros','Sobre nosotros'],['flujo','Flujo'],['app','App móvil'],['precios','Precios']].map(([id, label]) => (
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
              <button className={styles.footerLink} onClick={() => onOpenLegal('privacy')}>
  Política de privacidad
</button>

<button className={styles.footerLink} onClick={() => onOpenLegal('terms')}>
  Términos de uso
</button>

<button className={styles.footerLink} onClick={() => onOpenLegal('cookies')}>
  Política de cookies
</button>
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
  const [legalModal, setLegalModal] = useState(null)

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
      <Footer 
  onContact={() => setContactOpen(true)}
  onOpenLegal={(type) => {
    if (type === 'privacy') setLegalModal({ title: 'Política de privacidad', content: PRIVACY_POLICY })
    if (type === 'terms') setLegalModal({ title: 'Términos de uso', content: TERMS })
    if (type === 'cookies') setLegalModal({ title: 'Política de cookies', content: COOKIES })
  }}
/>
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
        {legalModal && (
  <LegalModal
    title={legalModal.title}
    content={legalModal.content}
    onClose={() => setLegalModal(null)}
  />
)}
      <CookieBanner />
      <ScrollToTop />
    </div>
  )
}

