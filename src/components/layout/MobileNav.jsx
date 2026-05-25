import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Tab({ to, label, icon, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-[10px] font-medium transition-colors
         ${isActive ? 'text-primary-600' : 'text-gray-400'}`
      }
    >
      <span className="w-6 h-6">{icon}</span>
      {label}
    </NavLink>
  )
}

const ICONS = {
  home:  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  list:  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  check: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  cash:  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  user:  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
}

export default function MobileNav() {
  const { rolEnObra } = useAuth()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-bottom">
      <div className="flex items-stretch">
        <Tab to="/" label="Inicio" icon={ICONS.home} end />

        {(rolEnObra === 'admin' || rolEnObra === 'constructor' || rolEnObra === 'colaborador') && (
          <NavLink
            to="/nuevo-gasto"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-[10px] font-medium transition-colors
               ${isActive ? 'text-primary-600' : 'text-gray-400'}`
            }
          >
            <span className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center -mt-5 shadow-lg shadow-primary-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <span className="mt-0.5">Nuevo</span>
          </NavLink>
        )}

        {rolEnObra === 'constructor' && (
          <Tab to="/mis-gastos" label="Mis Gastos" icon={ICONS.list} />
        )}
        {(rolEnObra === 'admin' || rolEnObra === 'colaborador' || rolEnObra === 'observador') && (
          <Tab to="/gastos" label="Gastos" icon={ICONS.list} />
        )}

        {rolEnObra === 'admin' && (
          <Tab to="/aprobaciones" label="Aprobar" icon={ICONS.check} />
        )}

        {(rolEnObra === 'admin' || rolEnObra === 'constructor' || rolEnObra === 'colaborador') && (
          <Tab to="/caja" label="Caja" icon={ICONS.cash} />
        )}

        <Tab to="/perfil" label="Perfil" icon={ICONS.user} />
      </div>
    </nav>
  )
}
