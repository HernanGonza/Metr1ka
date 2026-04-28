import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui'

function homeByRol(rol) {
  if (rol === 'superadmin' || rol === 'editor') return '/superadmin'
  if (rol === 'coordinador') return '/coord/dashboard'
  if (rol === 'encuestador') return '/encuestador'
  return '/dashboard'
}
export function ProtectedRoute({ roles = null }) {
  const { user, perfil, loading, rol, perfilCompleto } = useAuth()

  // Esperar tanto la sesión como el perfil
  if (loading || (user && perfil === null)) {
    return <Spinner center size="lg" />
  }

  // No autenticado → landing
  if (!user) return <Navigate to="/" replace />

  // Perfil incompleto → completar
  if (!perfilCompleto && window.location.pathname !== '/completar-perfil') {
    return <Navigate to="/completar-perfil" replace />
  }

  // Rol no permitido → home según su rol
  if (roles && rol && !roles.includes(rol)) {
    return <Navigate to={homeByRol(rol)} replace />
  }

  return <Outlet />
}