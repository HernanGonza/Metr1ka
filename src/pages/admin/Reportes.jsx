import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Reportes() {
  return (
    <div className={styles.page}>
      <Topbar title="Reportes" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Reportes — próximamente</p>
      </div>
    </div>
  )
}
