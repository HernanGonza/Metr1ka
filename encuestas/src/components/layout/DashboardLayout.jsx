import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import styles from './DashboardLayout.module.css'

export function DashboardLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
