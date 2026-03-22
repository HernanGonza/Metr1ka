import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui'

export function ProtectedRoute({ roles = null }) {
  const { user, perfil, loading, rol, perfilCompleto } = useAuth()

  // Esperar tanto la sesión como el perfil
  if (loading || (user && perfil === null)) {
    return <Spinner center size="lg" />
  }

  if (!user) return <Navigate to="/" replace />

  // Perfil incompleto → obligar a completarlo
  if (!perfilCompleto && window.location.pathname !== '/completar-perfil') {
    return <Navigate to="/completar-perfil" replace />
  }

  // Rol no permitido
  if (roles && rol && !roles.includes(rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}