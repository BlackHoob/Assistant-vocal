import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Users, Calendar, Ticket, Shield, LogOut, ArrowLeft, Mic } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/appointments', icon: Calendar, label: 'Rendez-vous' },
  { to: '/admin/tickets', icon: Ticket, label: 'Billets' },
  { to: '/admin/admins', icon: Shield, label: 'Administrateurs' },
];

export default function AdminLayout() {
  const { adminUser, logoutAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logoutAdmin(); navigate('/admin/login'); };

  return (
    <div className="flex h-screen bg-gray-950 font-sans">
      <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3">
        {/* Logo */}
        <div className="flex items-center gap-3 px-3 mb-2">
          <div className="w-9 h-9 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Mic size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nestor Vocal</p>
            <p className="text-xs text-orange-400">Administration</p>
          </div>
        </div>

        {/* Retour app */}
        <button onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-4">
          <ArrowLeft size={12} /> Retour à l'application
        </button>

        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive ? 'bg-orange-500/10 text-orange-400 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`
              }>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 pt-4">
          <div className="px-3 mb-3">
            <p className="text-sm text-gray-300 font-medium">{adminUser?.username}</p>
            <p className="text-xs text-gray-600">{adminUser?.email}</p>
            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
              adminUser?.role === 'superadmin' ? 'bg-orange-500/10 text-orange-400' : 'bg-gray-700 text-gray-400'
            }`}>{adminUser?.role}</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={14} /> Déconnexion admin
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}