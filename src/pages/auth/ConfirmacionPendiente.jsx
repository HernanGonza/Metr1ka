import { useLocation, useNavigate } from 'react-router-dom'
import styles from './Login.module.css'

export default function ConfirmacionPendiente() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || 'tu correo'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMain}>Encuestas </span>
          <span className={styles.brandSub}>Enfoque Misiones</span>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>📬</div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 800, letterSpacing: -.5, marginBottom: 12 }}>
            Revisá tu email
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 8 }}>
            Te enviamos un correo a
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 20 }}>
            {email}
          </p>
          <p style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 32 }}>
            Hacé clic en el link del email para confirmar tu cuenta. Una vez confirmada, vas a poder ingresar con tu email y contraseña.
          </p>
          <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--ink3)', marginBottom: 24 }}>
            ¿No lo encontrás? Revisá la carpeta de spam o correo no deseado.
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--accent2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Volver al login
          </button>
        </div>
      </div>
    </div>
  )
}