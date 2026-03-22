import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button, Input } from '../../components/ui'
import styles from './Login.module.css'

export default function Login() {
  const [mode, setMode]       = useState('password')  // 'password' | 'magic'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()

  // Handle magic link callback
  useEffect(() => {
    const hashParams   = new URLSearchParams(window.location.hash.replace('#', '?'))
    const searchParams = new URLSearchParams(window.location.search)
    const accessToken  = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const code         = searchParams.get('code')

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (!error && data.session) navigate('/dashboard', { replace: true })
        })
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (!error && data.session) navigate('/dashboard', { replace: true })
        })
    }
  }, [navigate])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard', { replace: true })
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
          <span className={styles.brandMain}>Encuestas</span>
          <span className={styles.brandSub}>Enfoque</span>
        </div>

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