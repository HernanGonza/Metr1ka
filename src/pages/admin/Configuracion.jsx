import { Topbar } from '../../components/layout'
import styles from './Page.module.css'

export default function Configuracion() {
  return (
    <div className={styles.page}>
      <Topbar title="Configuracion" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Pantalla de Configuracion — próximamente</p>
      </div>
    </div>
  )
}
