import { Topbar } from '../../components/layout'
import styles from '../admin/Page.module.css'

export default function EncuestasCoord() {
  return (
    <div className={styles.page}>
      <Topbar title="Encuestas" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Vista Coordinador — Encuestas — próximamente</p>
      </div>
    </div>
  )
}
