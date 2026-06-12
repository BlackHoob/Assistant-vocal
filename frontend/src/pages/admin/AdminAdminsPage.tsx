import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Plus, Trash2, X, Eye, EyeOff, Lock } from 'lucide-react';

export default function AdminAdminsPage() {
  const api = useAdminApi();
  const { adminUser } = useAuth();
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'admin' });
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try { setAdmins(await api.get('/admin/admins')); } catch { setAdmins([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await api.post('/admin/admins', form);
      setForm({ username: '', email: '', password: '', role: 'admin' });
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet administrateur ?')) return;
    await api.del(`/admin/admins/${id}`);
    load();
  };

  if (adminUser?.role !== 'superadmin') {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <Lock size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Réservé aux superadmins</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-orange-400" /> Administrateurs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{admins.length} admin(s)</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-orange-500 text-gray-900 text-sm font-medium px-4 py-2 rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Annuler' : 'Nouvel admin'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-orange-500/20 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Créer un administrateur</h3>
          {error && <div className="mb-3 px-3 py-2 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20">{error}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            {[
              { label: "Nom d'utilisateur", key: 'username', type: 'text', placeholder: 'johndoe' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'john@nestor.local' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <input type={type} required value={(form as any)[key]}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-700 rounded-xl text-sm text-gray-800 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors"
                  placeholder={placeholder} />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} required value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-700 rounded-xl text-sm text-gray-800 placeholder-gray-600 outline-none focus:border-orange-500 transition-colors pr-9"
                  placeholder="Min. 8 caractères" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rôle</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-700 rounded-xl text-sm text-gray-800 outline-none focus:border-orange-500">
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={submitting}
                className="bg-orange-500 text-gray-900 text-sm px-4 py-2 rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2">
                {submitting ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Plus size={13} />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Utilisateur', 'Email', 'Rôle', 'Créé le', ''].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-600">Chargement...</td></tr>
            ) : admins.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-xs text-orange-400 font-bold">
                      {a.username[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-800 font-medium">{a.username}</span>
                    {a.id === adminUser?.id && <span className="text-xs text-gray-600">(vous)</span>}
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{a.email}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                    a.role === 'superadmin' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-gray-100 text-gray-500 border-gray-600'
                  }`}>{a.role}</span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-5 py-3">
                  {a.id !== adminUser?.id && (
                    <button onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}