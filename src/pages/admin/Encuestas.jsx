import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Encuestas() {
  return (
    <div className={styles.page}>
      <Topbar title="Encuestas" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Encuestas — próximamente</p>
      </div>
    </div>
  )
}
