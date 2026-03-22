import styles from './Button.module.css'

export function Button({
  children,
  variant = 'primary',   // primary | outline | ghost | danger
  size = 'md',           // sm | md | lg
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : '',
        loading   ? styles.loading  : '',
      ].join(' ')}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {children}
    </button>
  )
}
