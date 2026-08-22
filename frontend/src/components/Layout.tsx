import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { Bot, Calendar, FileText, Ticket, User, LogOut, Mic,
         Languages, Moon, Sun, Bell, BellOff, Check, X, Menu,
         CalendarClock, FileWarning, Plane, Info, Home } from 'lucide-react';

// On étend le type Window pour typer proprement la propriété globale utilisée
// plus bas, au lieu de passer par un cast "as any" qui désactive toute vérification.
declare global {
  interface Window {
    __nestorLang?: string;
  }
}

// Langues proposées dans le sélecteur, avec leur drapeau affiché à côté du libellé
const LANGUAGES = [
  { code: 'fr',  label: 'Français',  flag: '🇫🇷' },
  { code: 'en',  label: 'English',   flag: '🇬🇧' },
  { code: 'ar',  label: 'العربية',   flag: '🇲🇦' },
  { code: 'es',  label: 'Español',   flag: '🇪🇸' },
  { code: 'pt',  label: 'Português', flag: '🇧🇷' },
  { code: 'dyu', label: 'Dioula',    flag: '🇨🇮' },
  { code: 'bm',  label: 'Bambara',   flag: '🇲🇱' },
  { code: 'wo',  label: 'Wolof',     flag: '🇸🇳' },
];

