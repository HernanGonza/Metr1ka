import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Coordinadores() {
  return (
    <div className={styles.page}>
      <Topbar title="Coordinadores" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Coordinadores — próximamente</p>
      </div>
    </div>
  )
}
