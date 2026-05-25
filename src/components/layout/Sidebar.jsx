import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROUTE_NAMES = {
  '/':             'Dashboard',
  '/nuevo-gasto':  'Nuevo Gasto',
  '/mis-gastos':   'Mis Gastos',
  '/gastos':       'Todos los Gastos',
  '/aprobaciones': 'Aprobaciones',

  '/caja':         'Control de Caja',
  '/admin':          'Usuarios',
  '/perfil':         'Mi Perfil',
  '/configuracion':  'Configuración',
}

function NavItem({ to, icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
         ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
      }
    >
      <span className="w-5 h-5">{icon}</span>
      {label}
    </NavLink>
  )
}

const ICONS = {
  home: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  plus: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  list: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  check: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  chart: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  cash: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  users: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  user: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  settings: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  logout: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const rol = profile?.rol
  const location = useLocation()
  const seccionActiva = ROUTE_NAMES[location.pathname] ?? 'ObraClara'

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 h-screen sticky top-0 p-4">
      {/* Logo + sección activa */}
      <div className="flex items-center gap-3 px-3 mb-6">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">OC</span>
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base leading-none">ObraClara</p>
          <p className="text-xs text-gray-400 mt-1 leading-none">{seccionActiva}</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        <NavItem to="/" icon={ICONS.home} label="Dashboard" end />

        {(rol === 'director' || rol === 'constructor' || rol === 'colaborador') && (
          <NavItem to="/nuevo-gasto" icon={ICONS.plus} label="Nuevo Gasto" />
        )}

        {rol === 'constructor' && (
          <NavItem to="/mis-gastos" icon={ICONS.list} label="Mis Gastos" />
        )}

        {(rol === 'director' || rol === 'colaborador' || rol === 'observador') && (
          <NavItem to="/gastos" icon={ICONS.list} label="Todos los Gastos" />
        )}

        {rol === 'director' && (
          <NavItem to="/aprobaciones" icon={ICONS.check} label="Aprobaciones" />
        )}


        {(rol === 'director' || rol === 'constructor' || rol === 'colaborador') && (
          <NavItem to="/caja" icon={ICONS.cash} label="Control de Caja" />
        )}

        {rol === 'director' && (
          <NavItem to="/admin" icon={ICONS.users} label="Usuarios" />
        )}

        {rol === 'director' && (
          <NavItem to="/configuracion" icon={ICONS.settings} label="Configuración" />
        )}

        <NavItem to="/perfil" icon={ICONS.user} label="Mi Perfil" />
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-100 pt-4 mt-4">
        <div className="px-3 mb-3">
          <p className="text-sm font-medium text-gray-800 truncate">{profile?.nombre}</p>
          <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <span className="w-5 h-5">{ICONS.logout}</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
