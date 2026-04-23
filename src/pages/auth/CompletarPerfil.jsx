import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '../../hooks/usePerfil'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'
import styles from './CompletarPerfil.module.css'

function checkPassword(pwd) {
  return {
    length:  pwd.length >= 8,
    upper:   /[A-Z]/.test(pwd),
    number:  /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  }
}

function PasswordCheck({ label, ok }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: ok ? 'var(--accent2)' : 'var(--ink3)', transition: 'color .2s' }}>
      <span style={{ fontSize: 15 }}>{ok ? '✅' : '○'}</span>
      {label}
    </div>
  )
}

function Step({ title, subtitle, children, onNext, onBack, nextLabel = 'Siguiente →', nextDisabled = false, loading = false }) {
  return (
    <div className={styles.step}>
      <div className={styles.stepContent}>
        <h2 className={styles.stepTitle}>{title}</h2>
        {subtitle && <p className={styles.stepSub}>{subtitle}</p>}
        <div className={styles.stepFields}>{children}</div>
      </div>
      <div className={styles.stepFooter}>
        {onBack && <button className={styles.btnBack} onClick={onBack}>← Atrás</button>}
        <button className={styles.btnNext} onClick={onNext} disabled={nextDisabled || loading}>
          {loading ? 'Guardando...' : nextLabel}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}{required && <span style={{ color: 'var(--accent2)', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', autoFocus }) {
  const ref = useRef(null)
  const [showPwd, setShowPwd] = useState(false)
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 100) }, [autoFocus])
  if (type === 'password') {
    return (
      <div style={{ position: 'relative' }}>
        <input ref={ref} type={showPwd ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={styles.input} style={{ paddingRight: 40 }} />
        <button type="button" onClick={() => setShowPwd(v => !v)}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--ink3)', fontSize: 16, lineHeight: 1 }}>
          {showPwd ? '🙈' : '👁'}
        </button>
      </div>
    )
  }
  return <input ref={ref} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={styles.input} />
}

