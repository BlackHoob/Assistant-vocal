import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import Groq from 'groq-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const voiceRouter = Router();
voiceRouter.use(authGuard);

let _groq: Groq | null = null;
const getGroq = () => {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return _groq;
};

const SYSTEM_PROMPT = `Tu es Nestor, un concierge vocal de luxe élégant et chaleureux pour l'agence Selectour Alltour.
Tu aides les clients avec leurs voyages, rendez-vous, documents et billets de vol.
Réponds toujours en français, avec élégance et concision (3-4 phrases maximum).
Si on te demande de chercher un vol, demande le numéro de vol IATA.`;

// POST /api/voice/stt — Transcription audio via ElevenLabs
voiceRouter.post('/stt', async (req: AuthRequest, res: Response) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) return res.status(400).json({ message: 'Audio requis' });

    const buffer = Buffer.from(audioBase64, 'base64');
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('audio', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    fd.append('model_id', 'scribe_v1');
    fd.append('language_code', 'fr');

    const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', fd, {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        ...fd.getHeaders(),
      },
    });
    res.json({ text: response.data.text || '' });
  } catch (err: any) {
    // Si ElevenLabs STT échoue, retourner un texte vide plutôt qu'une erreur 500
    console.error('STT error:', err.response?.data || err.message);
    res.json({ text: '' });
  }
});

// POST /api/voice/chat — Réponse IA via Groq
voiceRouter.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages?.length) return res.status(400).json({ message: 'Messages requis' });

    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-20)],
      max_tokens: 512,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || '';

    // Sauvegarder en base MySQL
    await pool.query(
      'INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)',
      [req.user!.id, 'assistant', reply]
    ).catch(() => {});

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// NOTE : TTS supprimé — remplacé par Web Speech API côté navigateur
