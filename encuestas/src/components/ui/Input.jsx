import styles from './Input.module.css'

export function Input({
  label,
  error,
  hint,
  id,
  ...props
}) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <input id={id} className={[styles.input, error ? styles.hasError : ''].join(' ')} {...props} />
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

export function Textarea({ label, error, hint, id, ...props }) {
  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <textarea id={id} className={[styles.input, styles.textarea, error ? styles.hasError : ''].join(' ')} {...props} />
      {error && <span className={styles.error}>{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
