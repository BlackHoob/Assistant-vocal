import { useState, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const LANG_MAP: Record<string, string> = {
  fr: 'fr-FR', en: 'en-US', ar: 'ar-SA',
  es: 'es-ES', pt: 'pt-BR',
  dyu: 'fr-FR', bm: 'fr-FR', wo: 'fr-FR',
};

const getCurrentLocale = () => {
  const lang = (window as any).__nestorLang || localStorage.getItem('lang') || 'fr';
  return LANG_MAP[lang] || 'fr-FR';
};

const getBestVoice = (locale: string) => {
  const voices = window.speechSynthesis.getVoices();
  const code = locale.split('-')[0];
  return (
    voices.find(v => v.lang === locale && (v.name.includes('Google') || v.name.includes('Microsoft'))) ||
    voices.find(v => v.lang === locale) ||
    voices.find(v => v.lang.startsWith(code)) ||
    null
  );
};

const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const useVoice = () => {
  const { token } = useAuth();
  const [isRecording, setIsRecording]     = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);

  const onResultRef = useRef<((text: string) => void) | null>(null);
  const onErrorRef  = useRef<((msg: string) => void) | null>(null);
  const srRef       = useRef<any>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  //  STT : démarre ET attend le résultat en une seule promesse 
  const startRecording = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      if (!SR) {
        reject('Reconnaissance vocale non disponible. Utilisez Chrome.');
        return;
      }

      // Annuler toute session précédente
      if (srRef.current) {
        try { srRef.current.abort(); } catch {}
      }

      const sr = new SR();
      sr.lang = getCurrentLocale();
      sr.interimResults = false;
      sr.maxAlternatives = 1;
      sr.continuous = false;
      srRef.current = sr;

      let resolved = false;

      sr.onstart = () => setIsRecording(true);

      sr.onresult = (e: any) => {
        const text = e.results[0]?.[0]?.transcript?.trim() || '';
        if (!resolved) {
          resolved = true;
          setIsRecording(false);
          resolve(text);
        }
      };

      sr.onerror = (e: any) => {
        setIsRecording(false);
        if (resolved) return;
        resolved = true;
        const msg =
          e.error === 'not-allowed'  ? 'Micro refusé — autorisez le micro dans Chrome (bloquer → Microphone → Autoriser).' :
          e.error === 'no-speech'    ? 'Aucune parole détectée. Réessayez.' :
          e.error === 'network'      ? 'Erreur réseau micro.' :
          `Erreur micro : ${e.error}`;
        reject(msg);
      };

      sr.onend = () => {
        setIsRecording(false);
        if (!resolved) {
          resolved = true;
          resolve(''); // silence ou arrêt manuel → texte vide
        }
      };

      sr.start();
    });
  }, []);

  // stopAndTranscribe n'est plus nécessaire — on arrête la reconnaissance manuellement
  const stopAndTranscribe = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const sr = srRef.current;
      if (!sr) return resolve('');
      // onend va résoudre la promesse de startRecording
      // On crée une nouvelle promesse qui attend onend
      const orig = sr.onend;
      sr.onend = () => {
        if (orig) orig();
        resolve('');
      };
      try { sr.stop(); } catch {}
      setIsRecording(false);
    });
  }, []);

  //  CHAT 
  const sendMessage = useCallback(async (messages: any[], lang?: string): Promise<string> => {
    setIsLoading(true);
    try {
      const currentLang = lang || (window as any).__nestorLang || localStorage.getItem('lang') || 'fr';
      const res = await fetch(`${API}/voice/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({ messages, lang: currentLang }),
      });
      const data = await res.json();
      return data.reply || '';
    } finally { setIsLoading(false); }
  }, [token]);

  //  TTS 
  const speak = useCallback((text: string, msgId?: number): Promise<void> => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const locale = getCurrentLocale();
      utterance.lang = locale; utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1;
      const doSpeak = () => {
        const voice = getBestVoice(locale);
        if (voice) utterance.voice = voice;
        utterance.onstart = () => { setIsSpeaking(true); if (msgId !== undefined) setSpeakingMsgId(msgId); };
        utterance.onend   = () => { setIsSpeaking(false); setSpeakingMsgId(null); resolve(); };
        utterance.onerror = () => { setIsSpeaking(false); setSpeakingMsgId(null); resolve(); };
        window.speechSynthesis.speak(utterance);
      };
      window.speechSynthesis.getVoices().length === 0
        ? (window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); })
        : doSpeak();
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false); setSpeakingMsgId(null);
  }, []);

  return { isRecording, isLoading, isSpeaking, speakingMsgId, startRecording, stopAndTranscribe, sendMessage, speak, stopSpeaking };
};