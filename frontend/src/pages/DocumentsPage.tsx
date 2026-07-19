import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  FileText, Upload, Trash2, AlertTriangle, CheckCircle,
  Clock, FileType, CreditCard, Globe, Shield, Syringe,
  X, Download, Inbox, Send
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface Document {
  id: number;
  name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  expires_at?: string;
  created_at: string;
  sent_by_admin?: boolean;
}

const colorMap: Record<string, string> = {
  blue:   'bg-blue-50 text-blue-600 border-blue-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  green:  'bg-green-50 text-green-600 border-green-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  red:    'bg-red-50 text-red-600 border-red-100',
  gray:   'bg-gray-50 text-gray-500 border-gray-100',
};

const daysUntilExpiry = (date?: string) => {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

type Tab = 'sent' | 'received';

export default function DocumentsPage() {
  const { t } = useTranslation();

  const DOC_TYPES = [
    { key: 'passport',    label: t('doc_passport'),    icon: Globe,      color: 'orange', accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'visa',        label: t('doc_visa'),         icon: FileType,   color: 'orange', accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'id_card',     label: t('doc_id_card'),      icon: CreditCard, color: 'orange', accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'insurance',   label: t('doc_insurance'),    icon: Shield,     color: 'orange', accept: '.pdf' },
    { key: 'vaccination', label: t('doc_vaccination'),  icon: Syringe,    color: 'orange', accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'other',       label: t('doc_other'),        icon: FileText,   color: 'orange', accept: '*' },
  ];

  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('sent');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [receivedDocs, setReceivedDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      // Documents envoyés par le client
      const res = await fetch(`${API}/documents`, { headers });
      const data = await res.json();
      const all = Array.isArray(data) ? data : [];
      setDocuments(all.filter((d: Document) => !d.sent_by_admin));
      setReceivedDocs(all.filter((d: Document) => d.sent_by_admin));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getDocForType = (typeKey: string) =>
    documents.find(d => d.name.startsWith(`[${typeKey}]`));

  const handleUpload = async (typeKey: string, file: File) => {
    if (!file) return;
    setUploading(typeKey);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', `[${typeKey}] ${file.name}`);
      const res = await fetch(`${API}/documents/upload`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      await load();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(null);
      if (fileRefs.current[typeKey]) fileRefs.current[typeKey]!.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce document ?')) return;
    await fetch(`${API}/documents/${id}`, { method: 'DELETE', headers });
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const handleDownload = (doc: Document) => {
    const url = doc.file_path.startsWith('http')
      ? doc.file_path
      : `${API.replace('/api', '')}${doc.file_path}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="flex items-center gap-3 px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
          <FileText size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
          <p className="text-xs text-gray-400">
            {documents.length} envoyé{documents.length !== 1 ? 's' : ''} · {receivedDocs.length} reçu{receivedDocs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-8 pt-5 pb-0 flex-shrink-0">
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'sent'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Send size={14} />
          Mes documents
          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
            activeTab === 'sent' ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-400'
          }`}>
            {documents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'received'
              ? 'border-orange-500 text-orange-500'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Inbox size={14} />
          Documents reçus
          {receivedDocs.length > 0 && (
            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'received' ? 'bg-orange-50 text-orange-500' : 'bg-orange-50 text-orange-400'
            }`}>
              {receivedDocs.length}
            </span>
          )}
        </button>

        <div className="flex-1 border-b border-gray-100"/>
      </div>

      <div className="px-8 py-6">

        {error && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            <AlertTriangle size={15} />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── MES DOCUMENTS (envoyés) ── */}
            {activeTab === 'sent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DOC_TYPES.map(({ key, label, icon: Icon, color, accept }) => {
                  const doc = getDocForType(key);
                  const days = daysUntilExpiry(doc?.expires_at);
                  const isExpiring = days !== null && days <= 30 && days > 0;
                  const isExpired  = days !== null && days <= 0;
                  const isUploading = uploading === key;

                  return (
                    <div
                      key={key}
                      className={`card border transition-all ${
                        doc ? 'border-gray-100' : 'border-dashed border-gray-200'
                      }`}
                    >
                      {/* Titre */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
                          <Icon size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          {doc ? (
                            <p className="text-xs text-gray-400 truncate">
                              {doc.name.replace(`[${key}] `, '')}
                              {doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">Aucun document</p>
                          )}
                        </div>

                        {/* Badge statut */}
                        {doc && (
                          <div className="flex-shrink-0">
                            {isExpired ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                                <AlertTriangle size={10} /> Expiré
                              </span>
                            ) : isExpiring ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-100">
                                <Clock size={10} /> {days}j
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                                <CheckCircle size={10} /> OK
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Info document existant */}
                      {doc && (
                        <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 rounded-xl text-xs text-gray-500">
                          <FileText size={12} className="text-gray-400" />
                          <span className="flex-1 truncate">
                            Importé le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          {doc.expires_at && (
                            <span className={isExpired ? 'text-red-500' : isExpiring ? 'text-orange-500' : ''}>
                              Exp. {new Date(doc.expires_at).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}

                      {/* Bouton import */}
                      <input
                        type="file"
                        accept={accept}
                        className="hidden"
                        ref={el => { fileRefs.current[key] = el; }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(key, f); }}
                      />
                      <button
                        onClick={() => fileRefs.current[key]?.click()}
                        disabled={isUploading}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                          doc
                            ? 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50'
                            : `border-dashed ${colorMap[color]} hover:opacity-80`
                        }`}
                      >
                        {isUploading
                          ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin"/>
                          : <Upload size={14} />
                        }
                        {isUploading
                          ? t('doc_import') + '...'
                          : doc ? t('doc_replace') : t('doc_import')
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── DOCUMENTS REÇUS (envoyés par admin) ── */}
            {activeTab === 'received' && (
              <>
                {receivedDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                      <Inbox size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">Aucun document reçu</p>
                    <p className="text-xs text-gray-300 mt-1">
                      Votre conseiller vous enverra ici vos documents de voyage
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {receivedDocs.map(doc => {
                      const days = daysUntilExpiry(doc.expires_at);
                      const isExpiring = days !== null && days <= 30 && days > 0;
                      const isExpired  = days !== null && days <= 0;

                      return (
                        <div
                          key={doc.id}
                          className="card border border-gray-100 flex items-center gap-4 hover:border-orange-200 transition-all group"
                        >
                          {/* Icône */}
                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 border border-orange-100">
                            <FileText size={18} className="text-orange-500" />
                          </div>

                          {/* Infos */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400">
                                Reçu le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                              </span>
                              {doc.file_size && (
                                <span className="text-xs text-gray-300">· {formatSize(doc.file_size)}</span>
                              )}
                              {doc.expires_at && (
                                <span className={`text-xs ${isExpired ? 'text-red-500' : isExpiring ? 'text-orange-500' : 'text-gray-400'}`}>
                                  · Exp. {new Date(doc.expires_at).toLocaleDateString('fr-FR')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Badge statut */}
                          <div className="flex-shrink-0">
                            {isExpired ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">
                                <AlertTriangle size={10}/> Expiré
                              </span>
                            ) : isExpiring ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-100">
                                <Clock size={10}/> {days}j
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                                <CheckCircle size={10}/> OK
                              </span>
                            )}
                          </div>

                          {/* Bouton télécharger */}
                          <button
                            onClick={() => handleDownload(doc)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50 transition-all"
                          >
                            <Download size={13}/>
                            Télécharger
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}