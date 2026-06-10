import { useState, useRef, useEffect } from 'react';
import { useVoice } from '../hooks/useVoice';
import { useAuth } from '../hooks/useAuth';
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Réserver un vol Paris → Abidjan',
  'Mes rendez-vous cette semaine',
  'Vérifier mes documents expirés',
  'Trouver un vol aller-retour',
];

export default function IAPage() {
  const { user } = useAuth();
  const { isRecording, isLoading, isSpeaking, startRecording, stopAndTranscribe, sendMessage, speak, stopSpeaking } = useVoice();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError('');
    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    try {
      const reply = await sendMessage(newMessages);
      const assistantMsg: Message = { role: 'assistant', content: reply };
      setMessages(prev => [...prev, assistantMsg]);
      if (autoSpeak) await speak(reply);
    } catch (err: any) {
      setError(err.message || 'Erreur de communication');
    }
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      try {
        const text = await stopAndTranscribe();
        if (text) handleSend(text);
      } catch (err) {
        setError('Erreur de transcription');
      }
    } else {
      try {
        await startRecording();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'vous';

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-orange-500/6 blur-3xl pointer-events-none orb-pulse" />
      <div className="absolute bottom-32 left-0 w-72 h-72 rounded-full bg-orange-300/5 blur-3xl pointer-events-none" style={{ animationDelay: '1.5s' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Bonjour, <span className="text-orange-500">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Comment puis-je vous aider ?</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => autoSpeak ? stopSpeaking() : setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-xl transition-all text-sm ${autoSpeak ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-400'}`}
            title={autoSpeak ? 'Désactiver la voix' : 'Activer la voix'}
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Effacer la conversation"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-8 py-2 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full pb-10 gap-8">
            {/* Voice orb */}
            <div className="relative cursor-pointer group" onClick={handleVoiceToggle}>
              {/* Outer pulse ring */}
              <div className={`absolute inset-0 rounded-full bg-orange-500/20 transition-all duration-300 ${isRecording ? 'orb-ring scale-100' : 'scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100'}`} />
              <div className={`absolute inset-2 rounded-full bg-orange-500/10 ${isRecording ? 'animate-ping' : ''}`} />
              {/* Main orb */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                isRecording
                  ? 'bg-red-500 shadow-red-500/40 scale-110'
                  : 'bg-orange-500 shadow-orange-500/40 group-hover:scale-105'
              }`}>
                {isRecording
                  ? <MicOff size={28} className="text-white" />
                  : <Mic size={28} className="text-white" />
                }
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              {isRecording
                ? 'Enregistrement en cours... Appuyez à nouveau pour envoyer'
                : 'Appuyez sur l\'orbe pour parler, ou utilisez le champ texte ci-dessous'
              }
            </p>
            {/* Suggestion chips */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-left px-4 py-3 rounded-2xl border border-orange-100 bg-orange-50/50 text-sm text-gray-600 hover:bg-orange-50 hover:border-orange-200 transition-all backdrop-blur-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-orange-500/20">
                <span className="text-white text-xs font-bold">N</span>
              </div>
            )}
            <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-tr-sm shadow-md shadow-orange-500/20'
                : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">N</span>
            </div>
            <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
              <div className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
              <div className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
              <div className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100">
              {error}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-8 pb-8 pt-3 flex-shrink-0">
        <div className={`flex items-center gap-3 bg-white border rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 ${
          isRecording ? 'border-red-300 shadow-red-500/10' : 'border-gray-200 focus-within:border-orange-300 shadow-orange-500/5'
        }`}>
          <button
            onClick={handleVoiceToggle}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
            }`}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder={isRecording ? 'Enregistrement...' : 'Écrivez votre demande...'}
            disabled={isRecording}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
          {isSpeaking && (
            <button onClick={stopSpeaking} className="flex-shrink-0 text-orange-400 hover:text-orange-600 transition-colors">
              <VolumeX size={16} />
            </button>
          )}
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isLoading || isRecording}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-orange-500/20"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}