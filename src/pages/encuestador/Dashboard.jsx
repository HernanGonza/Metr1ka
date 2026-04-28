import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import styles from '../admin/Page.module.css'

export default function DashboardEncuestador() {
  const { perfil } = useAuth()
  const iniciales = (perfil?.nombre_completo || '?')
    .split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()

  return (
    <div className={styles.page}>
      <Topbar title="Mi cuenta" />
      <div className={styles.content}>
        <div style={{ maxWidth: 500, margin: '0 auto', paddingTop: 20 }}>
          <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
              {iniciales}
            </div>
            <div style={{ fontFamily: 'Syne', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              {perfil?.nombre_completo}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 20 }}>Encuestador · Metr1ka</div>
            <div style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>
              Usá la app móvil de Metr1ka para realizar encuestas.<br/>
              Descargala desde la sección <strong>Descargar App</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}