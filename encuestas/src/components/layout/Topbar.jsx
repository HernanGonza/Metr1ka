import styles from './Topbar.module.css'

export function Topbar({ title, actions }) {
  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
