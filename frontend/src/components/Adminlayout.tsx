import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { LayoutDashboard, Users, Calendar, Ticket, Shield, LogOut, Mic, ArrowLeft,
         Languages, Moon, Sun, Bell, BellOff, Check, X, Menu,
         CalendarClock, FileWarning, Plane, Info } from 'lucide-react';

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'ar', label: 'العربية',  flag: '🇲🇦' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'pt', label: 'Português',flag: '🇧🇷' },
];

const navItems = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Dashboard',      end: true },
  { to: '/admin/users',        icon: Users,           label: 'Utilisateurs'            },
  { to: '/admin/appointments', icon: Calendar,        label: 'Rendez-vous'             },
  { to: '/admin/tickets',      icon: Ticket,          label: 'Billets'                 },
  { to: '/admin/admins',       icon: Shield,          label: 'Administrateurs'         },
];

export default function AdminLayout() {
  const { adminUser, logoutAdmin } = useAuth();
  const navigate = useNavigate();

  // ─── SIDEBAR MOBILE ──────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── THÈME ───────────────────────────────────────────────
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // ─── LANGUE ──────────────────────────────────────────────
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'fr');
  const [showLang, setShowLang] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const handleLang = (code: string) => {
    setLang(code);
    localStorage.setItem('lang', code);
    (window as any).__nestorLang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    setShowLang(false);
  };

  // ─── NOTIFICATIONS ───────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('notif') !== 'false');
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unread, markRead, markAllRead, dismiss, refresh } = useNotifications(notifEnabled);
  const toggleNotif = () => { setNotifEnabled(p => { localStorage.setItem('notif', String(!p)); return !p; }); };

  const categoryIcon = (cat: string) => {
    if (cat === 'appointment') return <CalendarClock size={13} className="flex-shrink-0" />;
    if (cat === 'document')    return <FileWarning size={13} className="flex-shrink-0" />;
    if (cat === 'ticket')      return <Plane size={13} className="flex-shrink-0" />;
    return <Info size={13} className="flex-shrink-0" />;
  };
  const typeColor = (t: string) => ({ warning:'text-orange-500', error:'text-red-500', success:'text-green-500' }[t] || 'text-blue-500');
  const dotColor  = (t: string) => ({ warning:'bg-orange-400',   error:'bg-red-500',   success:'bg-green-500'   }[t] || 'bg-blue-400');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current  && !langRef.current.contains(e.target  as Node)) setShowLang(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = adminUser?.username?.slice(0, 2).toUpperCase() || 'AD';

  // ─── SIDEBAR CONTENT ─────────────────────────────────────
  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-3">
        <div className="w-9 h-9 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30">
          <Mic size={16} className="text-white" />
        </div>
        <div>
          <p className={`font-semibold text-sm leading-none ${dark ? 'text-white' : 'text-gray-900'}`}>Nestor</p>
          <p className="text-xs text-gray-400 mt-0.5">Vocal</p>
        </div>
      </div>

      {/* Retour app */}
      <button onClick={() => { navigate('/'); onNav?.(); }}
        className="flex items-center gap-2 px-3 py-1.5 mb-5 text-xs text-gray-400 hover:text-orange-500 transition-colors rounded-xl hover:bg-orange-50 w-full">
        <ArrowLeft size={13} />
        Retour à l'application
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                isActive ? 'bg-orange-50 text-orange-600 font-medium'
                : dark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-orange-500' : ''} />
                {label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
              </>
            )}
          </NavLink>
        ))}

        {/* Outils */}
        <div className={`mt-4 pt-4 border-t ${dark ? 'border-gray-800' : 'border-gray-100'} flex flex-col gap-0.5`}>

          {/* Langue */}
          <div ref={langRef} className="relative">
            <button onClick={() => setShowLang(!showLang)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all ${
                dark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              <Languages size={17} />
              <span>Langue</span>
              <span className="ml-auto text-base">{currentLang.flag}</span>
            </button>
            {showLang && (
              <div className={`absolute left-0 bottom-full mb-1 w-44 rounded-2xl shadow-xl border overflow-hidden z-50 ${
                dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
              }`}>
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => handleLang(l.code)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      lang === l.code ? 'bg-orange-50 text-orange-600 font-medium'
                      : dark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    <span className="text-base">{l.flag}</span>
                    {l.label}
                    {lang === l.code && <Check size={13} className="ml-auto text-orange-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thème */}
          <button onClick={() => setDark(!dark)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              dark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}>
            {dark ? <Sun size={17} className="text-yellow-400" /> : <Moon size={17} />}
            <span>{dark ? 'Mode clair' : 'Mode sombre'}</span>
            <div className={`ml-auto w-8 h-4 rounded-full transition-colors relative ${dark ? 'bg-orange-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${dark ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) refresh(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all ${
                dark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              {notifEnabled ? <Bell size={17} /> : <BellOff size={17} />}
              <span>Notifications</span>
              {unread > 0 && notifEnabled && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <div className={`absolute left-0 bottom-full mb-1 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl border overflow-hidden z-50 ${
                dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
              }`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-gray-800' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${dark ? 'text-gray-200' : 'text-gray-800'}`}>Notifications</span>
                    {unread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">{unread}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && <button onClick={markAllRead} className="text-xs text-orange-500 hover:underline">Tout lire</button>}
                    <button onClick={toggleNotif}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        notifEnabled ? 'text-green-600 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200'
                      }`}>
                      {notifEnabled ? 'Actif' : 'Désactivé'}
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">Aucune notification</p>
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                        !n.read ? dark ? 'bg-orange-500/5' : 'bg-orange-50/60' : ''
                      } ${dark ? 'border-gray-800' : 'border-gray-50'}`}>
                      <div className={`mt-0.5 ${typeColor(n.type)}`}>{categoryIcon(n.category)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!n.read ? dark ? 'text-gray-200 font-medium' : 'text-gray-800 font-medium' : 'text-gray-500'}`}>{n.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor(n.type)}`} />}
                      <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} className="text-gray-300 hover:text-red-400 flex-shrink-0 ml-1"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className={`px-4 py-2 border-t text-xs text-gray-400 ${dark ? 'border-gray-800' : 'border-gray-50'}`}>
                  Actualisé auto · <button onClick={refresh} className="text-orange-400 hover:underline">Actualiser</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Profil + déconnexion */}
      <div className={`border-t pt-4 mt-2 ${dark ? 'border-gray-800' : 'border-orange-50'}`}>
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <span className="text-orange-600 text-xs font-semibold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{adminUser?.username}</p>
            <p className="text-xs text-gray-400 truncate">{adminUser?.email}</p>
          </div>
        </div>
        <button onClick={() => { logoutAdmin(); navigate('/admin/login'); }}
          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-red-500 w-full rounded-xl hover:bg-red-50 transition-all">
          <LogOut size={15} />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className={`flex h-screen overflow-hidden min-w-0 ${dark ? 'bg-gray-950' : 'bg-white'}`}>

      {/* ── SIDEBAR DESKTOP ──────────────────────────── */}
      <aside className={`hidden md:flex w-64 border-r flex-col py-6 px-3 flex-shrink-0 transition-colors ${
        dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
      }`}>
        <SidebarContent />
      </aside>

      {/* ── DRAWER MOBILE ────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className={`relative z-50 w-72 flex flex-col py-6 px-3 h-full shadow-2xl transition-colors ${
            dark ? 'bg-gray-900' : 'bg-white'
          }`}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
              <X size={18} />
            </button>
            <SidebarContent onNav={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── CONTENU ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Top bar mobile */}
        <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${
          dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
              <Mic size={15} className="text-white" />
            </div>
            <div>
              <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>Nestor Vocal</span>
              <span className="ml-2 text-xs text-orange-500 font-medium">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && notifEnabled && (
              <div className="relative">
                <button onClick={() => { setShowNotif(!showNotif); refresh(); }}
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-50">
                  <Bell size={18} />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                    {unread}
                  </span>
                </button>
              </div>
            )}
            <button onClick={() => setSidebarOpen(true)}
              className={`p-2 rounded-xl transition-all ${dark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden min-w-0 transition-colors ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
          <Outlet />
        </main>

        {/* ── BOTTOM NAV MOBILE ─────────────────────── */}
        <nav className={`md:hidden flex items-center justify-around px-2 py-2 border-t flex-shrink-0 ${
          dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
        }`}>
          {navItems.map(({ to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-orange-500' : dark ? 'text-gray-500' : 'text-gray-400'
                }`}>
              {({ isActive }) => (
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
              )}
            </NavLink>
          ))}
        </nav>

      </div>
    </div>
  );
}