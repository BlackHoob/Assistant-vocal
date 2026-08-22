import { pool } from '../config/db';
import { Ticket, TicketStatus } from '../types';

export interface TicketRepository {
  findAllByUser(userId: number): Promise<Ticket[]>;
  findById(id: string): Promise<Ticket | null>;
  create(userId: number, data: {
    flightNumber?: string; airline?: string; origin: string; destination: string;
    departureDate?: string; arrivalDate?: string; price?: number; currency?: string;
  }): Promise<Ticket>;
  updateStatus(id: string, userId: number, status: TicketStatus): Promise<void>;
  delete(id: string, userId: number): Promise<void>;

  // ── Utilisées par admin.ts ──────────────────────────────────────────
  findAdminList(status: string | undefined, limit: number): Promise<Ticket[]>;
  countAdminList(status?: string): Promise<number>;
  deleteById(id: string): Promise<void>;
  findByUser(userId: number | string, limit: number): Promise<Ticket[]>;

  // ── Utilisées par notifications.ts (rappels système) ────────────────
  findUpcomingWithinDays(userId: number, days: number): Promise<{
    flightNumber: string; origin: string; destination: string; departureDate: string;
  }[]>;
}

export class MySqlTicketRepository implements TicketRepository {
  async findAllByUser(userId: number): Promise<Ticket[]> {
    const [rows] = await pool.query(
      'SELECT * FROM tickets WHERE userId = ? ORDER BY departureDate DESC', [userId]
    ) as [Ticket[], unknown];
    return rows;
  }

  async findById(id: string): Promise<Ticket | null> {
    const [rows] = await pool.query('SELECT * FROM tickets WHERE id = ?', [id]) as [Ticket[], unknown];
    return rows[0] ?? null;
  }

  async create(userId: number, data: {
    flightNumber?: string; airline?: string; origin: string; destination: string;
    departureDate?: string; arrivalDate?: string; price?: number; currency?: string;
  }): Promise<Ticket> {
    const [result] = await pool.query(
      `INSERT INTO tickets (userId, flightNumber, airline, origin, destination, departureDate, arrivalDate, price, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, data.flightNumber || '', data.airline || '', data.origin, data.destination,
       data.departureDate || '', data.arrivalDate || '', data.price ? Number(data.price) : 0, data.currency || 'EUR']
    ) as [{ insertId: number }, unknown];
    const created = await this.findById(String(result.insertId));
    return created!;
  }

  async updateStatus(id: string, userId: number, status: TicketStatus): Promise<void> {
    await pool.query('UPDATE tickets SET status = ? WHERE id = ? AND userId = ?', [status, id, userId]);
  }

  async delete(id: string, userId: number): Promise<void> {
    await pool.query('DELETE FROM tickets WHERE id = ? AND userId = ?', [id, userId]);
  }

  async findAdminList(status: string | undefined, limit: number): Promise<Ticket[]> {
    const params: (string | number)[] = [];
    let where = '';
    if (status) { where = 'WHERE t.status = ?'; params.push(status); }
    params.push(limit);

    const [rows] = await pool.query(
      `SELECT t.*, u.name as userName FROM tickets t LEFT JOIN users u ON u.id = t.userId ${where} ORDER BY t.created_at DESC LIMIT ?`,
      params
    ) as [Ticket[], unknown];
    return rows;
  }

  async countAdminList(status?: string): Promise<number> {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM tickets${status ? ' WHERE status = ?' : ''}`,
      status ? [status] : []
    ) as [{ total: number }[], unknown];
    return total;
  }

  async deleteById(id: string): Promise<void> {
    await pool.query('DELETE FROM tickets WHERE id = ?', [id]);
  }

  async findByUser(userId: number | string, limit: number): Promise<Ticket[]> {
    const [rows] = await pool.query(
      'SELECT * FROM tickets WHERE userId = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]
    ) as [Ticket[], unknown];
    return rows;
  }

  async findUpcomingWithinDays(userId: number, days: number) {
    const [rows] = await pool.query(
      `SELECT flightNumber, origin, destination, departureDate FROM tickets
       WHERE userId = ? AND status = 'upcoming'
         AND departureDate BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY departureDate ASC LIMIT 3`,
      [userId, days]
    ) as [{ flightNumber: string; origin: string; destination: string; departureDate: string }[], unknown];
    return rows;
  }
}

