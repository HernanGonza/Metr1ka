import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Mapa() {
  return (
    <div className={styles.page}>
      <Topbar title="Mapa" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Mapa — próximamente</p>
      </div>
    </div>
  )
}
