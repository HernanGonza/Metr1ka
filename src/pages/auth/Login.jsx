import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'
import { Mail, Lock, Zap, ArrowLeft } from 'lucide-react'
import styles from './Login.module.css'
import { useTheme } from '../../hooks/useTheme'

async function getRedirectPath() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/login'
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol === 'superadmin' || perfil?.rol === 'editor') return '/superadmin'
  return '/dashboard'
}


function LogoSvgLogin({ isDark }) {
  const color = isDark ? '#ffffff' : '#0a0a0a'
  const accent = '#52B788'
  return (
    <svg width="160" height="14" viewBox="0 0 751 62" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export default function Login() {
  const { isDark } = useTheme()
  const [mode, setMode]         = useState('password')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invited = searchParams.get('invited') === 'true'

  // Handle magic link callback and email confirmation
  useEffect(() => {
    const hashParams   = new URLSearchParams(window.location.hash.replace('#', '?'))
    const searchParams = new URLSearchParams(window.location.search)
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const code         = searchParams.get('code')
    const tokenHash    = searchParams.get('token_hash')
    const type         = searchParams.get('type')

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(async ({ data, error }) => {
          if (!error && data.session) navigate(await getRedirectPath(), { replace: true })
        })
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(async ({ data, error }) => {
          if (!error && data.session) navigate(await getRedirectPath(), { replace: true })
        })
    } else if (tokenHash && type === 'email') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        .then(async ({ data, error }) => {
          if (!error && data.session) {
            await supabase.auth.signOut()
            window.history.replaceState(null, '', '/login?confirmed=true')
            window.location.reload()
          }
        })
    }
  }, [navigate])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate(await getRedirectPath(), { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  async function handlePasswordLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })
    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true); setError('')
    // NOTA: Configurar VITE_GOOGLE_CLIENT_ID en .env y habilitar proveedor Google en Supabase Dashboard
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      }
    })
    if (err) { setError(err.message); setGoogleLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <div className={styles.brand}>
          <LogoSvgLogin isDark={isDark} />
        </div>

        {invited && (
          <div className={styles.alert}>
            ✅ Contraseña guardada. Ya podés ingresar con tu email y tu nueva contraseña.
          </div>
        )}
        {searchParams.get('registered') === 'true' && (
          <div className={styles.alert}>
            🎉 ¡Registro completado! Ya podés ingresar con tu email y contraseña.
          </div>
        )}
        {searchParams.get('confirmed') === 'true' && (
          <div className={styles.alert}>
            ✅ Email confirmado. Podés ingresar.
          </div>
        )}

        {sent ? (
          <div className={styles.sentBox}>
            <div className={styles.sentIcon}>📬</div>
            <h2>Revisá tu email</h2>
            <p>Te enviamos un link de acceso a <strong>{email}</strong>.</p>
            <button className={styles.switchBtn} onClick={() => { setSent(false); setMode('password') }}>
              ← Volver al login
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>Bienvenido</h2>
            <p className={styles.subtitle}>Ingresá con tu cuenta de Metr1ka</p>

            {/* Google Login — listo para activar con la API key */}
            <button
              className={styles.btnGoogle}
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              {googleLoading ? 'Conectando...' : 'Continuar con Google'}
            </button>

            <div className={styles.divider}><span>o</span></div>

            <div className={styles.modeTabs}>
              <button
                className={[styles.modeTab, mode === 'password' ? styles.modeTabActive : ''].join(' ')}
                onClick={() => { setMode('password'); setError('') }}
              >
                <Lock size={14} /> Contraseña
              </button>
              <button
                className={[styles.modeTab, mode === 'magic' ? styles.modeTabActive : ''].join(' ')}
                onClick={() => { setMode('magic'); setError('') }}
              >
                <Zap size={14} /> Link mágico
              </button>
            </div>

            {mode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className={styles.form}>
                <Input id="email" type="email" label="Email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
                <Input id="password" type="password" label="Contraseña" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required error={error} />
                <Button type="submit" loading={loading} fullWidth size="lg">
                  Ingresar
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className={styles.form}>
                <p className={styles.magicDesc}>
                  <Mail size={14} /> Te enviamos un link directo a tu email. No necesitás contraseña.
                </p>
                <Input id="email-magic" type="email" label="Email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} required error={error} />
                <Button type="submit" loading={loading} fullWidth size="lg">
                  Enviar link de acceso
                </Button>
              </form>
            )}

            <p className={styles.inviteNote}>
              ¿No tenés cuenta? El acceso es solo por invitación.
            </p>
          </>
        )}
      </div>
    </div>
  )
}