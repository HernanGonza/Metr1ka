import { Topbar } from '../../components/layout'
import styles from '../admin/Page.module.css'

export default function DashboardCoord() {
  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Vista Coordinador — Dashboard — próximamente</p>
      </div>
    </div>
  )
}
