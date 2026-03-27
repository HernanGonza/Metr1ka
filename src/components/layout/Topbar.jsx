import styles from './Topbar.module.css'

export function Topbar({ title, back, badge, action, actions }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {back && (
          <button onClick={back.onClick} className={styles.backBtn}>
            ← {back.label}
          </button>
        )}
        <div>
          <h1 className={styles.title}>{title}</h1>
        </div>
        {badge && (
          <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
      </div>
      <div className={styles.actions}>
        {actions}
        {action && (
          <button onClick={action.onClick} className={styles.btnPrimary}>
            {action.label}
          </button>
        )}
      </div>
    </header>
  )
}