import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Bot, Calendar, FileText, Ticket, User, LogOut, Mic, Shield } from 'lucide-react';

const navItems = [
  { to: '/', icon: Bot, label: 'Assistant IA', end: true },
  { to: '/rendez-vous', icon: Calendar, label: 'Rendez-vous' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/billets', icon: Ticket, label: 'Billets' },
  { to: '/profil', icon: User, label: 'Profil' },
];

export default function Layout() {
  const { logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'NV';

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <aside className="w-64 border-r border-orange-50 flex flex-col py-6 px-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-9 h-9 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30">
            <Mic size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-none">Nestor</p>
            <p className="text-xs text-gray-400 mt-0.5">Vocal</p>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`
              }>
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? 'text-orange-500' : ''} />
                  {label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
                </>
              )}
            </NavLink>
          ))}

          {/* Lien admin visible uniquement si connecté admin */}
          {isAdmin() && (
            <NavLink to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mt-2 border ${
                  isActive ? 'bg-orange-500 text-white border-orange-500' : 'text-orange-500 border-orange-200 hover:bg-orange-50'
                }`
              }>
              <Shield size={15} />
              Administration
            </NavLink>
          )}
        </nav>

        <div className="border-t border-gray-50 pt-4 mt-4">
          {user && (
            <div className="flex items-center gap-3 px-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 text-xs font-semibold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-red-500 w-full rounded-xl hover:bg-red-50 transition-all">
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
