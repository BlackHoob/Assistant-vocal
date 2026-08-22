import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useAuth } from '../../hooks/useAuth';
import { useModalA11y } from '../../hooks/useModalA11y';
import AccessibleIconButton from '../../components/common/AccessibleIconButton';
import { FileText, Upload, Search, User, CheckCircle, Trash2, Paperclip, Inbox, Send, X, Download } from 'lucide-react';
import { API_URL, assetUrl } from '../../lib/api';
import { formatFileSize, formatDate } from '../../utils/format';

const DOC_TYPES = [
  { value: 'passport',    label: 'Passeport' },
  { value: 'visa',        label: 'Visa' },
  { value: 'id_card',     label: "Carte d'identité" },
  { value: 'insurance',   label: 'Assurance voyage' },
  { value: 'vaccination', label: 'Carnet vaccinal' },
  { value: 'other',       label: 'Autre document' },
];

// Les documents envoyés par l'admin stockent juste le type dans `name` (ex: "passport").
// Les documents envoyés par le client stockent "[type] nomdufichier.ext".
function parseDocName(name: string) {
  const match = name?.match(/^\[(\w+)\]\s*(.*)$/);
  if (match) return { typeKey: match[1], fileName: match[2] };
  return { typeKey: name, fileName: '' };
}

