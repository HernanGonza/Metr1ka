import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Dashboard() {
  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Dashboard — próximamente</p>
      </div>
    </div>
  )
}
