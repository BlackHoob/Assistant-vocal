import { Router, Response } from 'express';
import { authGuard, AuthRequest } from '../middleware/authGuard';
import { pool } from '../config/db';
import dotenv from 'dotenv';
dotenv.config();

export const ticketsRouter = Router();
ticketsRouter.use(authGuard);

let amadeusClient: any = null;
const getAmadeus = () => {
  if (!amadeusClient && process.env.AMADEUS_CLIENT_ID &&
      process.env.AMADEUS_CLIENT_ID !== 'your_amadeus_client_id') {
    const Amadeus = require('amadeus');
    amadeusClient = new Amadeus({
      clientId: process.env.AMADEUS_CLIENT_ID,
      clientSecret: process.env.AMADEUS_CLIENT_SECRET,
    });
  }
  return amadeusClient;
};

ticketsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM tickets WHERE userId = ? ORDER BY departureDate DESC', [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

ticketsRouter.post('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { origin, destination, date, adults = 1 } = req.body;
    const amadeus = getAmadeus();
    if (!amadeus) return res.status(503).json({ message: 'Amadeus non configuré' });
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: origin.toUpperCase(),
      destinationLocationCode: destination.toUpperCase(),
      departureDate: date, adults: parseInt(adults), max: 10, currencyCode: 'EUR',
    });
    res.json(response.data);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

ticketsRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency, amadeusOfferId } = req.body;
    const [result]: any = await pool.query(
      `INSERT INTO tickets (userId, flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency, amadeusOfferId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, flightNumber || '', airline || '', origin, destination,
       departureDate || '', arrivalDate || '', price ? parseFloat(price) : 0,
       currency || 'EUR', amadeusOfferId || '']
    );
    const [rows]: any = await pool.query('SELECT * FROM tickets WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

ticketsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM tickets WHERE id = ? AND userId = ?', [req.params.id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});