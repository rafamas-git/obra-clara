import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import LoadingSpinner from './components/ui/LoadingSpinner'

import Login               from './pages/Login'
import Dashboard           from './pages/Dashboard'
import NewExpense          from './pages/NewExpense'
import MyExpenses          from './pages/MyExpenses'
import AllExpenses         from './pages/AllExpenses'
import Approvals           from './pages/Approvals'
import CashControl         from './pages/CashControl'
import Admin               from './pages/Admin'
import ExpenseDetail       from './pages/ExpenseDetail'
import Profile             from './pages/Profile'
import Settings            from './pages/Settings'
import ObraSelector        from './pages/ObraSelector'
import SuperadminDashboard from './pages/SuperadminDashboard'

// Protege rutas normales (requiere obra seleccionada)
// roles usa los valores nuevos: 'admin', 'constructor', 'colaborador', 'observador'
// pero también acepta 'director' por compatibilidad (se mapea a 'admin')
function ProtectedRoute({ children, roles }) {
  const { user, profile, loading, isSuperadmin, obraActual, misObras, rolEnObra } = useAuth()

  if (loading) return <LoadingSpinner fullScreen />
  if (!user)   return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner fullScreen />

  // Superadmin va a su propio panel
  if (isSuperadmin) return <Navigate to="/superadmin" replace />

  // Usuario sin obras asignadas
  if (misObras.length === 0) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-600">Tu cuenta no tiene acceso a ninguna obra.</p>
        <p className="text-sm text-gray-400 mt-1">Contacta al administrador.</p>
      </div>
    </div>
  )

  // Usuario con varias obras sin seleccionar
  if (!obraActual) return <Navigate to="/seleccionar-obra" replace />

  // Check de rol: 'director' se mapea a 'admin' por compatibilidad
  if (roles) {
    const mappedRoles = roles.map(r => r === 'director' ? 'admin' : r)
    if (!mappedRoles.includes(rolEnObra)) return <Navigate to="/" replace />
  }

  return children
}

// Ruta exclusiva para superadmin
function SuperadminRoute({ children }) {
  const { user, profile, loading, isSuperadmin } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user)   return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner fullScreen />
  if (!isSuperadmin) return <Navigate to="/" replace />
  return children
}

// Ruta pública: redirige si ya está autenticado
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (user) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Pública */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* Selector de obra */}
      <Route path="/seleccionar-obra" element={<ObraSelector />} />

      {/* Superadmin */}
      <Route path="/superadmin" element={
        <SuperadminRoute><SuperadminDashboard /></SuperadminRoute>
      } />

      {/* Rutas de obra */}
      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      <Route path="/nuevo-gasto" element={
        <ProtectedRoute roles={['director', 'constructor', 'colaborador']}>
          <NewExpense />
        </ProtectedRoute>
      } />

      <Route path="/mis-gastos" element={
        <ProtectedRoute roles={['constructor']}>
          <MyExpenses />
        </ProtectedRoute>
      } />

      <Route path="/gastos" element={
        <ProtectedRoute roles={['director', 'colaborador', 'observador']}>
          <AllExpenses />
        </ProtectedRoute>
      } />

      <Route path="/aprobaciones" element={
        <ProtectedRoute roles={['director']}>
          <Approvals />
        </ProtectedRoute>
      } />

      <Route path="/caja" element={
        <ProtectedRoute roles={['director', 'constructor', 'colaborador']}>
          <CashControl />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute roles={['director']}>
          <Admin />
        </ProtectedRoute>
      } />

      <Route path="/gasto/:id" element={
        <ProtectedRoute><ExpenseDetail /></ProtectedRoute>
      } />

      <Route path="/perfil" element={
        <ProtectedRoute><Profile /></ProtectedRoute>
      } />

      <Route path="/configuracion" element={
        <ProtectedRoute roles={['director']}>
          <Settings />
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
