import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../hooks/useTheme'
import { ArrowLeft, Lock, CheckCircle } from 'lucide-react'
import styles from './Login.module.css'

function LogoLogin({ isDark }) {
  const color = isDark ? '#ffffff' : '#0a0a0a'
  return (
    <svg width="160" height="14" viewBox="0 0 751 62" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: 140, height: 'auto', display: 'block' }}>
      <path d="M76.224 54.144H61.824L114.24 0H138.24V61.44H114.24V19.584L121.44 22.56L83.52 61.44H54.72L16.704 22.656L24 19.68V61.44H0V0H24L76.224 54.144Z" fill={color}/>
      <path d="M174.727 35.52V43.2H247.688V61.44H150.727V0H247.495V18.24H174.727V25.92H234.247V35.52H174.727Z" fill={color}/>
      <path d="M255.334 0H355.174V18.24H255.334V0ZM293.254 16.992H317.254V61.44H293.254V16.992Z" fill={color}/>
      <path d="M363.776 61.44V0H437.984C443.808 0 449.024 0.672001 453.632 2.016C458.304 3.296 461.984 5.472 464.672 8.544C467.424 11.616 468.8 15.808 468.8 21.12C468.8 24.64 468.16 27.552 466.88 29.856C465.6 32.16 463.84 33.952 461.6 35.232C459.36 36.512 456.8 37.44 453.92 38.016C451.04 38.592 448.032 38.944 444.896 39.072L437.888 37.728C445.504 37.792 451.36 38.112 455.456 38.688C459.616 39.264 462.496 40.32 464.096 41.856C465.76 43.328 466.592 45.472 466.592 48.288V61.44H442.592V51.168C442.592 49.248 442.208 47.808 441.44 46.848C440.736 45.824 439.136 45.12 436.64 44.736C434.208 44.352 430.432 44.16 425.312 44.16H387.776V61.44H363.776ZM387.776 28.128H437.984C439.904 28.128 441.504 27.808 442.784 27.168C444.128 26.528 444.8 25.312 444.8 23.52C444.8 21.856 444.128 20.736 442.784 20.16C441.504 19.52 439.904 19.2 437.984 19.2H387.776V28.128Z" fill={color}/>
      <path d="M476.809 32.64V14.4H518.473V61.44H495.433V32.64H476.809Z" fill="#52B788"/>
      <path d="M582.149 31.2V25.824L637.541 61.44H601.829L554.789 28.8L598.181 0H632.357L582.149 31.2ZM530.981 0H554.981V61.44H530.981V0Z" fill={color}/>
      <path d="M662.39 52.128V37.728H728.054V52.128H662.39ZM640.886 61.44L682.07 0H708.758L750.326 61.44H723.926L688.31 6.432H702.614L667.286 61.44H640.886Z" fill={color}/>
    </svg>
  )
}

function PasswordCheck({ label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
      color: ok ? 'var(--accent2)' : 'var(--ink3)', transition: 'color .2s' }}>
      <span style={{ fontSize: 14 }}>{ok ? '✅' : '○'}</span>
      {label}
    </div>
  )
}

export default function RecuperarPassword() {
  const { isDark } = useTheme()
  const navigate   = useNavigate()
  const [step,     setStep]     = useState('email') // 'email' | 'sent' | 'nueva'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)

  const pwdChecks = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const pwdValid = Object.values(pwdChecks).every(Boolean)
  const pwdMatch = password === confirm && confirm !== ''

  // Detectar si venimos desde el link del email
  useEffect(() => {
    // Caso 1: hash con access_token (flujo implícito legacy)
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setStep('nueva')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    // Caso 2: code en query params (flujo PKCE — el actual por defecto en Supabase)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      window.history.replaceState(null, '', window.location.pathname)
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) setStep('nueva')
      })
      return
    }

    // Caso 3: ya hay una sesión activa con evento PASSWORD_RECOVERY
    // (el usuario ya pasó por /verify y fue redirigido acá)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStep('nueva')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStep('nueva')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSendEmail(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar-password`,
    })
    if (err) setError(err.message)
    else setStep('sent')
    setLoading(false)
  }

  async function handleNewPassword(e) {
    e.preventDefault()
    if (!pwdValid || !pwdMatch) return
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      // Traducir mensajes de error de Supabase al español
      const errores = {
        'New password should be different from the old password.': 'La nueva contraseña debe ser diferente a la contraseña actual.',
        'Password should be at least 6 characters.': 'La contraseña debe tener al menos 6 caracteres.',
        'Auth session missing': 'Tu sesión expiró. Pedí un nuevo link de recuperación.',
        'Token has expired or is invalid': 'El link expiró. Pedí un nuevo link de recuperación.',
      }
      setError(errores[err.message] || err.message)
      setLoading(false)
    } else {
      await supabase.auth.signOut()
      navigate('/login?password_reset=true', { replace: true })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/login" className={styles.backLink}>
          <ArrowLeft size={14} /> Volver al login
        </Link>

        <div className={styles.brand}>
          <LogoLogin isDark={isDark} />
        </div>

        {/* Paso 1 — ingresar email */}
        {step === 'email' && (
          <>
            <h2 className={styles.title}>Recuperar contraseña</h2>
            <p className={styles.subtitle}>Te enviamos un link para crear una nueva contraseña.</p>
            <form onSubmit={handleSendEmail} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input id="email" type="email" className={styles.input}
                  placeholder="tu@email.com" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button type="submit" className={styles.btnPrimary} disabled={loading || !email}>
                {loading ? 'Enviando...' : 'Enviar link de recuperación'}
              </button>
            </form>
          </>
        )}

        {/* Paso 2 — email enviado */}
        {step === 'sent' && (
          <div className={styles.sentBox}>
            <div className={styles.sentIcon}>📬</div>
            <h2>Revisá tu email</h2>
            <p>Te enviamos el link de recuperación a <strong>{email}</strong>.</p>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginTop: 8 }}>
              El link expira en 1 hora. Revisá también la carpeta de spam.
            </p>
            <button className={styles.switchBtn} onClick={() => setStep('email')}>
              ← Intentar con otro email
            </button>
          </div>
        )}

        {/* Paso 3 — nueva contraseña (viene del link del email) */}
        {step === 'nueva' && (
          <>
            <h2 className={styles.title}>Nueva contraseña</h2>
            <p className={styles.subtitle}>Elegí una contraseña segura para tu cuenta.</p>
            <form onSubmit={handleNewPassword} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="pwd">Nueva contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input id="pwd" type={showPwd ? 'text' : 'password'} className={styles.input}
                    placeholder="Mínimo 8 caracteres" value={password}
                    onChange={e => setPassword(e.target.value)} autoFocus
                    style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: 'var(--ink3)', fontSize: 16 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="cpwd">Repetir contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input id="cpwd" type={showPwd2 ? 'text' : 'password'} className={styles.input}
                    placeholder="Repetí la contraseña" value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    style={{ paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPwd2(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: 'var(--ink3)', fontSize: 16 }}>
                    {showPwd2 ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6,
                padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', marginBottom: 4 }}>
                <PasswordCheck label="Al menos 8 caracteres"         ok={pwdChecks.length} />
                <PasswordCheck label="Al menos una mayúscula"        ok={pwdChecks.upper} />
                <PasswordCheck label="Al menos un número"            ok={pwdChecks.number} />
                <PasswordCheck label="Al menos un carácter especial" ok={pwdChecks.special} />
                <PasswordCheck label="Las contraseñas coinciden"     ok={pwdMatch} />
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button type="submit" className={styles.btnPrimary}
                disabled={loading || !pwdValid || !pwdMatch}>
                {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}