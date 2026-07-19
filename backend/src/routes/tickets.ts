import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import axios from 'axios';
import dotenv from 'dotenv';
import { createNotification } from './notifications';
dotenv.config();

export const ticketsRouter = Router();
ticketsRouter.use(authGuard);

const DUFFEL_API_KEY = process.env.DUFFEL_API_KEY || '';
const DUFFEL_URL = 'https://api.duffel.com';

const duffelHeaders = {
  Authorization: `Bearer ${DUFFEL_API_KEY}`,
  'Duffel-Version': 'v2',
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Convertit une durée ISO 8601 (ex: "PT7H45M") en format lisible (ex: "7h45")
function formatIsoDuration(iso?: string): string {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return '';
  const hours = match[1] ? `${match[1]}h` : '';
  const minutes = match[2] ? match[2].padStart(2, '0') : '00';
  return hours ? `${hours}${minutes}` : `${minutes}min`;
}

// Normalise une offre Duffel vers le format utilisé par le frontend
function mapDuffelOffer(offer: any) {
  const slice = offer.slices?.[0] || {};
  const segments = slice.segments || [];
  const firstSeg = segments[0] || {};
  const lastSeg = segments[segments.length - 1] || {};

  return {
    id: offer.id,
    airline: offer.owner?.name || '',
    airlineLogo: offer.owner?.logo_symbol_url || '',
    flightNumber: firstSeg.marketing_carrier
      ? `${firstSeg.marketing_carrier.iata_code || ''}${firstSeg.marketing_carrier_flight_number || ''}`
      : '',
    origin: firstSeg.origin?.iata_code || slice.origin?.iata_code || '',
    destination: lastSeg.destination?.iata_code || slice.destination?.iata_code || '',
    departureDate: firstSeg.departing_at || '',
    arrivalDate: lastSeg.arriving_at || '',
    duration: formatIsoDuration(slice.duration),
    stops: Math.max(segments.length - 1, 0),
    cabinClass: offer.cabin_class || '',
    price: offer.total_amount ? parseFloat(offer.total_amount) : 0,
    currency: offer.total_currency || 'EUR',
    expiresAt: offer.expires_at || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Fonctions métier réutilisables : appelées par les routes HTTP ci-dessous
// ET par les outils IA de voice.ts (function calling).
// ─────────────────────────────────────────────────────────────────────────

export async function searchFlights(
  origin: string,
  destination: string,
  departureDate: string,
  passengers: number = 1,
  cabinClass: string = 'economy'
) {
  if (!origin || !destination || !departureDate) {
    const e: any = new Error('Origine, destination et date requises (ex : CDG, JFK, 2026-08-15)');
    e.code = 'MISSING_FIELDS';
    throw e;
  }

  const passengerList = Array.from({ length: Math.max(passengers, 1) }, () => ({ type: 'adult' }));

  const response = await axios.post(
    `${DUFFEL_URL}/air/offer_requests?return_offers=true`,
    {
      data: {
        slices: [
          {
            origin: origin.toUpperCase(),
            destination: destination.toUpperCase(),
            departure_date: departureDate,
          },
        ],
        passengers: passengerList,
        cabin_class: cabinClass,
      },
    },
    { headers: duffelHeaders }
  );

  const offers = response.data?.data?.offers || [];
  return offers
    .map(mapDuffelOffer)
    .sort((a: any, b: any) => a.price - b.price)
    .slice(0, 20);
}

export async function getUserTickets(userId: number) {
  const [rows]: any = await pool.query(
    'SELECT * FROM tickets WHERE userId = ? ORDER BY departureDate DESC',
    [userId]
  );
  return rows;
}

export async function saveTicket(userId: number, data: {
  flightNumber?: string; airline?: string; origin: string; destination: string;
  departureDate?: string; arrivalDate?: string; price?: number; currency?: string;
}) {
  const { flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency } = data;
  if (!origin || !destination) {
    const e: any = new Error('Origine et destination requis'); e.code = 'MISSING_FIELDS'; throw e;
  }

  const [result]: any = await pool.query(
    `INSERT INTO tickets (userId, flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, flightNumber || '', airline || '', origin, destination,
     departureDate || '', arrivalDate || '', price ? parseFloat(price as any) : 0, currency || 'EUR']
  );
  const [rows]: any = await pool.query('SELECT * FROM tickets WHERE id = ?', [result.insertId]);
  const ticket = rows[0];

  const flightLabel = flightNumber ? `${flightNumber} ` : '';
  await createNotification(userId, 'success', 'ticket', `Billet ${flightLabel}${origin} → ${destination} enregistré`);

  return ticket;
}

export async function deleteTicket(userId: number, id: string) {
  await pool.query('DELETE FROM tickets WHERE id = ? AND userId = ?', [id, userId]);
}

// ─────────────────────────────────────────────────────────────────────────
// Routes HTTP — appellent uniquement les fonctions ci-dessus
// ─────────────────────────────────────────────────────────────────────────

// GET /api/tickets
ticketsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try { res.json(await getUserTickets(req.user!.id)); }
  catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/tickets/search — recherche par origine / destination / date
ticketsRouter.post('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { origin, destination, date, passengers, cabinClass } = req.body;
    res.json(await searchFlights(origin, destination, date, passengers, cabinClass));
  } catch (err: any) {
    if (err.code === 'MISSING_FIELDS') return res.status(400).json({ message: err.message });
    const msg = err.response?.data?.errors?.[0]?.message || err.message;
    res.status(500).json({ message: `Erreur recherche vols : ${msg}` });
  }
});

// POST /api/tickets — sauvegarder un billet
ticketsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await saveTicket(req.user!.id, req.body);
    res.status(201).json(ticket);
  } catch (err: any) {
    if (err.code === 'MISSING_FIELDS') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/tickets/:id/status
ticketsRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE tickets SET status = ? WHERE id = ? AND userId = ?',
      [status, req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/tickets/:id
ticketsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try { await deleteTicket(req.user!.id, req.params.id); res.json({ success: true }); }
  catch (err: any) { res.status(500).json({ message: err.message }); }
});