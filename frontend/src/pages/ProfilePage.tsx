import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { User, Camera, Save, Mail, Phone, Eye, EyeOff } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function ProfilePage() {
  const { user, token, setAuth } = useAuth();
  const api = useApi();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSaved, setPwdSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '' });
      setAvatar(user.avatar ? `/uploads/avatars/${user.avatar}` : null);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/profile', form);
      setAuth(token!, { ...user!, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      if (data.url) setAvatar(data.url);
    } finally { setUploadingAvatar(false); }
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
      setShowPwdForm(false);
      setTimeout(() => setPwdSaved(false), 2000);
    } catch (err: any) { setPwdError(err.message); }
  };

  const initials = (user?.name || 'NV').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-3 px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
          <User size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Profil</h1>
          <p className="text-xs text-gray-400">Gérez vos informations</p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-lg space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-20 h-20 rounded-3xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-orange-100 flex items-center justify-center">
                <span className="text-orange-600 text-xl font-bold">{initials}</span>
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-md hover:bg-orange-600 transition-colors">
              {uploadingAvatar
                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Camera size={14} className="text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-500 border border-orange-100">
              JWT + bcrypt
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1.5">
              <User size={12} /> Nom complet
            </label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1.5">
              <Mail size={12} /> Email
            </label>
            <input type="email" value={user?.email || ''} disabled
              className="input-field bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5 flex items-center gap-1.5">
              <Phone size={12} /> Téléphone
            </label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
              className="input-field" placeholder="+33 6 00 00 00 00" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
            {saved ? 'Enregistré ✓' : 'Enregistrer'}
          </button>
        </form>

        <div className="card bg-gray-50 border-gray-100">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sécurité</h3>
          {pwdSaved && <p className="text-green-500 text-sm mb-2">Mot de passe mis à jour ✓</p>}
          {!showPwdForm ? (
            <button onClick={() => setShowPwdForm(true)}
              className="text-sm text-orange-500 hover:text-orange-600 font-medium">
              Changer le mot de passe →
            </button>
          ) : (
            <form onSubmit={handleChangePwd} className="space-y-3">
              {pwdError && <p className="text-red-500 text-xs">{pwdError}</p>}
              {[
                { label: 'Mot de passe actuel', key: 'current' },
                { label: 'Nouveau mot de passe', key: 'newPwd' },
                { label: 'Confirmer', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={(pwdForm as any)[key]}
                      onChange={e => setPwdForm({ ...pwdForm, [key]: e.target.value })}
                      className="input-field pr-9" required />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm px-4 py-2">Enregistrer</button>
                <button type="button" onClick={() => setShowPwdForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3">Annuler</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}