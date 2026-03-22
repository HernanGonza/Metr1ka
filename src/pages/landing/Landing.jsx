import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Chart from 'chart.js/auto'
import styles from './Landing.module.css'
import {
  SECTIONS, FLOW_STEPS, ROLES, PLANS, TECH_CARDS,
  SURVEY_QUESTIONS, MOBILE_FEATURES, DASHBOARD_SIDEBAR, DASHBOARD_DATA,
} from './landingData'

/* ── HELPERS ── */
function BarChart({ labels, data, color }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const c = new Chart(ref.current.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: color || '#1a472a', borderRadius: 5, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 } } },
        },
      },
    })
    return () => c.destroy()
  }, [])
  return <canvas ref={ref} />
}

function DonutChart() {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const c = new Chart(ref.current.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Muy satisfecho', 'Satisfecho', 'Regular', 'Insatisfecho'],
        datasets: [{ data: [38, 29, 21, 12], backgroundColor: ['#1a472a', '#2d6a4f', '#52b788', '#b7e4c7'], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, padding: 10 } } },
      },
    })
    return () => c.destroy()
  }, [])
  return <canvas ref={ref} />
}

function MapSVG({ full }) {
  const h = full ? 360 : 190
  const pins = [
    { x: 110, y: 105, name: 'María R.', color: '#1a472a', count: '14' },
    { x: 230, y: 190, name: 'Juan L.',  color: '#0369a1', count: '9'  },
    { x: 320, y: 115, name: 'Ana S.',   color: '#b45309', count: '7'  },
    { x: 400, y: 245, name: 'Carlos P.',color: '#7c3aed', count: '11' },
    { x: 495, y: 148, name: 'Laura M.', color: '#c0392b', count: '6'  },
  ]
  const buildings = [
    { x: 25, y: 45, w: 85, h: 42 }, { x: 125, y: 175, w: 95, h: 52 },
    { x: 245, y: 65, w: 75, h: 38 }, { x: 315, y: 195, w: 88, h: 48 },
    { x: 425, y: 75, w: 105, h: 46 }, { x: 445, y: 260, w: 72, h: 52 },
  ]
  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', height: h, position: 'relative', background: '#deefd8' }}>
      <svg width="100%" height="100%" viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice">
        <rect width={600} height={360} fill="#deefd8" />
        <path d="M0 160 Q150 122 300 160 Q450 198 600 160" stroke="#a8d5a2" strokeWidth={3} fill="none" />
        <path d="M0 240 Q100 212 200 240 Q300 268 400 240 Q500 220 600 240" stroke="#a8d5a2" strokeWidth={2} fill="none" />
        <path d="M190 0 L190 360" stroke="#a8d5a2" strokeWidth={2} fill="none" />
        <path d="M400 0 L400 360" stroke="#a8d5a2" strokeWidth={2} fill="none" />
        {buildings.map((b, i) => <rect key={i} {...b} fill="#c5dbc5" rx={5} />)}
        <text x={300} y={348} textAnchor="middle" fontSize={11} fill="#5a9e5a" fontWeight={600}>Posadas, Misiones</text>
        {pins.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={14} fill={p.color} opacity={0.18} />
            <circle cx={p.x} cy={p.y} r={7}  fill={p.color} stroke="#fff" strokeWidth={2} />
            <rect x={p.x - 28} y={p.y + 10} width={56} height={28} fill="#fff" rx={5} opacity={0.95} />
            <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize={9}  fill="#222"    fontWeight={700}>{p.name}</text>
            <text x={p.x} y={p.y + 33} textAnchor="middle" fontSize={8}  fill={p.color} fontWeight={600}>{p.count} enc.</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/* ── NAV ── */
function Nav({ active, onNav }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function handleNav(id) {
    onNav(id)
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          Encuestas <span>Enfoque Misiones</span>
        </div>
        <div className={styles.navTabs}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`${styles.navTab} ${active === s.id ? styles.active : ''}`}
              onClick={() => handleNav(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Link to="/login" className={styles.navLogin}>Ingresar →</Link>
        <button
          className={`${styles.navHamburger} ${menuOpen ? styles.open : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>
      </nav>
      <div className={`${styles.navMobileMenu} ${menuOpen ? styles.open : ''}`}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`${styles.navTab} ${active === s.id ? styles.active : ''}`}
            onClick={() => handleNav(s.id)}
          >
            {s.label}
          </button>
        ))}
        <Link to="/login" className={styles.navMobileLogin} onClick={() => setMenuOpen(false)}>
          Ingresar →
        </Link>
      </div>
    </>
  )
}

/* ── HERO ── */
function Hero() {
  return (
    <section id="inicio" className={`${styles.section} ${styles.hero}`}>
      <div className={styles.container}>
        <div className={styles.heroEyebrow}>Sistema de encuestas profesionales</div>
        <h1 className={styles.heroH1}>
          Tomá el pulso del territorio <em>en tiempo real</em>
        </h1>
        <p className={styles.heroSub}>
          Una plataforma completa para que cualquier organización haga encuestas de campo con su propio equipo y vea los resultados al instante.
        </p>
        <div className={styles.heroBtns}>
          <Link to="/login" className={styles.btnPrimary}>→ Empezar</Link>
          <button className={styles.btnOutline} onClick={() => document.getElementById('panel')?.scrollIntoView({ behavior: 'smooth' })}>
            Ver el panel
          </button>
        </div>
        <div className={styles.statsRow}>
          {[
            { num: '100%', label: 'Datos en tiempo real' },
            { num: '3',    label: 'Roles diferenciados'  },
            { num: '∞',    label: 'Encuestas reutilizables' },
            { num: '🔒',   label: 'Datos aislados por cliente' },
          ].map((s, i) => (
            <div key={i} className={styles.statBox}>
              <span className={styles.statNum}>{s.num}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── ROLES ── */
function Roles() {
  const [active, setActive] = useState('admin')
  const badgeMap = { admin: styles.badgeAdmin, coordinador: styles.badgeCoordinador, encuestador: styles.badgeEncuestador }

  return (
    <section id="sistema" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.secLabel}>El sistema</div>
        <h2 className={styles.secTitle}>Tres roles, una plataforma</h2>
        <p className={styles.secSub}>
          Cada usuario ve únicamente lo que necesita. El cliente tiene su propio acceso aislado y sus datos no se mezclan con los de otros clientes.
        </p>
        <div className={styles.rolesGrid}>
          {ROLES.map(r => (
            <div
              key={r.key}
              className={`${styles.roleCard} ${active === r.key ? styles.active : ''}`}
              onClick={() => setActive(r.key)}
            >
              <span className={`${styles.roleBadge} ${badgeMap[r.badge]}`}>{r.label}</span>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
              <ul className={styles.rolePerms}>
                {r.perms.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── FLUJO ── */
function Flujo() {
  const [step, setStep] = useState(0)
  return (
    <section id="flujo" className={`${styles.section} ${styles.flowSection}`}>
      <div className={styles.container}>
        <div className={styles.secLabel}>Cómo funciona</div>
        <h2 className={styles.secTitle}>Del diseño al dato en 5 pasos</h2>
        <p className={styles.secSub}>
          El flujo completo desde que nosotros armamos la encuesta hasta que los resultados aparecen en el panel.
        </p>
        <div className={styles.flowSteps}>
          {FLOW_STEPS.map((s, i) => (
            <div key={i} className={`${styles.flowStep} ${step === i ? styles.active : ''}`} onClick={() => setStep(i)}>
              <div className={styles.flowStepNum}>0{i + 1}</div>
              <h4>{s.title}</h4>
            </div>
          ))}
        </div>
        <div className={`${styles.flowDetail} ${styles.fadeIn}`} key={step}>
          <h3>{FLOW_STEPS[step].title}</h3>
          <p>{FLOW_STEPS[step].detail}</p>
          <div className={styles.chips}>
            {FLOW_STEPS[step].chips.map((c, i) => <span key={i} className={styles.chip}>{c}</span>)}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── DASHBOARD PREVIEW ── */
function DashboardPreview() {
  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { kpis, encuestadores, encuestasCards, equiposCards, encuestadoresCards, reportesCards, configCards, coordinadores } = DASHBOARD_DATA

  function handleTabMobile(k) { setTab(k); setSidebarOpen(false) }

  const sidebarContent = DASHBOARD_SIDEBAR.map(({ group, items }) => (
    <div key={group} className={styles.sbSection}>
      <div className={styles.sbLabel}>{group}</div>
      {items.map(s => (
        <div key={s.key} className={`${styles.sbItem} ${tab === s.key ? styles.active : ''}`} onClick={() => handleTabMobile(s.key)}>
          <span className={styles.sbIcon}>{s.icon}</span> {s.label}
        </div>
      ))}
    </div>
  ))

  function renderMain() {
    if (tab === 'dashboard') return (
      <div className={styles.fadeIn}>
        <div className={styles.kpis}>
          {kpis.map((k, i) => (
            <div key={i} className={styles.kpi}>
              <div className={styles.kpiL}>{k.l}</div>
              <div className={styles.kpiV}>{k.v}</div>
              <div className={styles.kpiS}>{k.s}</div>
            </div>
          ))}
        </div>
        <div className={styles.grid2}>
          <div className={styles.dashCard}>
            <div className={styles.dashCardT}>Respuestas por hora</div>
            <div className={styles.chartWrap}>
              <BarChart labels={['8h','9h','10h','11h','12h','13h','14h','15h']} data={[12,34,55,62,48,71,58,63]} color="#1a472a" />
            </div>
          </div>
          <div className={styles.dashCard}>
            <div className={styles.dashCardT}>¿Cómo calificás la gestión?</div>
            <div className={styles.chartWrap}><DonutChart /></div>
          </div>
        </div>
        <div className={styles.grid2}>
          <div className={styles.dashCard}>
            <div className={styles.dashCardT}>Mapa de encuestadores</div>
            <MapSVG full={false} />
          </div>
          <div className={styles.dashCard}>
            <div className={styles.dashCardT}>Encuestadores activos</div>
            <div className={styles.encList}>
              {encuestadores.map((e, i) => (
                <div key={i} className={styles.encRow}>
                  <div className={styles.encAv} style={{ background: e.bg, color: e.tc }}>{e.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div className={styles.encName}>{e.name}</div>
                    <div className={styles.encZone}>
                      <span className={`${styles.sDot} ${e.status === 'active' ? styles.sOn : styles.sOff}`} />
                      {e.zone}
                    </div>
                  </div>
                  <div className={styles.encCnt}>{e.count} enc.</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )

    if (tab === 'mapa') return (
      <div className={`${styles.dashCard} ${styles.fadeIn}`}>
        <div className={styles.dashCardT}>Mapa en tiempo real — Posadas, Misiones</div>
        <MapSVG full={true} />
      </div>
    )

    if (tab === 'encuestas') return (
      <div className={styles.fadeIn}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Encuestas</span>
          <button className={styles.btnPrimary} style={{ padding: '7px 14px', fontSize: 12 }}>+ Nueva</button>
        </div>
        <div className={styles.cardsGrid}>
          {encuestasCards.map((e, i) => (
            <div key={i} className={styles.itemCard}>
              <div className={styles.itemCardT}>{e.name}</div>
              <div className={styles.itemCardS}>{e.p} preguntas · {e.r} respuestas</div>
              <div className={styles.itemCardM}>
                <span className={`${styles.tag} ${e.estado === 'activa' ? styles.tg : styles.tgr}`}>{e.estado}</span>
                <span className={`${styles.tag} ${styles.tb}`}>{e.eq} equipos</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'equipos') return (
      <div className={styles.fadeIn}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Equipos</span>
          <button className={styles.btnPrimary} style={{ padding: '7px 14px', fontSize: 12 }}>+ Nuevo</button>
        </div>
        <div className={styles.cardsGrid}>
          {equiposCards.map((e, i) => (
            <div key={i} className={styles.itemCard}>
              <div className={styles.itemCardT}>{e.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 8, marginTop: 2 }}>Coordinador</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={styles.encAv} style={{ background: e.coordBg, color: e.coordTc, width: 26, height: 26, fontSize: 10 }}>{e.coordI}</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{e.coord}</span>
                </div>
                <button style={{ fontSize: 11, color: 'var(--accent2)', background: 'var(--accent-light)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>Cambiar</button>
              </div>
              <div className={styles.itemCardM}>
                <span className={`${styles.tag} ${styles.tb}`}>{e.enc} encuestadores</span>
                <span className={`${styles.tag} ${styles.tg}`}>{e.encuestas} encuestas</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'coordinadores') return (
      <div className={styles.fadeIn}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Coordinadores</span>
          <button className={styles.btnPrimary} style={{ padding: '7px 14px', fontSize: 12 }}>+ Invitar</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 14, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 8, borderLeft: '3px solid var(--accent2)' }}>
          Los coordinadores deben existir en el sistema antes de poder asignarlos a un equipo.
        </div>
        <div className={styles.cardsGrid}>
          {coordinadores.map((c, i) => (
            <div key={i} className={styles.itemCard} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div className={styles.encAv} style={{ background: c.bg, color: c.tc, width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>{c.i}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={styles.itemCardT}>{c.name}</div>
                <div className={styles.itemCardS}>{c.email}</div>
                <div className={styles.itemCardM}>
                  {c.equipos.length > 0
                    ? c.equipos.map((eq, j) => <span key={j} className={`${styles.tag} ${styles.tb}`}>Equipo {eq}</span>)
                    : <span className={`${styles.tag} ${styles.tgr}`}>Sin equipo asignado</span>
                  }
                  <span className={`${styles.tag} ${c.estado === 'Activo' ? styles.tg : styles.tgr}`}>{c.estado}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'encuestadores') return (
      <div className={styles.fadeIn}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15 }}>Encuestadores</span>
          <button className={styles.btnPrimary} style={{ padding: '7px 14px', fontSize: 12 }}>+ Invitar</button>
        </div>
        <div className={styles.cardsGrid}>
          {encuestadoresCards.map((e, i) => (
            <div key={i} className={styles.itemCard} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div className={styles.encAv} style={{ background: e.bg, color: e.tc, width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{e.i}</div>
              <div>
                <div className={styles.itemCardT}>{e.name}</div>
                <div className={styles.itemCardS}>Equipo {e.eq} · {e.enc} enc.</div>
                <div className={styles.itemCardM}>
                  <span className={`${styles.tag} ${e.estado.toLowerCase().includes('activ') ? styles.tg : styles.tgr}`}>{e.estado}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'reportes') return (
      <div className={styles.fadeIn}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Reportes disponibles</div>
        {reportesCards.map((r, i) => (
          <div key={i} className={styles.repRow}>
            <span className={styles.repIcon}>{r.icon}</span>
            <div style={{ flex: 1 }}>
              <div className={styles.repT}>{r.title}</div>
              <div className={styles.repS}>{r.meta}</div>
            </div>
            <button className={styles.repBtn}>Descargar</button>
          </div>
        ))}
      </div>
    )

    if (tab === 'configuracion') return (
      <div className={styles.fadeIn}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Configuración</div>
        {configCards.map((c, i) => (
          <div key={i} className={styles.cfgRow}>
            <div>
              <div className={styles.cfgL}>{c.l}</div>
              <div className={styles.cfgS}>{c.s}</div>
            </div>
            <div className={`${styles.toggle} ${!c.on ? styles.toggleOff : ''}`} />
          </div>
        ))}
      </div>
    )

    return null
  }

  return (
    <section id="panel" className={`${styles.section} ${styles.dashSection}`}>
      <div className={styles.container}>
        <div className={styles.secLabel}>Panel central</div>
        <h2 className={styles.secTitle}>Todo el territorio en una pantalla</h2>
        <p className={styles.secSub}>
          El admin y el coordinador monitorean en tiempo real cada respuesta, cada encuestador y cada zona de operación.
        </p>
        <div className={styles.dashWrap}>
          <div className={styles.dashTopbar}>
            <div className={styles.dot + ' ' + styles.dR} />
            <div className={styles.dot + ' ' + styles.dY} />
            <div className={styles.dot + ' ' + styles.dG} />
            <div className={styles.dashTitle}>Panel Central — Posadas, Misiones</div>
            <div style={{ marginLeft: 'auto', fontSize: '12px', opacity: .5 }}>● En vivo</div>
          </div>
          <div className={styles.dashBody}>
            <div className={styles.dashSidebar}>{sidebarContent}</div>
            <div className={styles.dashMain}>
              <button className={styles.dashSidebarToggle} onClick={() => setSidebarOpen(o => !o)}>
                <span>{sidebarOpen ? '✕' : '☰'}</span> {sidebarOpen ? 'Cerrar menú' : 'Menú'}
              </button>
              <div className={`${styles.dashSidebarMobile} ${sidebarOpen ? styles.open : ''}`}>
                {sidebarContent}
              </div>
              {renderMain()}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── PHONE SURVEY ── */
function PhoneSurvey({ surveyName, onBack }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [done, setDone] = useState(false)
  const q = SURVEY_QUESTIONS[step]
  const total = SURVEY_QUESTIONS.length
  const pct = Math.round(((step + (done ? 1 : 0)) / total) * 100)
  const hasAnswer = answers[step] !== undefined && answers[step] !== ''

  function next() { step < total - 1 ? setStep(s => s + 1) : setDone(true) }
  function back() { if (step > 0) setStep(s => s - 1) }

  function renderQ() {
    if (done) return (
      <div className={styles.phoneSvDone}>
        <div className={styles.phoneSvDoneIcon}>✅</div>
        <h4>¡Completada!</h4>
        <p>Respuestas enviadas al panel central.</p>
        <button className={styles.phoneActionBtn} style={{ background: '#1a472a', marginTop: 16 }} onClick={onBack}>
          ← Volver a encuestas
        </button>
      </div>
    )
    if (q.type === 'multi' || q.type === 'sino') return (
      <div className={styles.phoneSvOpts}>
        {q.opts.map((opt, i) => (
          <button key={i} className={`${styles.phoneSvOpt} ${answers[step] === i ? styles.sel : ''}`} onClick={() => setAnswers(a => ({ ...a, [step]: i }))}>
            <span className={styles.phoneSvOptK}>{String.fromCharCode(65 + i)}</span>
            {opt}
          </button>
        ))}
      </div>
    )
    if (q.type === 'escala') return (
      <div className={styles.phoneSvScale}>
        <div className={styles.phoneSvScaleRow}>
          {Array.from({ length: 10 }, (_, i) => (
            <button key={i} className={`${styles.phoneScaleBtn} ${answers[step] === (i + 1) ? styles.sel : ''}`} onClick={() => setAnswers(a => ({ ...a, [step]: i + 1 }))}>
              {i + 1}
            </button>
          ))}
        </div>
        <div className={styles.phoneSvScaleLabels}>
          <span>Nada probable</span><span>Muy probable</span>
        </div>
      </div>
    )
    if (q.type === 'texto') return (
      <textarea
        className={styles.phoneSvTextarea}
        rows={4}
        placeholder="Escribí la respuesta..."
        value={answers[step] || ''}
        onChange={e => setAnswers(a => ({ ...a, [step]: e.target.value }))}
      />
    )
  }

  return (
    <div className={styles.phoneSurvey}>
      <div className={styles.phoneSvHeader}>
        <button className={styles.phoneSvBack} onClick={onBack}>←</button>
        <div className={styles.phoneSvTitle}>{surveyName}</div>
      </div>
      <div className={styles.phoneSvProg}>
        <div className={styles.phoneSvProgB} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.phoneSvBody}>
        {!done && <div className={styles.phoneSvQnum}>Pregunta {step + 1} de {total}</div>}
        {!done && <div className={styles.phoneSvQtext}>{q.text}</div>}
        {renderQ()}
      </div>
      {!done && (
        <div className={styles.phoneSvFooter}>
          <button className={styles.phoneSvNavBtn + ' ' + styles.phoneSvPrev} onClick={back} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>← Atrás</button>
          <button className={styles.phoneSvNavBtn + ' ' + styles.phoneSvNxt} disabled={!hasAnswer} onClick={next}>
            {step === total - 1 ? 'Finalizar' : 'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── PHONE HOME ── */
function PhoneHome({ onStart }) {
  return (
    <>
      <div className={styles.phoneHomeHeader}>
        <h4>Mis encuestas</h4>
        <p>Hola, María. Tenés 2 activas.</p>
      </div>
      <div className={styles.phoneHomeBody}>
        <div className={styles.phoneEncCard}>
          <div className={styles.phoneEncCardT}>Satisfacción general</div>
          <div className={styles.phoneEncCardM}>14 completadas · Barrio Norte</div>
          <div className={styles.phoneProg}><div className={styles.phoneProgB} style={{ width: '56%' }} /></div>
          <div className={styles.phoneProgL}>14 de 25 asignadas</div>
          <button className={styles.phoneActionBtn} style={{ background: '#1a472a' }} onClick={() => onStart('Satisfacción general')}>Continuar →</button>
        </div>
        <div className={styles.phoneEncCard}>
          <div className={styles.phoneEncCardT}>Seguridad barrial</div>
          <div className={styles.phoneEncCardM}>0 completadas · Barrio Norte</div>
          <div className={styles.phoneProg}><div className={styles.phoneProgB} style={{ width: '0%' }} /></div>
          <div className={styles.phoneProgL}>0 de 20 asignadas</div>
          <button className={styles.phoneActionBtn} style={{ background: '#52b788' }} onClick={() => onStart('Seguridad barrial')}>Comenzar →</button>
        </div>
      </div>
    </>
  )
}

/* ── PHONE COORD ── */
function PhoneCoord() {
  const [mapTab, setMapTab] = useState('mapa')
  const encuestadores = [
    { i: 'MR', name: 'María R.',  zone: 'Barrio Norte', count: 14, status: 'active', bg: '#d8f3dc', tc: '#1a472a' },
    { i: 'JL', name: 'Juan L.',   zone: 'Centro',       count: 9,  status: 'active', bg: '#e0f2fe', tc: '#0369a1' },
    { i: 'AS', name: 'Ana S.',    zone: 'Barrio Sur',   count: 7,  status: 'idle',   bg: '#fef3c7', tc: '#b45309' },
    { i: 'CP', name: 'Carlos P.', zone: 'Este',         count: 11, status: 'active', bg: '#f3e8ff', tc: '#7c3aed' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f7f7f5' }}>
      <div className={styles.phoneHomeHeader}>
        <h4>Equipo Norte</h4><p>Coordinador: Roberto V.</p>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
        {['mapa', 'equipo'].map(t => (
          <button key={t} onClick={() => setMapTab(t)} style={{ flex: 1, padding: '10px', border: 'none', background: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: mapTab === t ? 'var(--accent)' : 'var(--ink3)', borderBottom: mapTab === t ? '2px solid var(--accent)' : '2px solid transparent' }}>
            {t === 'mapa' ? '🗺️ Mapa en vivo' : '👥 Mi equipo'}
          </button>
        ))}
      </div>
      {mapTab === 'mapa' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 }}>
          <div style={{ background: '#deefd8', borderRadius: 10, overflow: 'hidden', flex: 1, minHeight: 140 }}>
            <svg width="100%" height="100%" viewBox="0 0 280 180" preserveAspectRatio="xMidYMid slice">
              <rect width={280} height={180} fill="#deefd8" />
              <path d="M0 90 Q70 70 140 90 Q210 110 280 90" stroke="#a8d5a2" strokeWidth={2} fill="none" />
              <path d="M100 0 L100 180" stroke="#a8d5a2" strokeWidth={1.5} fill="none" />
              {[{x:20,y:30,w:55,h:30},{x:110,y:100,w:60,h:35},{x:200,y:40,w:65,h:30},{x:30,y:120,w:50,h:30}].map((b,i)=><rect key={i} {...b} fill="#c5dbc5" rx={4}/>)}
              {[{x:80,y:80,color:'#1a472a',count:'14'},{x:150,y:130,color:'#0369a1',count:'9'},{x:195,y:75,color:'#b45309',count:'7'},{x:220,y:140,color:'#7c3aed',count:'11'}].map((p,i)=>(
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={10} fill={p.color} opacity={.2}/>
                  <circle cx={p.x} cy={p.y} r={6} fill={p.color} stroke="#fff" strokeWidth={1.5}/>
                  <rect x={p.x-14} y={p.y+8} width={28} height={16} fill="#fff" rx={3} opacity={.95}/>
                  <text x={p.x} y={p.y+19} textAnchor="middle" fontSize={7} fill={p.color} fontWeight={700}>{p.count} enc.</text>
                </g>
              ))}
            </svg>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[{label:'Activos',val:'3',color:'#22c55e'},{label:'En pausa',val:'1',color:'#f59e0b'},{label:'Encuestas hoy',val:'41',color:'var(--accent)'},{label:'Meta diaria',val:'60',color:'var(--ink3)'}].map((k,i)=>(
              <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600, marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 800, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: 12, overflowY: 'auto' }}>
          {encuestadores.map((e, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 9, padding: 10, marginBottom: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className={styles.encAv} style={{ background: e.bg, color: e.tc, width: 32, height: 32, fontSize: 12 }}>{e.i}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                  <span className={`${styles.sDot} ${e.status === 'active' ? styles.sOn : styles.sOff}`} />{e.zone}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>{e.count} enc.</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── PHONE ADMIN ── */
function PhoneAdmin() {
  const [selected, setSelected] = useState(0)
  const encuestas = [
    { name: 'Satisfacción general', total: 412, meta: 600, pct: 69 },
    { name: 'Seguridad barrial',    total: 187, meta: 300, pct: 62 },
    { name: 'Atención ciudadana',   total: 98,  meta: 200, pct: 49 },
  ]
  const e = encuestas[selected]
  const resultados = [
    { label: 'Muy buena / Buena', pct: 67, color: '#1a472a' },
    { label: 'Regular',           pct: 21, color: '#52b788' },
    { label: 'Mala / Muy mala',   pct: 12, color: '#b7e4c7' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f7f7f5' }}>
      <div className={styles.phoneHomeHeader}><h4>Resultados en vivo</h4><p>Posadas, Misiones</p></div>
      <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Encuesta</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {encuestas.map((enc, i) => (
            <button key={i} onClick={() => setSelected(i)} style={{ padding: '5px 10px', borderRadius: 100, border: `1.5px solid ${selected === i ? 'var(--accent)' : 'var(--border2)'}`, background: selected === i ? 'var(--accent-light)' : '#fff', color: selected === i ? 'var(--accent)' : 'var(--ink3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
              {enc.name.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 2 }}>{e.name}</div>
          <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: -1 }}>{e.total}</div>
          <div style={{ fontSize: 11, color: 'var(--ink3)', marginBottom: 10 }}>respuestas de {e.meta} previstas</div>
          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: 6, background: 'var(--accent)', borderRadius: 3, width: `${e.pct}%` }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--accent2)', marginTop: 4, fontWeight: 600 }}>{e.pct}% completado</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, fontFamily: 'Syne' }}>¿Cómo calificás la gestión?</div>
          {resultados.map((r, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--ink2)', fontWeight: 500 }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.pct}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: 5, background: r.color, borderRadius: 3, width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[{ label: 'Encuestadores activos', val: '23' }, { label: 'Equipos operando', val: '4' }, { label: 'Resp. última hora', val: '+38' }, { label: 'Zona líder', val: 'Centro' }].map((k, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--ink3)', fontWeight: 600, marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{k.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── MOBILE APP SECTION ── */
function MobileApp() {
  const [activeRole, setActiveRole] = useState('encuestador')
  const [activeSurvey, setActiveSurvey] = useState(null)

  const roles = [
    { key: 'encuestador', label: 'Encuestador', bgClass: styles.badgeEncuestador },
    { key: 'coordinador', label: 'Coordinador', bgClass: styles.badgeCoordinador },
    { key: 'admin',       label: 'Admin',       bgClass: styles.badgeAdmin       },
  ]

  function renderPhone() {
    if (activeRole === 'encuestador') {
      const h = activeSurvey ? 560 : 460
      return (
        <div className={styles.phoneFrame}>
          <div className={styles.phoneStatusbar}><span>9:41</span><span>●●●</span></div>
          <div className={styles.phoneScreen} style={{ minHeight: h, transition: 'min-height .3s' }}>
            {activeSurvey
              ? <PhoneSurvey surveyName={activeSurvey} onBack={() => setActiveSurvey(null)} />
              : <PhoneHome onStart={name => setActiveSurvey(name)} />
            }
          </div>
        </div>
      )
    }
    if (activeRole === 'coordinador') return (
      <div className={styles.phoneFrame}>
        <div className={styles.phoneStatusbar}><span>9:41</span><span>●●●</span></div>
        <div className={styles.phoneScreen} style={{ minHeight: 500 }}><PhoneCoord /></div>
      </div>
    )
    if (activeRole === 'admin') return (
      <div className={styles.phoneFrame}>
        <div className={styles.phoneStatusbar}><span>9:41</span><span>●●●</span></div>
        <div className={styles.phoneScreen} style={{ minHeight: 520 }}><PhoneAdmin /></div>
      </div>
    )
  }

  return (
    <section id="app" className={`${styles.section} ${styles.mobileSection}`}>
      <div className={styles.container}>
        <div className={styles.secLabel}>App móvil</div>
        <h2 className={styles.secTitle}>Una app, tres experiencias</h2>
        <p className={styles.secSub}>
          Una sola app para todos los roles. Cada usuario ve exactamente lo que necesita según su perfil.
        </p>
        <div className={styles.roleSelector}>
          {roles.map(r => (
            <button
              key={r.key}
              className={`${styles.roleSelectorBadge} ${r.bgClass}`}
              style={{ opacity: activeRole === r.key ? 1 : 0.5, border: activeRole === r.key ? '2px solid currentColor' : '2px solid transparent' }}
              onClick={() => { setActiveRole(r.key); setActiveSurvey(null) }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className={styles.mobileGrid}>
          <div className={styles.mobFeats}>
            {MOBILE_FEATURES[activeRole].map((f, i) => (
              <div key={i} className={styles.mobFeat}>
                <div className={styles.featIcon}>{f.icon}</div>
                <div>
                  <div className={styles.featT}>{f.title}</div>
                  <p className={styles.featD}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {renderPhone()}
        </div>
      </div>
    </section>
  )
}

/* ── PRICING ── */
function Pricing() {
  return (
    <section id="precios" className={`${styles.section} ${styles.pricingSection}`}>
      <div className={styles.container}>
        <div className={styles.secLabel}>Planes</div>
        <h2 className={styles.secTitle}>Planes de suscripción mensual</h2>
        <p className={styles.secSub}>
          Cada plan incluye una cantidad de encuestas diseñadas por nuestro equipo. Encuestas adicionales tienen un costo extra. El acceso al panel y a la app está activo mientras la suscripción esté paga.
        </p>
        <div className={styles.pricingGrid}>
          {PLANS.map((plan, i) => (
            <div key={i} className={`${styles.planCard} ${plan.featured ? styles.featured : ''}`}>
              {plan.featured && <div className={styles.planBadge}>⭐ MÁS POPULAR</div>}
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planDesc}>{plan.desc}</div>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>Consultar</span>
              </div>
              <div className={styles.planNote}>Precio a convenir según organización</div>
              <hr className={styles.planHr} />
              <ul className={styles.planFeatures}>
                {plan.features.map((f, j) => {
                  const text = typeof f === 'string' ? f : f.text
                  const muted = typeof f === 'object' && f.muted
                  return <li key={j} className={muted ? styles.muted : ''}>{text}</li>
                })}
              </ul>
              <button className={`${styles.planCta} ${plan.featured ? styles.ctaSolid : styles.ctaOutline}`}>
                Consultar precio
              </button>
            </div>
          ))}
        </div>
        <div className={styles.entCard}>
          <div>
            <h3>Encuestas adicionales</h3>
            <p>¿Necesitás más encuestas de las que incluye tu plan? Nosotros las armamos y las agregamos a tu cuenta. Sin cambiar de plan.</p>
            <div className={styles.entTags}>
              {['Armadas por nuestro equipo', 'Entrega en 48h', 'Revisiones incluidas', 'Sin cambiar de plan'].map((t, i) => (
                <span key={i} className={styles.eTag}>{t}</span>
              ))}
            </div>
          </div>
          <button className={styles.btnPrimary}>Consultar</button>
        </div>
      </div>
    </section>
  )
}

/* ── TECH ── */
function Tech() {
  return (
    <section id="tecnologia" className={`${styles.section} ${styles.techSection}`}>
      <div className={styles.container}>
        <div className={styles.secLabel}>Tecnología</div>
        <h2 className={styles.secTitle}>Construido para escalar</h2>
        <p className={styles.secSub}>
          Un solo sistema que funciona para todos los clientes. Cada cliente nuevo es solo un registro más, sin trabajo extra de infraestructura.
        </p>
        <div className={styles.techGrid}>
          {TECH_CARDS.map((c, i) => (
            <div key={i} className={styles.techCard}>
              <h4>{c.title}</h4>
              <p>{c.text}</p>
              <span className={styles.techTag}>{c.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── FOOTER ── */
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <div className={styles.footerBrand}>Encuestas Enfoque Misiones</div>
          <div className={styles.footerSub}>Sistema de encuestas en tiempo real para cualquier organización</div>
          <div className={styles.footerPowered}>powered by Enfoque & Paralelo Web Studio</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 4 }}>Contacto</div>
          <div className={styles.footerEmail}>encuestasenfoque@outlook.com</div>
        </div>
      </div>
    </footer>
  )
}

/* ── LANDING PAGE ── */
export default function Landing() {
  const [activeSection, setActiveSection] = useState('inicio')

  useEffect(() => {
    const handler = () => {
      const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean)
      const sy = window.scrollY + 100
      let cur = 'inicio'
      els.forEach(el => { if (el.offsetTop <= sy) cur = el.id })
      setActiveSection(cur)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className={styles.page}>
      <Nav active={activeSection} onNav={setActiveSection} />
      <Hero />
      <Roles />
      <Flujo />
      <DashboardPreview />
      <MobileApp />
      <Pricing />
      <Tech />
      <Footer />
    </div>
  )
}