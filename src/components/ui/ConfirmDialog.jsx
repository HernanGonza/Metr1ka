import styles from './ConfirmDialog.module.css'

// Modal de confirmación estándar de la app — reemplaza a window.confirm(),
// que ignora el tema (claro/oscuro) y se ve como un alert nativo del browser.
// Uso: <ConfirmDialog title="..." message="..." onConfirm={...} onCancel={...} />
export function ConfirmDialog({
  icon = '⚠️',
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>{icon}</div>
        {title && <h3 className={styles.title}>{title}</h3>}
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={danger ? styles.btnConfirmDanger : styles.btnConfirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