export default function AdminDocumentsPage() {
  const api = useAdminApi();
  const { adminToken } = useAuth() as any;

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const modalRef = useModalA11y(!!previewDoc, () => setPreviewDoc(null));

  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [type, setType] = useState('other');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoadingHistory(true);
    try { setHistory(await api.get('/admin/documents?limit=100')); }
    catch { setHistory([]); }
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, []);

  const receivedDocs = history.filter((d: any) => !d.sent_by_admin);
  const sentDocs = history.filter((d: any) => d.sent_by_admin);

  const searchUsers = async () => {
    if (!userSearch.trim()) return setUserResults([]);
    const res = await api.get(`/admin/users?search=${encodeURIComponent(userSearch)}&limit=8`);
    setUserResults(res.users || []);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSent('');
    if (!selectedUser) return setError('Sélectionnez un utilisateur');
    if (!file) return setError('Sélectionnez un fichier');
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('userId', selectedUser.id);
      fd.append('type', type);
      if (expiresAt) fd.append('expiresAt', expiresAt);
      const res = await fetch(`${API_URL}/admin/documents/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Échec de l'envoi");
      setSent('Document envoyé');
      setFile(null);
      setExpiresAt('');
      setSelectedUser(null);
      setUserSearch('');
      setUserResults([]);
      loadHistory();
      setTimeout(() => setSent(''), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi");
    } finally { setSending(false); }
  };

  const handleDeleteDoc = async (id: number) => {
    if (!confirm('Supprimer ce document ?')) return;
    await api.del(`/admin/documents/${id}`);
    setPreviewDoc(null);
    loadHistory();
  };

  const typeLabel = (t: string) => DOC_TYPES.find(d => d.value === t)?.label || t;

  const fileUrl = (doc: any) => assetUrl(doc.file_path || '');

  const renderDocRow = (d: any) => {
    const { typeKey, fileName } = parseDocName(d.name);
    return (
      <div key={d.id} className="flex items-center justify-between px-3 py-2.5 border border-gray-100 rounded-xl hover:border-orange-200 transition-all cursor-pointer group"
        onClick={() => setPreviewDoc(d)}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Paperclip size={14} className="text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-800 truncate">
              {typeLabel(typeKey)}{fileName && <span className="text-gray-400"> · {fileName}</span>}
            </p>
            <p className="text-xs text-gray-400">
              {d.userName || `Utilisateur #${d.userId}`}
              {d.created_at && ` · ${formatDate(d.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}
              {d.file_size ? ` · ${formatFileSize(d.file_size)}` : ''}
              {d.expires_at && ` · expire le ${formatDate(d.expires_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </p>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); handleDeleteDoc(d.id); }}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  return (
    <div className="p-8 text-gray-800">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText size={20} className="text-orange-400" /> Documents
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Envoyer un document à un utilisateur, consulter les documents échangés</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Formulaire d'envoi ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-600 mb-4">Nouvel envoi</h2>

          {error && <div className="mb-3 px-3 py-2 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}
          {sent && (
            <div className="mb-3 px-3 py-2 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100 flex items-center gap-2">
              <CheckCircle size={14} /> {sent}
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            {/* Utilisateur */}
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Destinataire</label>
              {selectedUser ? (
                <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl">
                  <span className="text-sm text-gray-800 flex items-center gap-1.5"><User size={13} /> {selectedUser.name || selectedUser.email}</span>
                  <button type="button" onClick={() => setSelectedUser(null)} className="text-xs text-orange-500 hover:underline">
                    Changer
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchUsers())}
                      placeholder="Nom ou email..."
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
                    <button type="button" onClick={searchUsers}
                      className="px-3 py-2 bg-gray-100 rounded-xl text-gray-500 hover:bg-gray-200 transition-all">
                      <Search size={14} />
                    </button>
                  </div>
                  {userResults.length > 0 && (
                    <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
                      {userResults.map(u => (
                        <button type="button" key={u.id} onClick={() => { setSelectedUser(u); setUserResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 transition-colors">
                          {u.name || <span className="italic text-gray-400">Sans nom</span>} · <span className="text-gray-400">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Type de document */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type de document</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300">
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            {/* Date d'expiration (optionnelle) */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date d'expiration (optionnel)</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-300" />
            </div>

            {/* Fichier */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fichier</label>
              <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-orange-300 transition-colors">
                <Upload size={14} />
                {file ? file.name : 'Choisir un fichier (PDF, image...)'}
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <button type="submit" disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
              {sending
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Upload size={14} />}
              Envoyer le document
            </button>
          </form>
        </div>

        {/* ── Documents échangés ── */}
        <div className="space-y-6">
          {/* Reçus des clients */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
              <Inbox size={15} className="text-orange-400" /> Reçus des clients
              {receivedDocs.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-500 font-medium">{receivedDocs.length}</span>
              )}
            </h2>
            {loadingHistory ? (
              <p className="text-sm text-gray-500 text-center py-8">Chargement...</p>
            ) : receivedDocs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aucun document reçu des clients</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {receivedDocs.map(renderDocRow)}
              </div>
            )}
          </div>

          {/* Envoyés par l'agence */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
              <Send size={15} className="text-orange-400" /> Envoyés par l'agence
              {sentDocs.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{sentDocs.length}</span>
              )}
            </h2>
            {loadingHistory ? (
              <p className="text-sm text-gray-500 text-center py-8">Chargement...</p>
            ) : sentDocs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Aucun document envoyé</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {sentDocs.map(renderDocRow)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modale d'aperçu ── */}
      {previewDoc && (() => {
        const { typeKey, fileName } = parseDocName(previewDoc.name);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewDoc(null)} />
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Aperçu du document ${typeLabel(typeKey)}`}
              className="relative z-10 bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {typeLabel(typeKey)}{fileName && <span className="text-gray-400 font-normal"> · {fileName}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {previewDoc.userName || `Utilisateur #${previewDoc.userId}`}
                    {previewDoc.created_at && ` · ${formatDate(previewDoc.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    {previewDoc.file_size ? ` · ${formatFileSize(previewDoc.file_size)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={fileUrl(previewDoc)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50 transition-all">
                    <Download size={13} /> Télécharger
                  </a>
                  <button onClick={() => handleDeleteDoc(previewDoc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-400 border border-red-100 hover:bg-red-50 transition-all">
                    <Trash2 size={13} /> Supprimer
                  </button>
                  <AccessibleIconButton
                    icon={<X size={18} />}
                    label="Fermer l'aperçu"
                    onClick={() => setPreviewDoc(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                  />
                </div>
              </div>

              {/* Contenu */}
              <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4">
                {previewDoc.mime_type?.startsWith('image/') ? (
                  <img src={fileUrl(previewDoc)} alt={previewDoc.name} className="max-w-full max-h-[65vh] object-contain rounded-lg" />
                ) : previewDoc.mime_type === 'application/pdf' ? (
                  <iframe src={fileUrl(previewDoc)} title={previewDoc.name} className="w-full h-[65vh] rounded-lg border border-gray-200 bg-white" />
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <FileText size={24} className="text-orange-400" />
                    </div>
                    <p className="text-sm text-gray-500">Aperçu non disponible pour ce type de fichier.</p>
                    <a href={fileUrl(previewDoc)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 mt-1 bg-orange-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-all">
                      <Download size={14} /> Télécharger le fichier
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}