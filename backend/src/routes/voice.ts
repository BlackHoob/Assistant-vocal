import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import Groq from 'groq-sdk';
import axios from 'axios';
import FormData from 'form-data';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../errors/AppError';
import { SYSTEM_PROMPTS } from './voice/prompts';
import { voiceTools } from './voice/tools';
import { executeVoiceTool } from './voice/toolExecutor';
import { MySqlChatMessageRepository } from '../repository/chatMessageRepository';

export const voiceRouter = Router();
voiceRouter.use(authGuard);

const chatMessageRepository = new MySqlChatMessageRepository();

const GROQ_MODEL = 'openai/gpt-oss-120b';
const MAX_TOOL_ROUNDS = 4;
const MAX_CONVERSATION_HISTORY = 20;
const FALLBACK_REPLY = "Désolé, je n'ai pas pu terminer cette action. Pouvez-vous reformuler ?";

let groqClient: Groq | null = null;
function getGroqClient(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return groqClient;
}

function buildSystemPrompt(lang: string): string {
  const basePrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS['fr'];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return `${basePrompt}

Nous sommes aujourd'hui : ${today}.
Tu as accès à des outils réels connectés à l'application (rendez-vous, liste d'attente, recherche et réservation de vols). Règles impératives :
- N'invente JAMAIS un résultat (créneau, vol, statut de réservation) : utilise toujours l'outil correspondant.
- Avant d'appeler create_appointment, vérifie d'abord la disponibilité avec check_slot_availability.
- N'appelle jamais create_appointment, book_flight, cancel_appointment ou join_waitlist sans confirmation explicite et récente de l'utilisateur dans la conversation.
- Si une information obligatoire manque (date, heure, titre, origine, destination du vol...), demande-la avant d'appeler l'outil.
- Après un appel d'outil, résume le résultat en langage naturel, avec élégance et concision — ne montre jamais de JSON brut.`;
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}'); }
  catch { return {}; }
}

// Boucle de function-calling : laisse le modèle appeler des outils jusqu'à
// MAX_TOOL_ROUNDS fois, puis force une réponse texte. Extrait de la route
// /chat pour que celle-ci ne fasse qu'une chose : gérer la requête HTTP.
async function runConversationWithTools(conversation: any[], userId: number): Promise<string> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: conversation,
      tools: voiceTools,
      max_tokens: 512,
      temperature: 0.7,
    });

    const message = completion.choices[0]?.message;
    if (!message) break;
    if (!message.tool_calls?.length) return message.content || '';

    conversation.push(message);
    for (const call of message.tool_calls) {
      const args = parseToolArguments(call.function.arguments);
      const result = await executeVoiceTool(call.function.name, args, userId);
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return '';
}

// POST /api/voice/stt
voiceRouter.post('/stt', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { audioBase64 } = req.body;
  if (!audioBase64) throw new ValidationError('Audio requis');

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    formData.append('audio', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    formData.append('model_id', 'scribe_v1');

    const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', formData, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, ...formData.getHeaders() },
    });
    res.json({ text: response.data.text || '' });
  } catch (err: any) {
    
  
    console.error('STT error:', err.response?.data || err.message);
    res.json({ text: '' });
  }
}));

// POST /api/voice/chat — Nestor avec accès réel à l'application (RDV + billets)
voiceRouter.post('/chat', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { messages, lang } = req.body;
  if (!messages?.length) throw new ValidationError('Messages requis');

  const conversation = [
    { role: 'system', content: buildSystemPrompt(lang) },
    ...messages.slice(-MAX_CONVERSATION_HISTORY),
  ];

  const reply = (await runConversationWithTools(conversation, req.user!.id)) || FALLBACK_REPLY;

  await chatMessageRepository.create(req.user!.id, 'assistant', reply).catch(() => {});

  res.json({ reply });
}));

