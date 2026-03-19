import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Encuestadores() {
  return (
    <div className={styles.page}>
      <Topbar title="Encuestadores" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Encuestadores — próximamente</p>
      </div>
    </div>
  )
}
