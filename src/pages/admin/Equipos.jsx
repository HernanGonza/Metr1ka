import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Equipos() {
  return (
    <div className={styles.page}>
      <Topbar title="Equipos" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Equipos — próximamente</p>
      </div>
    </div>
  )
}
