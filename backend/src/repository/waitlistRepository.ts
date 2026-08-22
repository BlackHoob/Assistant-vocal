import { pool } from '../config/db';
import { WaitlistEntry } from '../types';

export interface WaitlistRepository {
  findByDate(date: string): Promise<WaitlistEntry[]>;
  findByRange(from: string, to: string): Promise<WaitlistEntry[]>;
  findAll(): Promise<WaitlistEntry[]>;
  findByUserAndDate(userId: number, date: string): Promise<WaitlistEntry | null>;
  create(userId: number, name: string, date: string, quantity: number): Promise<WaitlistEntry>;
  countUpToId(date: string, entryId: number): Promise<number>;
  countByDate(date: string): Promise<number>;
  delete(id: string): Promise<void>;
  deleteByUser(id: string, userId: number): Promise<void>;
}

export class MySqlWaitlistRepository implements WaitlistRepository {
  async findByDate(date: string): Promise<WaitlistEntry[]> {
    const [rows] = await pool.query(
      'SELECT id, userId, name, date, quantity, created_at FROM waitlist WHERE date = ? ORDER BY date ASC, created_at ASC',
      [date]
    ) as [WaitlistEntry[], unknown];
    return rows;
  }

  async findByRange(from: string, to: string): Promise<WaitlistEntry[]> {
    const [rows] = await pool.query(
      'SELECT id, userId, name, date, quantity, created_at FROM waitlist WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC',
      [from, to]
    ) as [WaitlistEntry[], unknown];
    return rows;
  }

  async findAll(): Promise<WaitlistEntry[]> {
    const [rows] = await pool.query(
      'SELECT id, userId, name, date, quantity, created_at FROM waitlist ORDER BY date ASC, created_at ASC'
    ) as [WaitlistEntry[], unknown];
    return rows;
  }

  async findByUserAndDate(userId: number, date: string): Promise<WaitlistEntry | null> {
    const [rows] = await pool.query(
      'SELECT * FROM waitlist WHERE userId = ? AND date = ?', [userId, date]
    ) as [WaitlistEntry[], unknown];
    return rows[0] ?? null;
  }

  async create(userId: number, name: string, date: string, quantity: number): Promise<WaitlistEntry> {
    const [result] = await pool.query(
      'INSERT INTO waitlist (userId, name, date, quantity) VALUES (?, ?, ?, ?)',
      [userId, name, date, quantity]
    ) as [{ insertId: number }, unknown];
    const [rows] = await pool.query('SELECT * FROM waitlist WHERE id = ?', [result.insertId]) as [WaitlistEntry[], unknown];
    return rows[0];
  }

  async countUpToId(date: string, entryId: number): Promise<number> {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as \`rank\` FROM waitlist WHERE date = ? AND id <= ?`, [date, entryId]
    ) as [{ rank: number }[], unknown];
    return rows[0].rank;
  }

  async countByDate(date: string): Promise<number> {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as total FROM waitlist WHERE date = ?', [date]
    ) as [{ total: number }[], unknown];
    return rows[0].total;
  }

  async delete(id: string): Promise<void> {
    await pool.query('DELETE FROM waitlist WHERE id = ?', [id]);
  }

  async deleteByUser(id: string, userId: number): Promise<void> {
    await pool.query('DELETE FROM waitlist WHERE id = ? AND userId = ?', [id, userId]);
  }
}
