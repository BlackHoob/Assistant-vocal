import { useState, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const useVoice = () => {
  const { token } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ─── ENREGISTREMENT MICRO ────────────────────────────────
  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.start(100);
    recorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stopAndTranscribe = useCallback((): Promise<string> =>
    new Promise((resolve, reject) => {
      const recorder = recorderRef.current!;
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const res = await fetch(`${API}/voice/stt`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ audioBase64: base64 }),
            });
            const data = await res.json();
            resolve(data.text || '');
          };
          reader.readAsDataURL(blob);
        } catch (e) { reject(e); }
      };
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
    }), [token]);

  // ─── CHAT IA ─────────────────────────────────────────────
  const sendMessage = useCallback(async (messages: any[]): Promise<string> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/voice/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      return data.reply || '';
    } finally { setIsLoading(false); }
  }, [token]);

  // ─── SYNTHÈSE VOCALE (Web Speech API) ───────────────────
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Annuler toute synthèse en cours
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      synthRef.current = utterance;

      // Configuration voix française
      const langCode = (window as any).__nestorLang || localStorage.getItem('lang') || 'fr';
      const langMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA', es: 'es-ES', pt: 'pt-BR' };
      utterance.lang = langMap[langCode] || 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Chercher une voix dans la langue choisie
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(v =>
        v.lang.startsWith(langCode) && (v.name.includes('Google') || v.name.includes('Microsoft'))
      ) || voices.find(v => v.lang.startsWith(langCode));
      if (matchVoice) utterance.voice = matchVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isRecording,
    isLoading,
    isSpeaking,
    startRecording,
    stopAndTranscribe,
    sendMessage,
    speak,
    stopSpeaking,
  };
};