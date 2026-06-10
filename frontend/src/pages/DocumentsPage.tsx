import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { FileText, Upload, Trash2, AlertTriangle, Download, File, Image, FileType } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

interface Document {
  id: number;
  name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  expires_at?: string;
  created_at: string;
}

const requiredDocuments = [
  {
    key: 'passport',
    label: 'Passeport',
    required: true,
    hasExpiry: true,
  },
  {
    key: 'visa',
    label: 'Visa',
    required: false,
    hasExpiry: true,
  },
  {
    key: 'esta',
    label: 'ESTA / ETA / eTA',
    required: false,
    hasExpiry: true,
  },
  {
    key: 'return_ticket',
    label: 'Billet retour',
    required: false,
    hasExpiry: false,
  },
  {
    key: 'accommodation',
    label: "Justificatif d'hébergement",
    required: false,
    hasExpiry: false,
  },
  {
    key: 'financial_proof',
    label: 'Justificatif de ressources',
    required: false,
    hasExpiry: false,
  },
  {
    key: 'health_certificate',
    label: 'Certificat sanitaire',
    required: false,
    hasExpiry: true,
  },
];

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return FileType;
  return FileText;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};

const daysUntilExpiry = (date: string) => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function DocumentsPage() {
  const { jwt: token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', expires_at: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await fetch(`${API}/documents`, { headers });
    if (res.ok) setDocuments(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFileSelect = (file: File) => {
  setSelectedFile(file);

  if (selectedDocType) {
    setUploadForm({
      name: selectedDocType,
      expires_at: '',
    });
  } else {
    setUploadForm({
      name: file.name,
      expires_at: '',
    });
  }
};

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('name', uploadForm.name || selectedFile.name);
      if (uploadForm.expires_at) fd.append('expires_at', uploadForm.expires_at);
      const res = await fetch(`${API}/documents/upload`, { method: 'POST', headers, body: fd });
      if (res.ok) {
        setSelectedFile(null);
        setSelectedDocType(null);
        setUploadForm({ name: '', expires_at: '' });
        await load();
      }
    } finally { setUploading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce document ?')) return;
    await fetch(`${API}/documents/${id}`, { method: 'DELETE', headers });
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  const expiringDocs = documents.filter(d => d.expires_at && daysUntilExpiry(d.expires_at) <= 30 && daysUntilExpiry(d.expires_at) > 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
            <FileText size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Documents</h1>
            <p className="text-xs text-gray-400">{documents.length} fichier{documents.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Expiry alerts */}
        {expiringDocs.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <span className="text-sm font-medium text-amber-700">Documents expirant bientôt</span>
            </div>
            {expiringDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs text-amber-600 py-1">
                <span>{d.name}</span>
                <span className="font-medium">Expire dans {daysUntilExpiry(d.expires_at!)} jours</span>
              </div>
            ))}
          </div>
        )}

        {/* Upload form */}
        {selectedFile && (
          <div className="card border-orange-100 bg-orange-50/30">
            <h3 className="font-medium text-gray-800 mb-3 text-sm flex items-center gap-2">
              <Upload size={14} className="text-orange-500" />
              Fichier sélectionné : {selectedFile.name}
            </h3>
            <form onSubmit={handleUpload} className="space-y-3">
              <input type="text" placeholder="Nom du document" value={uploadForm.name}
                onChange={e => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="input-field" />
              <div>
                <label className="text-xs text-gray-500 block mb-1">Date d'expiration (optionnel)</label>
                <input type="date" value={uploadForm.expires_at}
                  onChange={e => setUploadForm({ ...uploadForm, expires_at: e.target.value })}
                  className="input-field" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
                  {uploading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={13} />}
                  {uploading ? 'Envoi...' : 'Envoyer'}
                </button>
                <button type="button" onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Annuler</button>
              </div>
            </form>
          </div>
        )}

        {/* Drop zone */}
        <div className="card">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="font-semibold text-gray-900">
        Documents requis pour un vol international
      </h2>
      <p className="text-xs text-gray-400 mt-1">
        Importez les documents nécessaires à votre voyage.
      </p>
    </div>

    <span className="text-xs text-gray-400">
      {
        requiredDocuments.filter(doc =>
          documents.some(
            d =>
              d.name.toLowerCase() ===
              doc.label.toLowerCase()
          )
        ).length
      }
      /{requiredDocuments.length}
    </span>
  </div>

  <div className="space-y-3">
    {requiredDocuments.map(doc => {
      const uploadedDoc = documents.find(
        d =>
          d.name.toLowerCase() ===
          doc.label.toLowerCase()
      );

      const days =
        uploadedDoc?.expires_at
          ? daysUntilExpiry(uploadedDoc.expires_at)
          : null;

      const expiringSoon =
        days !== null &&
        days > 0 &&
        days <= 30;

      const expired =
        days !== null &&
        days <= 0;

      return (
        <div
          key={doc.key}
          className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:border-orange-100 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-800">
                {doc.label}
              </p>

              {doc.required && (
                <span className="badge-orange text-xs">
                  Obligatoire
                </span>
              )}

              {uploadedDoc && (
                <span className="badge-green text-xs">
                  Importé
                </span>
              )}

              {expired && (
                <span className="badge-red text-xs">
                  Expiré
                </span>
              )}

              {expiringSoon && (
                <span className="badge-orange text-xs">
                  Expire dans {days} jours
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-1">
              {uploadedDoc
                ? `Ajouté le ${new Date(
                    uploadedDoc.created_at
                  ).toLocaleDateString('fr-FR')}`
                : 'Document non importé'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {uploadedDoc && (
              <a
                href={`/uploads/documents/${uploadedDoc.file_path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-orange-50 text-gray-500 hover:text-orange-500"
              >
                <Download size={16} />
              </a>
            )}

            <button
              onClick={() => {
                setSelectedDocType(doc.label);
                fileInputRef.current?.click();
              }}
              className={
                uploadedDoc
                  ? 'px-4 py-2 text-sm rounded-xl border border-orange-200 text-orange-600 hover:bg-orange-50'
                  : 'btn-primary'
              }
            >
              {uploadedDoc
                ? 'Remplacer'
                : 'Importer'}
            </button>
          </div>
        </div>
      );
    })}
  </div>
</div>

        {/* Documents list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const Icon = getFileIcon(doc.mime_type);
              const days = doc.expires_at ? daysUntilExpiry(doc.expires_at) : null;
              const isExpired = days !== null && days <= 0;
              const isExpiringSoon = days !== null && days > 0 && days <= 30;

              return (
                <div key={doc.id} className={`card flex items-center gap-4 hover:border-orange-100 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-800 text-sm truncate">{doc.name}</p>
                      {isExpired && <span className="badge-red text-xs">Expiré</span>}
                      {isExpiringSoon && <span className="badge-orange text-xs">Expire dans {days}j</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatSize(doc.file_size)}
                      {doc.expires_at && ` · Exp: ${new Date(doc.expires_at).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={`/uploads/documents/${doc.file_path}`} target="_blank" rel="noopener noreferrer"
                      className="p-2 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Télécharger">
                      <Download size={15} />
                    </a>
                    <button onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {documents.length === 0 && !selectedFile && (
              <div className="text-center py-10">
                <p className="text-sm text-gray-400">Aucun document importé</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
