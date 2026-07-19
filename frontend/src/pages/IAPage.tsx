import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { triggerNotificationsRefresh } from '../hooks/useNotification';
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2, Copy, Edit2, X, Check } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function IAPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const {
    isRecording, isLoading, isSpeaking, speakingMsgId,
    startRecording, stopAndTranscribe, sendMessage, speak, stopSpeaking,
  } = useVoice();

  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('nestor_chat') || '[]'); }
    catch { return []; }
  });
  const [input, setInput]           = useState('');
  const [error, setError]           = useState('');
  const [autoSpeak, setAutoSpeak]   = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId]     = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const nextId    = useRef(messages.length + 1);

  useEffect(() => {
    sessionStorage.setItem('nestor_chat', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const SUGGESTIONS = [
    t('ia_suggestion_flight'),
    t('ia_suggestion_appointment'),
    t('ia_suggestion_documents'),
    t('ia_suggestion_return'),
  ];

  const firstName = user?.name?.split(' ')[0] || '';

  // ── ENVOYER — passe la langue à Groq ────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError('');

    const userMsg: Message = { id: nextId.current++, role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');

    try {
      const lang = i18n.language || localStorage.getItem('lang') || 'fr';
      const reply = await sendMessage(
        updated.map(m => ({ role: m.role, content: m.content })),
        lang
      );
      const assistantMsg: Message = { id: nextId.current++, role: 'assistant', content: reply };
      const newId = assistantMsg.id;
      setMessages(prev => [...prev, assistantMsg]);

      // Nestor a pu réserver un vol, prendre/annuler un RDV, etc. pendant
      // cet échange : on force le badge de notifications à se rafraîchir
      // tout de suite plutôt que d'attendre le prochain polling (20s).
      triggerNotificationsRefresh();

      if (autoSpeak) await speak(reply, newId);
    } catch (err: any) {
      setError(err.message || 'Erreur de communication');
    }
  }, [messages, isLoading, autoSpeak, speak, sendMessage, i18n.language]);

  // ── MICRO — un seul clic lance ET attend la reconnaissance ──
  const handleVoiceToggle = async () => {
    if (isRecording) {
      // Arrête la reconnaissance en cours (onend résoudra la promesse)
      await stopAndTranscribe();
      return;
    }
    try {
      // startRecording retourne le texte reconnu quand l'utilisateur s'arrête de parler
      const text = await startRecording();
      if (text.trim()) handleSend(text);
      else setError('Aucune parole détectée. Réessayez.');
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Microphone non disponible');
    }
  };

  // ── VOIX BULLE INDIVIDUELLE ──────────────────────────────
  const handleSpeakMsg = async (msg: Message) => {
    if (speakingMsgId === msg.id && isSpeaking) {
      stopSpeaking();
    } else {
      if (isSpeaking) stopSpeaking();
      await speak(msg.content, msg.id);
    }
  };

  // ── AUTOSPEAK ────────────────────────────────────────────
  const handleAutoSpeakToggle = () => {
    if (isSpeaking) stopSpeaking();
    setAutoSpeak(prev => !prev);
  };

  // ── COPIER ───────────────────────────────────────────────
  const handleCopy = async (msg: Message) => {
    await navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── MODIFIER ─────────────────────────────────────────────
  const handleEditStart = (msg: Message) => { setEditingId(msg.id); setEditContent(msg.content); };
  const handleEditSave  = (msg: Message) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editContent } : m));
    setEditingId(null);
  };

  // ── SUPPRIMER / EFFACER ──────────────────────────────────
  const handleDeleteMsg = (id: number) => setMessages(prev => prev.filter(m => m.id !== id));
  const handleClear     = () => { setMessages([]); sessionStorage.removeItem('nestor_chat'); };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-orange-500/6 blur-3xl pointer-events-none" />
      <div className="absolute bottom-32 left-0 w-72 h-72 rounded-full bg-orange-300/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 pt-6 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {firstName ? <>Bonjour, <span className="text-orange-500">{firstName}</span></> : t('ia_title')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('ia_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* AutoSpeak toggle */}
          <button onClick={handleAutoSpeakToggle}
            className={`p-2 rounded-xl transition-all ${
              autoSpeak
                ? 'bg-orange-50 text-orange-500 border border-orange-200'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
            title={autoSpeak ? 'Désactiver la voix auto' : 'Activer la voix auto'}>
            {autoSpeak && isSpeaking
              ? <Volume2 size={16} className="animate-pulse" />
              : autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {/* Stop voix */}
          {isSpeaking && (
            <button onClick={stopSpeaking}
              className="p-2 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-all"
              title="Arrêter la voix">
              <VolumeX size={16} />
            </button>
          )}
          {/* Effacer conversation */}
          {messages.length > 0 && (
            <button onClick={handleClear}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title={t('ia_clear')}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-2 space-y-5">

        {/* État vide */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full pb-10 gap-8">
            <div className="relative cursor-pointer group" onClick={handleVoiceToggle}>
              <div className={`absolute inset-0 rounded-full bg-orange-500/20 transition-all duration-300 ${
                isRecording ? 'scale-150 opacity-100' : 'scale-100 opacity-0 group-hover:opacity-50'
              }`} />
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                isRecording ? 'bg-red-500 shadow-red-500/40 scale-110' : 'bg-orange-500 shadow-orange-500/40 group-hover:scale-105'
              }`}>
                {isRecording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              {isRecording ? t('ia_recording') : t('ia_orb_hint')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => handleSend(s)}
                  className="text-left px-4 py-3 rounded-2xl border border-orange-100 bg-orange-50/50 text-sm text-gray-600 hover:bg-orange-50 hover:border-orange-200 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bulles */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

            {/* Avatar Nestor */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-orange-500/20">
                <span className="text-white text-xs font-bold">N</span>
              </div>
            )}

            <div className="flex flex-col gap-1 max-w-[75%]">
              {/* Édition inline */}
              {editingId === msg.id ? (
                <div className="flex flex-col gap-2">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                    className="px-4 py-3 rounded-2xl border border-orange-300 text-sm text-gray-800 outline-none resize-none bg-white shadow-sm"
                    rows={3} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSave(msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs rounded-xl hover:bg-orange-600 transition-all">
                      <Check size={12} /> Enregistrer
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-xl hover:bg-gray-200 transition-all">
                      <X size={12} /> Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-tr-sm shadow-md shadow-orange-500/20'
                    : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              )}

              {/* ── 4 icônes sous la bulle ── */}
              {editingId !== msg.id && (
                <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}>

                  {/* Copier */}
                  <button onClick={() => handleCopy(msg)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                    title="Copier">
                    {copiedId === msg.id
                      ? <Check size={13} className="text-green-500" />
                      : <Copy size={13} />}
                  </button>

                  {/* Modifier */}
                  <button onClick={() => handleEditStart(msg)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-all"
                    title="Modifier">
                    <Edit2 size={13} />
                  </button>

                  {/* Supprimer */}
                  <button onClick={() => handleDeleteMsg(msg.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Supprimer">
                    <Trash2 size={13} />
                  </button>

                  {/* ── Voix bulle (4e icône) ── */}
                  <button onClick={() => handleSpeakMsg(msg)}
                    className={`p-1.5 rounded-lg transition-all ${
                      speakingMsgId === msg.id && isSpeaking
                        ? 'text-orange-500 bg-orange-50 animate-pulse'
                        : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                    }`}
                    title={speakingMsgId === msg.id && isSpeaking ? 'Arrêter la lecture' : 'Écouter'}>
                    {speakingMsgId === msg.id && isSpeaking
                      ? <VolumeX size={13} />
                      : <Volume2 size={13} />}
                  </button>

                </div>
              )}
            </div>

            {/* Avatar user */}
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-gray-500 text-xs font-bold">
                  {(user?.name?.[0] || 'U').toUpperCase()}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Typing */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100">{error}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Barre input */}
      <div className="px-4 md:px-8 pb-6 pt-3 flex-shrink-0">
        {isRecording && (
          <div className="flex items-center justify-center gap-2 mb-2 text-xs text-red-500">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {t('ia_recording')}
          </div>
        )}
        <div className={`flex items-center gap-3 bg-white border rounded-2xl px-4 py-3 shadow-sm transition-all ${
          isRecording ? 'border-red-300' : 'border-gray-200 focus-within:border-orange-300'
        }`}>
          <button onClick={handleVoiceToggle}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
            }`}>
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <input ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder={isRecording ? t('ia_recording') : t('ia_placeholder')}
            disabled={isRecording}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none" />
          {isSpeaking && (
            <button onClick={stopSpeaking}
              className="flex-shrink-0 text-orange-400 hover:text-red-500 transition-colors">
              <VolumeX size={16} />
            </button>
          )}
          <button onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading || isRecording}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-orange-500/20">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}