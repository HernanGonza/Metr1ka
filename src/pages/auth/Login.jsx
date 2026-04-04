import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'
import styles from './Login.module.css'
import logoMetr1ka from '../../assets/LogoMetr1ka.svg'

async function getRedirectPath() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/login'
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol === 'superadmin' || perfil?.rol === 'editor') return '/superadmin'
  return '/dashboard'
}
export default function Login() {
  const [mode, setMode]         = useState('password')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
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
      // Email confirmation link
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
        .then(async ({ data, error }) => {
          if (!error && data.session) {
            await supabase.auth.signOut()
            // Show confirmed message
            window.history.replaceState(null, '', '/login?confirmed=true')
            window.location.reload()
          }
        })
    }
  }, [navigate])

  // Listen for auth state changes
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
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` }
    })

    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src={logoMetr1ka} alt="Logo Metr1ka" className={styles.logo} />
        </div>

        {invited && (
          <div style={{ padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 'var(--r)', fontSize: 14, color: 'var(--accent2)', marginBottom: 20, borderLeft: '3px solid var(--accent2)' }}>
            ✅ Contraseña guardada. Ya podés ingresar con tu email y tu nueva contraseña.
          </div>
        )}
        {searchParams.get('registered') === 'true' && (
          <div style={{ padding: '12px 16px', background: 'var(--accent-light)', borderRadius: 'var(--r)', fontSize: 14, color: 'var(--accent2)', marginBottom: 20, borderLeft: '3px solid var(--accent2)' }}>
            🎉 ¡Registro completado! Ya podés ingresar con tu email y contraseña.
          </div>
        )}
        {sent ? (
          <div className={styles.sentBox}>
            <div className={styles.sentIcon}>📬</div>
            <h2>Revisá tu email</h2>
            <p>Te enviamos un link de acceso a <strong>{email}</strong>. Hacé clic en el link para ingresar.</p>
            <button className={styles.switchBtn} onClick={() => { setSent(false); setMode('password') }}>
              Volver al login
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>Ingresar</h2>

            <div className={styles.modeTabs}>
              <button
                className={[styles.modeTab, mode === 'password' ? styles.modeTabActive : ''].join(' ')}
                onClick={() => { setMode('password'); setError('') }}
              >
                Contraseña
              </button>
              <button
                className={[styles.modeTab, mode === 'magic' ? styles.modeTabActive : ''].join(' ')}
                onClick={() => { setMode('magic'); setError('') }}
              >
                Link mágico
              </button>
            </div>

            {mode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className={styles.form}>
                <Input
                  id="email"
                  type="email"
                  label="Email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <Input
                  id="password"
                  type="password"
                  label="Contraseña"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  error={error}
                />
                <Button type="submit" loading={loading} fullWidth size="lg">
                  Ingresar
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className={styles.form}>
                <p className={styles.subtitle}>
                  Te enviamos un link a tu email, no necesitás contraseña.
                </p>
                <Input
                  id="email-magic"
                  type="email"
                  label="Email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  error={error}
                />
                <Button type="submit" loading={loading} fullWidth size="lg">
                  Enviar link de acceso
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}