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

const SYSTEM_PROMPT = `Tu es Nestor, un concierge vocal de luxe élégant et chaleureux.
Tu aides avec les voyages, les rendez-vous, les documents et des conseils personnalisés.
Réponds toujours en français, avec élégance et concision (3-4 phrases max).`;

voiceRouter.post('/stt', async (req: AuthRequest, res: Response) => {
  try {
    const { audioBase64 } = req.body;
    const buffer = Buffer.from(audioBase64, 'base64');
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('audio', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    fd.append('model_id', 'scribe_v1');
    fd.append('language_code', 'fr');
    const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', fd, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, ...fd.getHeaders() },
    });
    res.json({ text: response.data.text || '' });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

voiceRouter.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body;
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-20)],
      max_tokens: 512,
    });
    const reply = completion.choices[0]?.message?.content || '';
    await pool.query('INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)',
      [req.user!.id, 'assistant', reply]).catch(() => {});
    res.json({ reply });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

voiceRouter.post('/tts', async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } },
      { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, responseType: 'arraybuffer' }
    );
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(response.data));
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});
