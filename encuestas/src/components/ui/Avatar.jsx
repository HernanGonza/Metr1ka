import styles from './Avatar.module.css'

export function Avatar({ initials, src, size = 'md', bg, color }) {
  const style = {}
  if (bg)    style.background = bg
  if (color) style.color = color
  return (
    <div className={[styles.avatar, styles[size]].join(' ')} style={style}>
      {src
        ? <img src={src} alt={initials} className={styles.img} />
        : <span>{initials}</span>
      }
    </div>
  )
}
