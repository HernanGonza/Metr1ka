import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, DashboardLayout } from './components/layout'

// Landing
import Landing from './pages/landing/Landing'

// Auth
import Login           from './pages/auth/Login'
import CompletarPerfil from './pages/auth/CompletarPerfil'

// Admin
import DashboardAdmin    from './pages/admin/Dashboard'
import MapaAdmin         from './pages/admin/Mapa'
import EncuestasAdmin    from './pages/admin/Encuestas'
import EquiposAdmin      from './pages/admin/Equipos'
import CoordinadoresAdmin from './pages/admin/Coordinadores'
import EncuestadoresAdmin from './pages/admin/Encuestadores'
import ReportesAdmin     from './pages/admin/Reportes'
import ConfiguracionAdmin from './pages/admin/Configuracion'

// Coordinador
import DashboardCoord  from './pages/coordinador/Dashboard'
import EquipoCoord     from './pages/coordinador/Equipo'
import EncuestasCoord  from './pages/coordinador/Encuestas'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Complete profile (authenticated but incomplete) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/completar-perfil" element={<CompletarPerfil />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute roles={['admin', 'superadmin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard"      element={<DashboardAdmin />} />
              <Route path="/mapa"           element={<MapaAdmin />} />
              <Route path="/encuestas"      element={<EncuestasAdmin />} />
              <Route path="/equipos"        element={<EquiposAdmin />} />
              <Route path="/coordinadores"  element={<CoordinadoresAdmin />} />
              <Route path="/encuestadores"  element={<EncuestadoresAdmin />} />
              <Route path="/reportes"       element={<ReportesAdmin />} />
              <Route path="/configuracion"  element={<ConfiguracionAdmin />} />
            </Route>
          </Route>

          {/* Coordinador routes */}
          <Route element={<ProtectedRoute roles={['coordinador']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardCoord />} />
              <Route path="/equipo"    element={<EquipoCoord />} />
              <Route path="/encuestas" element={<EncuestasCoord />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}