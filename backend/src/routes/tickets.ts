import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export const ticketsRouter = Router();
ticketsRouter.use(authGuard);

const AVIATIONSTACK_KEY = process.env.AVIATIONSTACK_KEY || '';
const AVIATIONSTACK_URL = 'https://api.aviationstack.com/v1';

// Données de démo quand l'API ne retourne rien (plan gratuit limité)
function generateMockFlights(flightNumber: string, date?: string) {
  const today = date || new Date().toISOString().split('T')[0];
  const prefix = flightNumber.slice(0, 2).toUpperCase();

  const airlines: Record<string, string> = {
    AF: 'Air France', TU: 'Tunisair', LH: 'Lufthansa',
    BA: 'British Airways', IB: 'Iberia', AT: 'Royal Air Maroc',
    AH: 'Air Algérie', EK: 'Emirates', TK: 'Turkish Airlines',
  };

  const routes: Record<string, [string, string]> = {
    AF: ['CDG', 'JFK'], TU: ['TUN', 'CDG'], LH: ['FRA', 'JFK'],
    BA: ['LHR', 'CDG'], AT: ['CMN', 'CDG'], AH: ['ALG', 'CDG'],
    EK: ['DXB', 'LHR'], TK: ['IST', 'CDG'],
  };

  const [origin, destination] = routes[prefix] || ['CDG', 'ABJ'];
  const airline = airlines[prefix] || 'Unknown Airline';

  return [
    {
      flightNumber,
      airline,
      origin,
      destination,
      departureDate: `${today}T08:30:00+00:00`,
      arrivalDate:   `${today}T12:45:00+00:00`,
      status:        'scheduled',
      terminal:      '2E',
      gate:          'K22',
      delay:         0,
      _demo:         true,
    },
    {
      flightNumber: flightNumber + 'R',
      airline,
      origin:        destination,
      destination:   origin,
      departureDate: `${today}T14:00:00+00:00`,
      arrivalDate:   `${today}T18:20:00+00:00`,
      status:        'scheduled',
      terminal:      '1',
      gate:          'B14',
      delay:         15,
      _demo:         true,
    },
  ];
}


ticketsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tickets WHERE userId = ? ORDER BY departureDate DESC',
      [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// POST /api/tickets/search — recherche par numéro de vol (plan gratuit Aviationstack)
ticketsRouter.post('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { flightNumber, date } = req.body;
    if (!flightNumber) {
      return res.status(400).json({ message: 'Numéro de vol requis (ex: AF447, LH100)' });
    }

    const params: any = {
      access_key: AVIATIONSTACK_KEY,
      flight_iata: flightNumber.toUpperCase(),
      limit: 10,
    };

    if (date) params.flight_date = date;

    const response = await axios.get(`${AVIATIONSTACK_URL}/flights`, { params });
    const flights = response.data?.data || [];

    // Si l'API ne retourne rien (plan gratuit limité), on retourne des données de démo
    if (!flights.length) {
      const mockFlights = generateMockFlights(flightNumber.toUpperCase(), date);
      return res.json(mockFlights);
    }

    const results = flights.map((f: any) => ({
      flightNumber:  f.flight?.iata || f.flight?.icao || '',
      airline:       f.airline?.name || '',
      origin:        f.departure?.iata || '',
      destination:   f.arrival?.iata || '',
      departureDate: f.departure?.scheduled || '',
      arrivalDate:   f.arrival?.scheduled || '',
      status:        f.flight_status || 'scheduled',
      terminal:      f.departure?.terminal || '',
      gate:          f.departure?.gate || '',
      delay:         f.departure?.delay || 0,
    }));

    res.json(results);
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    res.status(500).json({ message: `Erreur recherche vols : ${msg}` });
  }
});

// POST /api/tickets — sauvegarder un billet
ticketsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency } = req.body;
    if (!origin || !destination) return res.status(400).json({ message: 'Origine et destination requis' });

    const [result]: any = await pool.query(
      `INSERT INTO tickets (userId, flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, flightNumber || '', airline || '', origin, destination,
       departureDate || '', arrivalDate || '', price ? parseFloat(price) : 0, currency || 'EUR']
    );
    const [rows]: any = await pool.query('SELECT * FROM tickets WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
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
  try {
    await pool.query('DELETE FROM tickets WHERE id = ? AND userId = ?',
      [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});