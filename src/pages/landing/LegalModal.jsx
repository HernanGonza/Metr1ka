import styles from './Landing.module.css'
import { X } from 'lucide-react'

export default function LegalModal({ title, content, onClose }) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        
        {/* HEADER reutilizado */}
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>{title}</h3>
          </div>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO LEGAL */}
        <div className={styles.legalContent}>
          {content}
        </div>

      </div>
    </div>
  )
}