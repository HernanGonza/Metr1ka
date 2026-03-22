import styles from './Badge.module.css'

const VARIANTS = {
  admin:       styles.admin,
  coordinador: styles.coordinador,
  encuestador: styles.encuestador,
  success:     styles.success,
  warning:     styles.warning,
  danger:      styles.danger,
  neutral:     styles.neutral,
  info:        styles.info,
}

export function Badge({ children, variant = 'neutral', small = false }) {
  return (
    <span className={[styles.badge, VARIANTS[variant] || styles.neutral, small ? styles.small : ''].join(' ')}>
      {children}
    </span>
  )
}
