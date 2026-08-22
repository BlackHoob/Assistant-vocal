import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import {
  User, Camera, Save, Mail, Phone, Eye, EyeOff,
  ChevronRight, LogOut, Trash2, Globe,
  Lock, FileText, Bell, Check, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const LANGUAGES = [
  { code: 'fr',  label: 'Français',  flag: '🇫🇷' },
  { code: 'en',  label: 'English',   flag: '🇬🇧' },
  { code: 'ar',  label: 'العربية',    flag: '🇲🇦' },
  { code: 'es',  label: 'Español',   flag: '🇪🇸' },
  { code: 'pt',  label: 'Português', flag: '🇵🇹' },
  { code: 'dyu', label: 'Dioula',    flag: '🌍' },
  { code: 'bm',  label: 'Bambara',   flag: '🌍' },
  { code: 'wo',  label: 'Wolof',     flag: '🌍' },
];

type Section = 'main' | 'identity' | 'phone' | 'email' | 'password' | 'notifications' | 'language' | 'legal' | 'delete';

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, token, setAuth, logout } = useAuth();
  const api = useApi();
  const navigate = useNavigate();

  const [section, setSection] = useState<Section>('main');
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSaved, setPwdSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Préférences de notifications
  const [notifPrefs, setNotifPrefs] = useState({ email: true, push: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Suppression de compte
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '' });
      setAvatar(user.avatar ? `${API.replace('/api', '')}/uploads/avatars/${user.avatar}` : null);
      setNotifPrefs({
        email: (user as any).notifyEmail !== false,
        push: (user as any).notifyPush !== false,
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/profile', form);
      setAuth(token!, { ...user!, ...updated });
      setSaved(true);
      setTimeout(() => { setSaved(false); setSection('main'); }, 1200);
    } finally { setSaving(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch(`${API}/profile/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      const newUrl = data.url || (data.avatar ? `${API.replace('/api', '')}/uploads/avatars/${data.avatar}` : null);
      if (newUrl) {
        setAvatar(newUrl);
        setAuth(token!, { ...user!, avatar: data.avatar || data.url });
      }
    } finally { setUploadingAvatar(false); }
  };

  // Ne supprime l'avatar côté front QUE si le backend confirme le succès —
  // sinon on affiche l'erreur au lieu de faire croire que c'est fait.
  const handleDeleteAvatar = async () => {
    if (!confirm('Supprimer la photo de profil ?')) return;
    setDeletingAvatar(true);
    setAvatarError('');
    try {
      const res = await fetch(`${API}/profile/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Échec de la suppression (${res.status})`);
      }
      setAvatar(null);
      setAuth(token!, { ...user!, avatar: null });
    } catch (err: any) {
      setAvatarError(err.message || 'Erreur lors de la suppression de la photo');
    } finally { setDeletingAvatar(false); }
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (pwdForm.newPwd !== pwdForm.confirm) return setPwdError('Les mots de passe ne correspondent pas');
    if (pwdForm.newPwd.length < 8) return setPwdError('Minimum 8 caractères');
    try {
      await api.put('/auth/change-password', { currentPassword: pwdForm.current, newPassword: pwdForm.newPwd });
      setPwdSaved(true);
      setPwdForm({ current: '', newPwd: '', confirm: '' });
      setTimeout(() => { setPwdSaved(false); setSection('main'); }, 1200);
    } catch (err: any) { setPwdError(err.message); }
  };

  const handleSaveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      const updated = await api.put('/profile', { notifyEmail: notifPrefs.email, notifyPush: notifPrefs.push });
      setAuth(token!, { ...user!, ...updated });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 1500);
    } finally { setNotifSaving(false); }
  };

  const handleChangeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('lang', code);
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    const confirmed = window.confirm(
      'Cette action est définitive et supprimera toutes vos données (rendez-vous, billets, documents). Continuer ?'
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.del('/profile');
      logout();
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err.message || 'Erreur lors de la suppression du compte');
    } finally { setDeleting(false); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (user?.name || 'NV').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const currentLangLabel = LANGUAGES.find(l => l.code === i18n.language);

  // ── Composant ligne de section ────────────────────────────
  const Row = ({ icon: Icon, label, sub, right, onClick, red = false }: {
    icon: any; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; red?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 w-full px-0 py-3.5 border-b border-gray-100 last:border-0 text-left transition-colors hover:bg-gray-50 -mx-0 group ${red ? 'text-red-500' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${red ? 'bg-red-50' : 'bg-blue-50'}`}>
        <Icon size={16} className={red ? 'text-red-500' : 'text-blue-500'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${red ? 'text-red-500' : 'text-gray-800'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {right}
        <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
      </div>
    </button>
  );

  const SectionHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <div className="flex items-center gap-3 px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
      <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-all">
        <ChevronRight size={18} className="rotate-180" />
      </button>
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
    </div>
  );

  // ── VUE PRINCIPALE ────────────────────────────────────────
  if (section === 'main') return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Avatar header */}
      <div className="flex flex-col items-center pt-10 pb-8 px-8 border-b border-gray-50">
        <div className="relative mb-4">
          {avatar ? (
            <img src={avatar} alt="avatar" className="w-24 h-24 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-100">
              <span className="text-blue-600 text-2xl font-bold">{initials}</span>
            </div>
          )}
          {/* Bouton photo */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 transition-all"
          >
            {uploadingAvatar
              ? <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              : <Camera size={14} className="text-gray-500" />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
        <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>

        {/* Erreur suppression photo */}
        {avatarError && (
          <p className="mt-2 text-xs text-red-500 max-w-xs text-center">{avatarError}</p>
        )}

        {/* Supprimer la photo */}
        {avatar && (
          <button
            onClick={handleDeleteAvatar}
            disabled={deletingAvatar}
            className="mt-3 flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            {deletingAvatar
              ? <div className="w-3 h-3 border border-red-300 border-t-red-500 rounded-full animate-spin" />
              : <Trash2 size={12} />
            }
            Supprimer la photo
          </button>
        )}
      </div>

      <div className="px-8 py-2">

        {/* ── Identité ── */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider pt-6 pb-2">Identité</p>
          <Row
            icon={User}
            label="Mon profil"
            sub={user?.name}
            onClick={() => setSection('identity')}
          />
        </div>

        {/* ── Connexion ── */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider pt-6 pb-2">Connexion</p>
          <Row
            icon={Phone}
            label="Téléphone"
            sub={user?.phone || 'Non renseigné'}
            right={<span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Vérifié</span>}
            onClick={() => setSection('phone')}
          />
          <Row
            icon={Mail}
            label="E-mail"
            sub={user?.email}
            right={<span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Vérifié</span>}
            onClick={() => setSection('email')}
          />
          <Row
            icon={Lock}
            label="Mot de passe"
            sub="••••••••••••"
            onClick={() => setSection('password')}
          />
        </div>

        {/* ── Paramètres ── */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider pt-6 pb-2">Paramètres</p>
          <Row
            icon={Globe}
            label="Langue"
            sub="Langue du compte"
            right={<span className="text-xs text-gray-500">{currentLangLabel ? `${currentLangLabel.flag} ${currentLangLabel.label}` : i18n.language}</span>}
            onClick={() => setSection('language')}
          />
          <Row
            icon={Bell}
            label="Notifications"
            sub="Gérez vos préférences de notifications"
            onClick={() => setSection('notifications')}
          />
        </div>

        {/* ── Confidentialité ── */}
        <div className="mb-1">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider pt-6 pb-2">Confidentialité</p>
          <Row icon={FileText} label="Informations légales" onClick={() => setSection('legal')} />
          <Row icon={Trash2} label="Supprimer mon compte" onClick={() => setSection('delete')} red />
        </div>

        {/* ── Déconnexion ── */}
        <div className="pt-4 pb-8">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 w-full py-3.5 border-t border-b border-gray-100 text-left hover:bg-red-50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <LogOut size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-medium text-red-500 flex-1">Déconnexion</span>
            <ChevronRight size={15} className="text-red-300 group-hover:text-red-400 transition-colors" />
          </button>
        </div>

      </div>
    </div>
  );

  // ── IDENTITÉ / MON PROFIL ─────────────────────────────────
  if (section === 'identity') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Mon profil" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Nom complet</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field" placeholder="Votre nom" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
            <input type="email" value={user?.email || ''} disabled
              className="input-field bg-gray-50 text-gray-400 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">L'email ne peut pas être modifié ici</p>
          </div>
          <button type="submit" disabled={saving}
            className="btn-primary flex items-center gap-2">
            {saving
              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : saved ? <Check size={14} /> : <Save size={14} />
            }
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── TÉLÉPHONE ─────────────────────────────────────────────
  if (section === 'phone') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Téléphone" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Numéro de téléphone</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="input-field" placeholder="+33 6 00 00 00 00" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── EMAIL ─────────────────────────────────────────────────
  if (section === 'email') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="E-mail" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100 mb-6">
          <Check size={16} className="text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-700">Adresse vérifiée</p>
            <p className="text-xs text-green-600 mt-0.5">{user?.email}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">La modification de l'adresse e-mail nécessite une vérification. Contactez le support pour toute modification.</p>
      </div>
    </div>
  );

  // ── MOT DE PASSE ──────────────────────────────────────────
  if (section === 'password') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Mot de passe" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        {pwdSaved && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100">
            <Check size={15} /> Mot de passe mis à jour avec succès
          </div>
        )}
        <form onSubmit={handleChangePwd} className="space-y-4">
          {pwdError && <p className="text-red-500 text-sm">{pwdError}</p>}
          {[
            { label: 'Mot de passe actuel', key: 'current' },
            { label: 'Nouveau mot de passe', key: 'newPwd' },
            { label: 'Confirmer le nouveau mot de passe', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={(pwdForm as any)[key]}
                  onChange={e => setPwdForm({ ...pwdForm, [key]: e.target.value })}
                  className="input-field pr-10" required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" className="btn-primary flex items-center gap-2 mt-2">
            <Save size={14} /> Mettre à jour
          </button>
        </form>
      </div>
    </div>
  );

  // ── NOTIFICATIONS ──────────────────────────────────────────
  if (section === 'notifications') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Notifications" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg space-y-4">
        {notifSaved && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100">
            <Check size={15} /> Préférences enregistrées
          </div>
        )}

        <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl">
          <div>
            <p className="text-sm font-medium text-gray-800">Notifications dans l'application</p>
            <p className="text-xs text-gray-400 mt-0.5">Rendez-vous, billets, documents envoyés par l'agence</p>
          </div>
          <button
            onClick={() => setNotifPrefs(p => ({ ...p, push: !p.push }))}
            className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${notifPrefs.push ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${notifPrefs.push ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl">
          <div>
            <p className="text-sm font-medium text-gray-800">Notifications par e-mail</p>
            <p className="text-xs text-gray-400 mt-0.5">Rappels et confirmations envoyés à {user?.email}</p>
          </div>
          <button
            onClick={() => setNotifPrefs(p => ({ ...p, email: !p.email }))}
            className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${notifPrefs.email ? 'bg-orange-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${notifPrefs.email ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>

        <button onClick={handleSaveNotifPrefs} disabled={notifSaving}
          className="btn-primary flex items-center gap-2">
          {notifSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>
    </div>
  );

  // ── LANGUE ──────────────────────────────────────────────────
  if (section === 'language') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Langue" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        <div className="space-y-2">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => handleChangeLanguage(l.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                i18n.language === l.code
                  ? 'border-orange-300 bg-orange-50 text-orange-600'
                  : 'border-gray-100 hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="text-lg">{l.flag}</span>
              <span className="text-sm font-medium flex-1">{l.label}</span>
              {i18n.language === l.code && <Check size={15} className="text-orange-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── INFORMATIONS LÉGALES ─────────────────────────────────────
  if (section === 'legal') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Informations légales" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg space-y-6 text-sm text-gray-600 leading-relaxed">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Éditeur</h2>
          <p>Nestor Vocal est un service édité par Selectour Alltour, agence de voyage membre du réseau Selectour.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Données personnelles</h2>
          <p>Les informations recueillies (identité, coordonnées, historique de réservations) sont utilisées exclusivement pour la gestion de votre compte et de vos demandes de voyage. Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données, exerçable depuis la rubrique "Supprimer mon compte" ou en contactant l'agence.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Conditions d'utilisation</h2>
          <p>L'utilisation de l'assistant vocal Nestor et des services de réservation associés implique l'acceptation des conditions générales de vente de Selectour Alltour, disponibles en agence.</p>
        </div>
      </div>
    </div>
  );

  // ── SUPPRIMER MON COMPTE ─────────────────────────────────────
  if (section === 'delete') return (
    <div className="flex flex-col h-full overflow-y-auto">
      <SectionHeader title="Supprimer mon compte" onBack={() => setSection('main')} />
      <div className="px-8 py-6 max-w-lg">
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl mb-6">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Action définitive</p>
            <p className="text-xs text-red-600 mt-1">
              Votre compte, vos rendez-vous, billets et documents seront supprimés sans possibilité de récupération.
            </p>
          </div>
        </div>

        {deleteError && <p className="text-red-500 text-sm mb-4">{deleteError}</p>}

        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="flex items-center gap-2 bg-red-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
        >
          {deleting
            ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Trash2 size={14} />}
          Supprimer définitivement mon compte
        </button>
      </div>
    </div>
  );

  return null;
}