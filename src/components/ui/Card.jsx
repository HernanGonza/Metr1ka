import styles from './Card.module.css'

export function Card({ children, className = '', padding = 'md', ...props }) {
  return (
    <div className={[styles.card, styles[padding], className].join(' ')} {...props}>
      {children}
    </div>
  )
}
