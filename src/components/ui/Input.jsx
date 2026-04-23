import { useState } from 'react'
import styles from './Input.module.css'

export function Input({
  label,
  error,
  hint,
  id,
  type,
  ...props
}) {
  const [showPwd, setShowPwd] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label} htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input id={id} type={isPassword ? (showPwd ? 'text' : 'password') : type}
          className={[styles.input, error ? styles.hasError : ''].join(' ')}
          style={isPassword ? { paddingRight: 40 } : undefined}
          {...props} />
        {isPassword && (
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--ink3)', fontSize: 16, lineHeight: 1 }}>
            {showPwd ? '🙈' : '👁'}
          </button>
        )}
      </div>
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