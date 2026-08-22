import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import axios from 'axios';
import { createNotification } from './notifications';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, ValidationError } from '../errors/AppError';
import { Ticket, FlightOffer } from '../types';
import { MySqlTicketRepository } from '../repository/ticketRepository';

export const ticketsRouter = Router();
ticketsRouter.use(authGuard);

const ticketRepository = new MySqlTicketRepository();

const DUFFEL_API_KEY = process.env.DUFFEL_API_KEY || '';
const DUFFEL_URL = 'https://api.duffel.com';
const MAX_OFFERS_RETURNED = 20;

const duffelHeaders = {
  Authorization: `Bearer ${DUFFEL_API_KEY}`,
  'Duffel-Version': 'v2',
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Sous-ensemble typé de la réponse Duffel réellement utilisé ici (l'API en
// renvoie beaucoup plus, mais on ne type que ce qu'on lit).
interface DuffelSegment {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { iata_code?: string };
  marketing_carrier_flight_number?: string;
}
interface DuffelSlice {
  duration?: string;
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  segments?: DuffelSegment[];
}
interface DuffelOffer {
  id: string;
  owner?: { name?: string; logo_symbol_url?: string };
  slices?: DuffelSlice[];
  cabin_class?: string;
  total_amount?: string;
  total_currency?: string;
  expires_at?: string;
}

// Convertit une durée ISO 8601 (ex: "PT7H45M") en format lisible (ex: "7h45")
export function formatIsoDuration(iso?: string): string {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return '';
  const hours = match[1] ? `${match[1]}h` : '';
  const minutes = match[2] ? match[2].padStart(2, '0') : '00';
  return hours ? `${hours}${minutes}` : `${minutes}min`;
}

// Normalise une offre Duffel vers le format utilisé par le frontend
export function mapDuffelOffer(offer: DuffelOffer): FlightOffer {
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
): Promise<FlightOffer[]> {
  if (!origin || !destination || !departureDate) {
    throw new ValidationError('Origine, destination et date requises (ex : CDG, JFK, 2026-08-15)');
  }

  const passengerList = Array.from({ length: Math.max(passengers, 1) }, () => ({ type: 'adult' }));

  let response;
  try {
    response = await axios.post(
      `${DUFFEL_URL}/air/offer_requests?return_offers=true`,
      {
        data: {
          slices: [{ origin: origin.toUpperCase(), destination: destination.toUpperCase(), departure_date: departureDate }],
          passengers: passengerList,
          cabin_class: cabinClass,
        },
      },
      { headers: duffelHeaders }
    );
  } catch (err: any) {
    const duffelMessage = err.response?.data?.errors?.[0]?.message || err.message;
    throw new AppError(`Erreur recherche vols : ${duffelMessage}`, 502, 'DUFFEL_ERROR');
  }

  const offers: DuffelOffer[] = response.data?.data?.offers || [];
  return offers
    .map(mapDuffelOffer)
    .sort((a, b) => a.price - b.price)
    .slice(0, MAX_OFFERS_RETURNED);
}

export async function getUserTickets(userId: number): Promise<Ticket[]> {
  return ticketRepository.findAllByUser(userId);
}

export async function saveTicket(userId: number, data: {
  flightNumber?: string; airline?: string; origin: string; destination: string;
  departureDate?: string; arrivalDate?: string; price?: number; currency?: string;
}): Promise<Ticket> {
  if (!data.origin || !data.destination) throw new ValidationError('Origine et destination requis');

  const ticket = await ticketRepository.create(userId, data);

  const flightLabel = data.flightNumber ? `${data.flightNumber} ` : '';
  await createNotification(userId, 'success', 'ticket', `Billet ${flightLabel}${data.origin} → ${data.destination} enregistré`);

  return ticket;
}

export async function deleteTicket(userId: number, id: string): Promise<void> {
  await ticketRepository.delete(id, userId);
}

// ─────────────────────────────────────────────────────────────────────────
// Routes HTTP — appellent uniquement les fonctions ci-dessus
// ─────────────────────────────────────────────────────────────────────────

ticketsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await getUserTickets(req.user!.id));
}));

ticketsRouter.post('/search', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { origin, destination, date, passengers, cabinClass } = req.body;
  res.json(await searchFlights(origin, destination, date, passengers, cabinClass));
}));

ticketsRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const ticket = await saveTicket(req.user!.id, req.body);
  res.status(201).json(ticket);
}));

ticketsRouter.patch('/:id/status', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  await ticketRepository.updateStatus(req.params.id, req.user!.id, status);
  res.json({ success: true });
}));

ticketsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await deleteTicket(req.user!.id, req.params.id);
  res.json({ success: true });
}));

