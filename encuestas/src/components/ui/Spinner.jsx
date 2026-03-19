import styles from './Spinner.module.css'

export function Spinner({ size = 'md', center = false }) {
  return (
    <div className={[styles.wrap, center ? styles.center : ''].join(' ')}>
      <div className={[styles.spinner, styles[size]].join(' ')} />
    </div>
  )
}
