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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

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
              method: 'POST', headers, body: JSON.stringify({ audioBase64: base64 }),
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

  const sendMessage = useCallback(async (messages: any[]): Promise<string> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/voice/chat`, {
        method: 'POST', headers, body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      return data.reply || '';
    } finally { setIsLoading(false); }
  }, [token]);

  const speak = useCallback(async (text: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(true);
    try {
      const res = await fetch(`${API}/voice/tts`, {
        method: 'POST', headers, body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch { setIsSpeaking(false); }
  }, [token]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause(); audioRef.current = null; setIsSpeaking(false);
  }, []);

  return { isRecording, isLoading, isSpeaking, startRecording, stopAndTranscribe, sendMessage, speak, stopSpeaking };
};