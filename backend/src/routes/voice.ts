import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import Groq from 'groq-sdk';
import axios from 'axios';
import dotenv from 'dotenv';

import {
  getAppointments, getTakenSlots, createAppointment,
  cancelAppointment, joinWaitlist, getMyWaitlistPosition,
} from './appointments';
import { searchFlights, saveTicket, getUserTickets } from './tickets';

dotenv.config();

export const voiceRouter = Router();
voiceRouter.use(authGuard);

let _groq: Groq | null = null;
const getGroq = () => {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
  return _groq;
};

const SYSTEM_PROMPTS: Record<string, string> = {
  fr:  `Tu es Nestor, un concierge vocal de luxe élégant et chaleureux pour Selectour Alltour. Réponds TOUJOURS en français, avec élégance et concision (3-4 phrases max).`,
  en:  `You are Nestor, an elegant luxury voice concierge for Selectour Alltour. ALWAYS respond in English, elegantly and concisely (3-4 sentences max).`,
  ar:  `أنت نيستور، مرافق صوتي فاخر لوكالة Selectour Alltour. رد دائماً بالعربية بأناقة وإيجاز (3-4 جمل).`,
  es:  `Eres Nestor, un conserje de voz de lujo para Selectour Alltour. Responde SIEMPRE en español, con elegancia y concisión (3-4 frases máximo).`,
  pt:  `Você é Nestor, um concierge de voz de luxo para Selectour Alltour. Responda SEMPRE em português, com elegância e concisão (máximo 3-4 frases).`,
  dyu: `Tu es Nestor, un assistant pour Selectour Alltour. Réponds en dioula (langue mandé) avec quelques mots français si nécessaire, de façon simple et chaleureuse (3-4 phrases).`,
  bm:  `Aw ye Nestor ye, Selectour Alltour ka ladɛmɛbaga ye. Jaabi bambara kan na, ka nɔgɔya ani nɛnɛya (jaabi 3-4).`,
  wo:  `Yaa Nestor, jëfandikukat bu njëkk ci Selectour Alltour. Tënk jàng ci Wolof, ci xam-xam ak mbëgël (3-4 jumtukaay).`,
};

// ─────────────────────────────────────────────────────────────────────────
// OUTILS IA (function calling) — chaque outil appelle directement les
// fonctions métier de appointments.ts / tickets.ts, avec le userId du JWT
// (jamais celui que le modèle pourrait inventer).
// ─────────────────────────────────────────────────────────────────────────

const tools: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_flights',
      description: "Recherche des vols par origine, destination et date de départ, avec les prix réels. À utiliser avant toute proposition de réservation.",
      parameters: {
        type: 'object',
        properties: {
          origin: { type: 'string', description: "Code IATA de l'aéroport ou ville de départ, ex: CDG" },
          destination: { type: 'string', description: "Code IATA de l'aéroport ou ville d'arrivée, ex: JFK" },
          date: { type: 'string', description: 'Date de départ au format YYYY-MM-DD' },
          passengers: { type: 'number', description: 'Nombre de passagers adultes, par défaut 1' },
          cabinClass: { type: 'string', description: "Classe de voyage : economy, premium_economy, business ou first (par défaut economy)" },
        },
        required: ['origin', 'destination', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_flight',
      description: "Enregistre définitivement une offre de vol (trouvée via search_flights, avec son prix réel) dans les billets de l'utilisateur. N'appelle cette fonction qu'après confirmation explicite de l'utilisateur.",
      parameters: {
        type: 'object',
        properties: {
          flightNumber: { type: 'string' },
          airline: { type: 'string' },
          origin: { type: 'string' },
          destination: { type: 'string' },
          departureDate: { type: 'string' },
          arrivalDate: { type: 'string' },
          price: { type: 'number', description: 'Prix de l\'offre renvoyé par search_flights' },
          currency: { type: 'string', description: "Devise du prix, ex: EUR" },
        },
        required: ['origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_tickets',
      description: "Liste les billets de vol déjà enregistrés par l'utilisateur.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_slot_availability',
      description: "Vérifie les créneaux horaires déjà pris pour une date donnée. À utiliser systématiquement avant create_appointment.",
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'Date au format YYYY-MM-DD' } },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: "Prend un rendez-vous pour l'utilisateur. N'appelle cette fonction qu'après confirmation explicite du créneau par l'utilisateur.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Objet du rendez-vous, ex: Consultation, Prendre un billet' },
          description: { type: 'string' },
          dateTime: { type: 'string', description: 'Date et heure ISO, ex: 2026-07-15T14:00:00' },
          quantity: { type: 'number', description: 'Nombre de personnes, par défaut 1' },
          agent: { type: 'string', description: 'Agent souhaité (optionnel)' },
        },
        required: ['title', 'dateTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_appointments',
      description: "Liste les rendez-vous de l'utilisateur.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: "Annule un rendez-vous existant de l'utilisateur, à partir de son id (obtenu via list_my_appointments). Demande toujours confirmation avant d'appeler.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID du rendez-vous à annuler' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_waitlist',
      description: "Inscrit l'utilisateur sur la liste d'attente d'un jour déjà complet.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
          name: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['date', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_waitlist_position',
      description: "Consulte la position de l'utilisateur dans la liste d'attente d'un jour donné.",
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'Date au format YYYY-MM-DD' } },
        required: ['date'],
      },
    },
  },
];

