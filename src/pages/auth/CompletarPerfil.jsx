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
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 100) }, [autoFocus])
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

      // Cerrar sesión y navegar al login
      await supabase.auth.signOut()
      navigate('/login?registered=true', { replace: true })

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
        <div className={styles.brand}>
          <span className={styles.brandMain}>Encuestas </span>
          <span className={styles.brandSub}>Enfoque Misiones</span>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fdecea', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
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