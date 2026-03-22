import { Topbar } from '../../components/layout'
import styles from '../admin/Page.module.css'

export default function EquipoCoord() {
  return (
    <div className={styles.page}>
      <Topbar title="Equipo" />
      <div className={styles.content}>
        <p className={styles.placeholder}>Vista Coordinador — Equipo — próximamente</p>
      </div>
    </div>
  )
}