async function executeTool(name: string, args: any, userId: number) {
  try {
    switch (name) {
      case 'search_flights':          return await searchFlights(args.origin, args.destination, args.date, args.passengers, args.cabinClass);
      case 'book_flight':             return await saveTicket(userId, args);
      case 'list_my_tickets':         return await getUserTickets(userId);
      case 'check_slot_availability': return { takenSlots: await getTakenSlots(args.date) };
      case 'create_appointment':      return await createAppointment(userId, args);
      case 'list_my_appointments':    return await getAppointments(userId);
      case 'cancel_appointment':      return await cancelAppointment(userId, args.id);
      case 'join_waitlist':           return await joinWaitlist(userId, args);
      case 'check_waitlist_position': return await getMyWaitlistPosition(userId, args.date);
      default: return { error: `Fonction inconnue : ${name}` };
    }
  } catch (e: any) {
    // Une erreur métier (créneau pris, champs manquants...) est renvoyée
    // au modèle sous forme de résultat d'outil, pour qu'il l'explique à
    // l'utilisateur au lieu de planter la conversation.
    return { error: e.message || 'Erreur inconnue', code: e.code };
  }
}

// POST /api/voice/stt
voiceRouter.post('/stt', async (req: AuthRequest, res: Response) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) return res.status(400).json({ message: 'Audio requis' });

    const buffer = Buffer.from(audioBase64, 'base64');
    const FormData = require('form-data');
    const fd = new FormData();
    fd.append('audio', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    fd.append('model_id', 'scribe_v1');

    const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', fd, {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, ...fd.getHeaders() },
    });
    res.json({ text: response.data.text || '' });
  } catch (err: any) {
    console.error('STT error:', err.response?.data || err.message);
    res.json({ text: '' });
  }
});

// POST /api/voice/chat — Nestor avec accès réel à l'application (RDV + billets)
voiceRouter.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const { messages, lang } = req.body;
    if (!messages?.length) return res.status(400).json({ message: 'Messages requis' });

    const basePrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS['fr'];
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const systemPrompt = `${basePrompt}

Nous sommes aujourd'hui : ${today}.
Tu as accès à des outils réels connectés à l'application (rendez-vous, liste d'attente, recherche et réservation de vols). Règles impératives :
- N'invente JAMAIS un résultat (créneau, vol, statut de réservation) : utilise toujours l'outil correspondant.
- Avant d'appeler create_appointment, vérifie d'abord la disponibilité avec check_slot_availability.
- N'appelle jamais create_appointment, book_flight, cancel_appointment ou join_waitlist sans confirmation explicite et récente de l'utilisateur dans la conversation.
- Si une information obligatoire manque (date, heure, titre, origine, destination du vol...), demande-la avant d'appeler l'outil.
- Après un appel d'outil, résume le résultat en langage naturel, avec élégance et concision — ne montre jamais de JSON brut.`;

    const conversation: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20),
    ];

    let reply = '';
    const MAX_TOOL_ROUNDS = 4;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await getGroq().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: conversation,
        tools,
        max_tokens: 512,
        temperature: 0.7,
      });

      const msg = completion.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        conversation.push(msg);
        for (const call of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* args vides */ }
          const result = await executeTool(call.function.name, args, req.user!.id);
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue; // relance la boucle pour laisser Nestor formuler la réponse finale
      }

      reply = msg.content || '';
      break;
    }

    if (!reply) reply = "Désolé, je n'ai pas pu terminer cette action. Pouvez-vous reformuler ?";

    await pool.query(
      'INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)',
      [req.user!.id, 'assistant', reply]
    ).catch(() => {});

    res.json({ reply });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});