// Layout englobe toutes les pages de l'application : sidebar de navigation,
// barre du haut sur mobile, gestion du thème, de la langue et des notifications.
export default function Layout() {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // Liste des liens de navigation, générée une fois par render à partir des traductions courantes
  const navItems = [
    { to: '/',            icon: Home,     label: t('nav_home'),         end: true },
    { to: '/assistant',   icon: Bot,      label: t('nav_ia')                      },
    { to: '/rendez-vous', icon: Calendar, label: t('nav_appointments') },
    { to: '/documents',   icon: FileText, label: t('nav_documents')    },
    { to: '/billets',     icon: Ticket,   label: t('nav_tickets')      },
    { to: '/profil',      icon: User,     label: t('nav_profile')      },
  ];

  //  SIDEBAR MOBILE 
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer ouvert ou fermé sur mobile

  // THÈME
  // isDarkMode suit la même convention que les autres booléens du projet (isRecording, isLoading...).
  // Sa valeur initiale est lue directement dans le localStorage pour éviter un flash de thème clair
  // au premier rendu si l'utilisateur avait choisi le mode sombre.
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // LANGUE
  const [showLang, setShowLang] = useState(false); // menu déroulant des langues ouvert ou fermé
  const langRef = useRef<HTMLDivElement>(null);    // référence utilisée pour détecter les clics en dehors du menu
  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  // Change la langue de l'application, la persiste, et adapte le sens de lecture (RTL pour l'arabe)
  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
    window.__nestorLang = code; 
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    setShowLang(false);
  };

  //  NOTIFICATIONS
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('notif') !== 'false');
  const [showNotif, setShowNotif] = useState(false); // panneau de notifications ouvert ou fermé
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unread, markRead, markAllRead, dismiss, refresh } = useNotifications(notifEnabled);
  const toggleNotif = () => { setNotifEnabled(p => { localStorage.setItem('notif', String(!p)); return !p; }); };

  // Ouvre le panneau ET marque tout comme lu : le badge repasse à 0
  // jusqu'à la prochaine vraie notification reçue.
  const openNotifPanel = () => {
    setShowNotif(prev => {
      const next = !prev;
      if (next) { refresh(); markAllRead(); }
      return next;
    });
  };

  // Choisit l'icône affichée selon la catégorie métier de la notification
  const categoryIcon = (cat: string) => {
    if (cat === 'appointment') return <CalendarClock size={13} className="flex-shrink-0" />;
    if (cat === 'document')    return <FileWarning size={13} className="flex-shrink-0" />;
    if (cat === 'ticket')      return <Plane size={13} className="flex-shrink-0" />;
    return <Info size={13} className="flex-shrink-0" />;
  };

  // Ces deux fonctions utilisaient auparavant "t" comme nom de paramètre, ce qui masquait
  // la fonction de traduction "t" venant de useTranslation() plus haut dans le composant.
  // On utilise "type" à la place pour éviter toute confusion, même si ça ne causait pas
  // de bug ici puisque "t" (traduction) n'était pas utilisé à l'intérieur de ces fonctions.
  const typeColor = (type: string) => ({ warning: 'text-orange-500', error: 'text-red-500', success: 'text-green-500' }[type] || 'text-blue-500');
  const dotColor  = (type: string) => ({ warning: 'bg-orange-400',   error: 'bg-red-500',   success: 'bg-green-500'   }[type] || 'bg-blue-400');

  // Ferme les menus (langue, notifications) si l'utilisateur clique en dehors d'eux
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current  && !langRef.current.contains(e.target  as Node)) setShowLang(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Initiales affichées dans l'avatar par défaut si l'utilisateur n'a pas de photo de profil
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'NV';

  // ─── CONTENU DE LA SIDEBAR (partagé entre la version desktop et le drawer mobile) ───
  // onNav est appelé après un clic sur un lien, uniquement utile sur mobile pour refermer le drawer
  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-9 h-9 rounded-2xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30">
          <Mic size={16} className="text-white" />
        </div>
        <div>
          <p className={`font-semibold text-sm leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Nestor</p>
          <p className="text-xs text-gray-400 mt-0.5">Vocal</p>
        </div>
      </div>

      {/* Liens de navigation principaux */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                isActive ? 'bg-orange-50 text-orange-600 font-medium'
                : isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-orange-500' : ''} />
                {label}
                {/* Petit point orange à droite du lien actif */}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
              </>
            )}
          </NavLink>
        ))}

        {/* Outils : langue, thème, notifications */}
        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-100'} flex flex-col gap-0.5`}>

          {/* Sélecteur de langue */}
          <div ref={langRef} className="relative">
            <button onClick={() => setShowLang(!showLang)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all ${
                isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              <Languages size={17} />
              <span>{t('nav_lang')}</span>
              <span className="ml-auto text-base">{currentLang.flag}</span>
            </button>
            {showLang && (
              <div className={`absolute left-0 bottom-full mb-1 w-44 rounded-2xl shadow-xl border overflow-hidden z-50 ${
                isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
              }`}>
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => handleLang(l.code)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                      i18n.language === l.code
                        ? 'bg-orange-50 text-orange-600 font-medium'
                        : isDarkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    <span className="text-base">{l.flag}</span>
                    {l.label}
                    {/* Coche affichée uniquement à côté de la langue actuellement active */}
                    {i18n.language === l.code && <Check size={13} className="ml-auto text-orange-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bascule clair / sombre, présentée comme un interrupteur */}
          <button onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
              isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}>
            {isDarkMode ? <Sun size={17} className="text-yellow-400" /> : <Moon size={17} />}
            <span>{isDarkMode ? t('nav_light') : t('nav_dark')}</span>
            {/* Interrupteur dessiné à la main : un rond qui se déplace à gauche ou à droite selon l'état */}
            <div className={`ml-auto w-8 h-4 rounded-full transition-colors relative ${isDarkMode ? 'bg-orange-500' : 'bg-gray-200'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isDarkMode ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button onClick={openNotifPanel}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all ${
                isDarkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              {notifEnabled ? <Bell size={17} /> : <BellOff size={17} />}
              <span>{t('nav_notif')}</span>
              {/* Badge du nombre de notifications non lues, uniquement si notifications activées */}
              {unread > 0 && notifEnabled && (
                <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                  {unread}
                </span>
              )}
            </button>

            {showNotif && (
              <div className={`absolute left-0 bottom-full mb-1 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl border overflow-hidden z-50 ${
                isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'
              }`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{t('notif_title')}</span>
                    {unread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">{unread}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {unread > 0 && <button onClick={markAllRead} className="text-xs text-orange-500 hover:underline">{t('notif_read_all')}</button>}
                    <button onClick={toggleNotif}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        notifEnabled ? 'text-green-600 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200'
                      }`}>
                      {notifEnabled ? t('notif_active') : t('notif_off')}
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400">{t('notif_empty')}</p>
                    </div>
                  ) : notifications.map(n => (
                    // Cliquer sur une notification la marque comme lue ; la croix la supprime sans propager le clic au parent
                    <div key={n.id} onClick={() => markRead(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                        !n.read ? isDarkMode ? 'bg-orange-500/5' : 'bg-orange-50/60' : ''
                      } ${isDarkMode ? 'border-gray-800' : 'border-gray-50'}`}>
                      <div className={`mt-0.5 ${typeColor(n.type)}`}>{categoryIcon(n.category)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${!n.read ? isDarkMode ? 'text-gray-200 font-medium' : 'text-gray-800 font-medium' : 'text-gray-500'}`}>{n.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                      </div>
                      {!n.read && <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor(n.type)}`} />}
                      {/* stopPropagation empêche le clic sur la croix de déclencher aussi le onClick du parent (markRead) */}
                      <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} className="text-gray-300 hover:text-red-400 flex-shrink-0 ml-1"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <div className={`px-4 py-2 border-t text-xs text-gray-400 ${isDarkMode ? 'border-gray-800' : 'border-gray-50'}`}>
                  Actualisé auto · <button onClick={refresh} className="text-orange-400 hover:underline">Actualiser</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Profil utilisateur + bouton de déconnexion, toujours en bas de la sidebar */}
      <div className={`border-t pt-4 mt-2 ${isDarkMode ? 'border-gray-800' : 'border-gray-50'}`}>
        {user && (
          <div className="flex items-center gap-3 px-3 mb-3">
            {/* Avatar dynamique : photo réelle si disponible, sinon initiales sur fond orange */}
            {user.avatar ? (
              <img
                src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'}/uploads/avatars/${user.avatar}`}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 text-xs font-semibold">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-red-500 w-full rounded-xl hover:bg-red-50 transition-all">
          <LogOut size={15} />
          {t('nav_logout')}
        </button>
      </div>
    </>
  );

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-gray-950' : 'bg-white'}`}>

      {/* ── SIDEBAR DESKTOP (masquée sur mobile, remplacée par le drawer et la bottom nav) ───────── */}
      <aside className={`hidden md:flex w-64 border-r flex-col py-6 px-3 flex-shrink-0 transition-colors ${
        isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
      }`}>
        <SidebarContent />
      </aside>

      {/* ── DRAWER MOBILE (sidebar en superposition, ouverte via le bouton burger) ────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Overlay semi-transparent : cliquer dessus referme le drawer */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          {/* Panneau du drawer, glissé par-dessus l'overlay */}
          <aside className={`relative z-50 w-72 flex flex-col py-6 px-3 h-full shadow-2xl transition-colors ${
            isDarkMode ? 'bg-gray-900' : 'bg-white'
          }`}>
            <button onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
              <X size={18} />
            </button>
            {/* onNav referme le drawer automatiquement dès qu'on clique sur un lien de navigation */}
            <SidebarContent onNav={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── CONTENU PRINCIPAL ─────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Barre du haut, visible uniquement sur mobile (la sidebar desktop remplit ce rôle sur grand écran) */}
        <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${
          isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
              <Mic size={15} className="text-white" />
            </div>
            <span className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Nestor Vocal</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge notifications mobile, affiché uniquement s'il y a des notifications non lues */}
            {unread > 0 && notifEnabled && (
              <div className="relative">
                <button onClick={openNotifPanel}
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-50">
                  <Bell size={18} />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                    {unread}
                  </span>
                </button>
              </div>
            )}
            {/* Bouton burger qui ouvre le drawer mobile */}
            <button onClick={() => setSidebarOpen(true)}
              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Zone où s'affiche la page active, injectée par React Router */}
        <main className={`flex-1 overflow-hidden flex flex-col transition-colors ${isDarkMode ? 'bg-gray-950' : 'bg-white'}`}>
          <Outlet />
        </main>

        {/* ── BARRE DE NAVIGATION DU BAS, visible uniquement sur mobile ─────────────────────── */}
        <nav className={`md:hidden flex items-center justify-around px-2 py-2 border-t flex-shrink-0 ${
          isDarkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-orange-50'
        }`}>
          {navItems.map(({ to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-orange-500' : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`}>
              {({ isActive }) => (
                <>
                  {/* Icône seule, sans libellé, pour économiser l'espace en bas d'écran mobile */}
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-orange-50' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

    </div>
  );
}