function SelectInput({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={styles.input}>
      <option value="">{placeholder || 'Seleccionar'}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

const PROVINCIAS = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán']

export default function CompletarPerfil() {
  const { updatePerfil } = usePerfil()
  const navigate = useNavigate()

  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError]     = useState('')
  const [currentUser, setCurrentUser]       = useState(null)
  const [isGoogleUser, setIsGoogleUser]     = useState(false)
  const [step, setStep]                     = useState(0)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')

  const [form, setForm] = useState({
    nombre_completo: '', telefono: '', dni: '', fecha_nacimiento: '',
    genero: '', telefono_alternativo: '', calle: '', numero: '',
    piso: '', departamento: '', barrio: '', localidad: '',
    provincia: '', codigo_postal: '', pais: 'Argentina',
  })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')

  useEffect(() => {
    async function init() {
      const hashParams   = new URLSearchParams(window.location.hash.replace('#', '?'))
      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type         = hashParams.get('type')

      console.log('hash:', window.location.hash)
      console.log('accessToken:', accessToken?.substring(0, 20))
      console.log('type:', type)
      if (accessToken && refreshToken && type === 'invite') {
        // Establecer sesión con el token de invitación directamente
        const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionErr || !sessionData.session) {
          // Si falla, intentar con exchangeCodeForSession por si el formato cambió
          setSessionError('El link de invitación es inválido o expiró. Pedí una nueva invitación.')
          setSessionLoading(false)
          return
        }

        setCurrentUser(sessionData.session.user)
        setIsGoogleUser(sessionData.session.user?.app_metadata?.provider === 'google')
        window.history.replaceState(null, '', window.location.pathname)

      } else {
        // No viene de invitación — verificar sesión existente
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/', { replace: true })
          return
        }
        setCurrentUser(session.user)
        setIsGoogleUser(session.user?.app_metadata?.provider === 'google')
      }

      setSessionLoading(false)
    }
    init()
  }, [navigate])

  function set(field) { return (val) => setForm(f => ({ ...f, [field]: val })) }

  const pwdChecks = checkPassword(password)
  const pwdValid  = Object.values(pwdChecks).every(Boolean)
  const pwdMatch  = password === confirm && confirm !== ''

  const TOTAL_STEPS = isGoogleUser ? 5 : 6
  const pct = Math.round((step / TOTAL_STEPS) * 100)

  function next() { setError(''); setStep(s => s + 1) }
  function back() { setError(''); setStep(s => s - 1) }

  async function handleFinish() {
    setSaving(true)
    setError('')
    try {
      // Setear contraseña si no es Google
      if (!isGoogleUser) {
        const { error: pwdErr } = await supabase.auth.updateUser({ password })
        if (pwdErr) throw new Error(pwdErr.message)
      }

      // Guardar perfil
      const ok = await updatePerfil({ ...form, perfil_completo: true })
      if (!ok) throw new Error('No se pudo guardar el perfil')

      // La sesión ya está activa después de updateUser
      // Redirigir directo al dashboard según rol — sin cerrar sesión
      // (el usuario ya completó el perfil, no tiene sentido pedirle login de nuevo)
      const { data: { user } } = await supabase.auth.getUser()
      const { data: perfil }   = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      if (perfil?.rol === 'superadmin' || perfil?.rol === 'editor') {
        navigate('/superadmin', { replace: true })
      } else if (perfil?.rol === 'coordinador') {
        navigate('/coord/dashboard', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }

    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  if (sessionLoading) return (
    <div className={styles.page}><Spinner center size="lg" /></div>
  )

  if (sessionError) return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <div className={styles.welcomeIcon}>❌</div>
        <h1 className={styles.welcomeTitle}>Link inválido</h1>
        <p className={styles.welcomeSub}>{sessionError}</p>
        <button className={styles.btnNext} onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
    </div>
  )

  if (step === 0) return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <div className={styles.welcomeIcon}>👋</div>
        <h1 className={styles.welcomeTitle}>¡Bienvenido!</h1>
        <p className={styles.welcomeSub}>Te invitaron a unirte al sistema. Vamos a completar tu perfil en unos pocos pasos.</p>
        <button className={styles.btnNext} onClick={() => setStep(1)}>Empezar →</button>
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.progressWrap}>
          <div className={styles.progressBar} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.progressLabel}>Paso {step} de {TOTAL_STEPS}</div>
        <div style={{ marginBottom: 28 }}>
          <svg width="110" height="9" viewBox="0 0 751 62" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 110, height: 'auto' }}>
            <path d="M76.224 54.144H61.824L114.24 0H138.24V61.44H114.24V19.584L121.44 22.56L83.52 61.44H54.72L16.704 22.656L24 19.68V61.44H0V0H24L76.224 54.144Z" fill="var(--ink)"/>
            <path d="M174.727 35.52V43.2H247.688V61.44H150.727V0H247.495V18.24H174.727V25.92H234.247V35.52H174.727Z" fill="var(--ink)"/>
            <path d="M255.334 0H355.174V18.24H255.334V0ZM293.254 16.992H317.254V61.44H293.254V16.992Z" fill="var(--ink)"/>
            <path d="M363.776 61.44V0H437.984C443.808 0 449.024 0.672001 453.632 2.016C458.304 3.296 461.984 5.472 464.672 8.544C467.424 11.616 468.8 15.808 468.8 21.12C468.8 24.64 468.16 27.552 466.88 29.856C465.6 32.16 463.84 33.952 461.6 35.232C459.36 36.512 456.8 37.44 453.92 38.016C451.04 38.592 448.032 38.944 444.896 39.072L437.888 37.728C445.504 37.792 451.36 38.112 455.456 38.688C459.616 39.264 462.496 40.32 464.096 41.856C465.76 43.328 466.592 45.472 466.592 48.288V61.44H442.592V51.168C442.592 49.248 442.208 47.808 441.44 46.848C440.736 45.824 439.136 45.12 436.64 44.736C434.208 44.352 430.432 44.16 425.312 44.16H387.776V61.44H363.776ZM387.776 28.128H437.984C439.904 28.128 441.504 27.808 442.784 27.168C444.128 26.528 444.8 25.312 444.8 23.52C444.8 21.856 444.128 20.736 442.784 20.16C441.504 19.52 439.904 19.2 437.984 19.2H387.776V28.128Z" fill="var(--ink)"/>
            <path d="M476.809 32.64V14.4H518.473V61.44H495.433V32.64H476.809Z" fill="#52B788"/>
            <path d="M582.149 31.2V25.824L637.541 61.44H601.829L554.789 28.8L598.181 0H632.357L582.149 31.2ZM530.981 0H554.981V61.44H530.981V0Z" fill="var(--ink)"/>
            <path d="M662.39 52.128V37.728H728.054V52.128H662.39ZM640.886 61.44L682.07 0H708.758L750.326 61.44H723.926L688.31 6.432H702.614L667.286 61.44H640.886Z" fill="var(--ink)"/>
          </svg>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <Step title="¿Cómo te llamás?" subtitle="Tu nombre completo tal como aparece en tu documento."
            onNext={() => { if (!form.nombre_completo.trim()) { setError('El nombre es obligatorio'); return } next() }}
            onBack={() => setStep(0)} nextDisabled={!form.nombre_completo.trim()}>
            <Field label="Nombre completo" required>
              <TextInput value={form.nombre_completo} onChange={set('nombre_completo')} placeholder="Juan Pérez" autoFocus />
            </Field>
          </Step>
        )}

        {step === 2 && (
          <Step title="Datos personales" subtitle="Necesitamos algunos datos para tu ficha."
            onNext={() => { if (!form.dni || !form.fecha_nacimiento || !form.genero) { setError('Completá todos los campos obligatorios'); return } next() }}
            onBack={back} nextDisabled={!form.dni || !form.fecha_nacimiento || !form.genero}>
            <Field label="DNI" required>
              <TextInput value={form.dni} onChange={set('dni')} placeholder="12345678" autoFocus />
            </Field>
            <Field label="Fecha de nacimiento" required>
              <TextInput type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} />
            </Field>
            <Field label="Género" required>
              <SelectInput value={form.genero} onChange={set('genero')} placeholder="Seleccioná tu género"
                options={[{ value: 'masculino', label: 'Masculino' }, { value: 'femenino', label: 'Femenino' }, { value: 'otro', label: 'Otro' }]} />
            </Field>
          </Step>
        )}

        {step === 3 && (
          <Step title="¿Cuál es tu teléfono?" subtitle="Número de contacto principal."
            onNext={() => { if (!form.telefono.trim()) { setError('El teléfono es obligatorio'); return } next() }}
            onBack={back} nextDisabled={!form.telefono.trim()}>
            <Field label="Teléfono" required>
              <TextInput value={form.telefono} onChange={set('telefono')} placeholder="+54 9 376 4123456" autoFocus />
            </Field>
            <Field label="Teléfono alternativo">
              <TextInput value={form.telefono_alternativo} onChange={set('telefono_alternativo')} placeholder="+54 9 11 1234567" />
            </Field>
          </Step>
        )}

        {step === 4 && (
          <Step title="¿Dónde vivís?" subtitle="Dirección de residencia."
            onNext={() => { if (!form.calle || !form.numero || !form.localidad || !form.provincia) { setError('Completá los campos obligatorios'); return } next() }}
            onBack={back} nextDisabled={!form.calle || !form.numero || !form.localidad || !form.provincia}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Calle" required><TextInput value={form.calle} onChange={set('calle')} placeholder="San Martín" autoFocus /></Field>
              <Field label="Número" required><TextInput value={form.numero} onChange={set('numero')} placeholder="1234" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Piso / Depto"><TextInput value={form.piso} onChange={set('piso')} placeholder="2° A" /></Field>
              <Field label="Barrio"><TextInput value={form.barrio} onChange={set('barrio')} placeholder="Centro" /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Localidad" required><TextInput value={form.localidad} onChange={set('localidad')} placeholder="Posadas" /></Field>
              <Field label="Código postal"><TextInput value={form.codigo_postal} onChange={set('codigo_postal')} placeholder="3300" /></Field>
            </div>
            <Field label="Provincia" required>
              <SelectInput value={form.provincia} onChange={set('provincia')} placeholder="Seleccioná tu provincia"
                options={PROVINCIAS.map(p => ({ value: p, label: p }))} />
            </Field>
          </Step>
        )}

        {step === 5 && !isGoogleUser && (
          <Step title="Elegí tu contraseña" subtitle="Usala para ingresar cada vez."
            onNext={() => { if (!pwdValid) { setError('La contraseña no cumple todos los requisitos'); return } if (!pwdMatch) { setError('Las contraseñas no coinciden'); return } next() }}
            onBack={back} nextDisabled={!pwdValid || !pwdMatch}>
            <Field label="Contraseña" required>
              <TextInput type="password" value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" autoFocus />
            </Field>
            <Field label="Repetir contraseña" required>
              <TextInput type="password" value={confirm} onChange={setConfirm} placeholder="Repetí la contraseña" />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: '12px 14px', background: 'var(--surface)', borderRadius: 'var(--r)' }}>
              <PasswordCheck label="Al menos 8 caracteres"         ok={pwdChecks.length}  />
              <PasswordCheck label="Al menos una mayúscula"        ok={pwdChecks.upper}   />
              <PasswordCheck label="Al menos un número"            ok={pwdChecks.number}  />
              <PasswordCheck label="Al menos un carácter especial" ok={pwdChecks.special} />
              <PasswordCheck label="Las contraseñas coinciden"     ok={pwdMatch}          />
            </div>
          </Step>
        )}

        {step === TOTAL_STEPS && (
          <Step title="¡Todo listo!" subtitle="Revisá tu información antes de confirmar."
            onNext={handleFinish} onBack={back} nextLabel="Confirmar →" loading={saving}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Nombre',     value: form.nombre_completo },
                { label: 'DNI',        value: form.dni },
                { label: 'Nacimiento', value: form.fecha_nacimiento },
                { label: 'Género',     value: form.genero },
                { label: 'Teléfono',   value: form.telefono },
                { label: 'Dirección',  value: `${form.calle} ${form.numero}${form.piso ? `, ${form.piso}` : ''}, ${form.localidad}, ${form.provincia}` },
                !isGoogleUser && { label: 'Contraseña', value: '••••••••' },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 13 }}>
                  <span style={{ color: 'var(--ink3)', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{item.value || '—'}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 12, lineHeight: 1.5 }}>
              Te vamos a enviar un email de confirmación. Tocá el link del email para activar tu cuenta e ingresar.
            </p>
          </Step>
        )}
      </div>
    </div>
  )
}