import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import LoadingSpinner from './components/ui/LoadingSpinner'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewExpense from './pages/NewExpense'
import MyExpenses from './pages/MyExpenses'
import AllExpenses from './pages/AllExpenses'
import Approvals from './pages/Approvals'
import Budget from './pages/Budget'
import CashControl from './pages/CashControl'
import Admin from './pages/Admin'
import ExpenseDetail from './pages/ExpenseDetail'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

// Protege rutas por autenticación y opcionalmente por roles
function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingSpinner fullScreen />
  if (!user)   return <Navigate to="/login" replace />
  if (!profile) return <LoadingSpinner fullScreen />

  if (roles && !roles.includes(profile.rol)) {
    return <Navigate to="/" replace />
  }

  return children
}

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

      {/* Autenticadas */}
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
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

      <Route path="/presupuesto" element={
        <ProtectedRoute roles={['director', 'colaborador', 'observador']}>
          <Budget />
        </ProtectedRoute>
      } />

      <Route path="/caja" element={
        <ProtectedRoute roles={['director', 'constructor']}>
          <CashControl />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute roles={['director']}>
          <Admin />
        </ProtectedRoute>
      } />

      <Route path="/gasto/:id" element={
        <ProtectedRoute>
          <ExpenseDetail />
        </ProtectedRoute>
      } />

      <Route path="/perfil" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
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
