import { pool } from '../config/db';
import { Appointment, AppointmentStatus } from '../types';

export interface AppointmentRepository {
  findAllByUser(userId: number): Promise<Appointment[]>;
  findById(id: number | string): Promise<Appointment | null>;
  findByIdAndUser(id: number | string, userId: number): Promise<Appointment | null>;
  findTakenSlots(date: string): Promise<{ dateTime: string }[]>;
  isSlotTaken(dateTime: string, excludeId?: string): Promise<boolean>;
  create(userId: number, data: {
    title: string; description?: string; dateTime: string; agent?: string; quantity?: number;
  }): Promise<Appointment>;
  update(id: string, userId: number, data: {
    title?: string; description?: string; dateTime?: string; location?: string;
    quantity?: number; status?: AppointmentStatus;
  }): Promise<void>;
  updateStatus(id: string, userId: number, status: AppointmentStatus): Promise<void>;
  delete(id: string, userId: number): Promise<void>;

  // ── Utilisées par admin.ts ──────────────────────────────────────────
  findAdminList(filters: { status?: string; from?: string; to?: string; limit: number }): Promise<Appointment[]>;
  countAdminList(filters: { status?: string; from?: string; to?: string }): Promise<number>;
  findByIdWithUserName(id: string): Promise<Appointment | null>;
  updateAdminFields(id: string, data: Partial<Pick<Appointment, 'title' | 'description' | 'dateTime' | 'location' | 'status'>>): Promise<void>;
  deleteById(id: string): Promise<void>;
  setStatusById(id: string, status: AppointmentStatus): Promise<void>;
  findByUser(userId: number | string, limit: number): Promise<Appointment[]>;

  // ── Utilisées par notifications.ts (rappels système) ────────────────
  findUpcomingWithinHours(userId: number, hours: number): Promise<{ title: string; dateTime: string }[]>;
  findUpcomingBetween(userId: number, fromHours: number, toDays: number): Promise<{ title: string; dateTime: string }[]>;
}

export class MySqlAppointmentRepository implements AppointmentRepository {
  async findAllByUser(userId: number): Promise<Appointment[]> {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime ASC', [userId]
    ) as [Appointment[], unknown];
    return rows;
  }

  async findById(id: number | string): Promise<Appointment | null> {
    const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]) as [Appointment[], unknown];
    return rows[0] ?? null;
  }

  async findByIdAndUser(id: number | string, userId: number): Promise<Appointment | null> {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE id = ? AND userId = ?', [id, userId]
    ) as [Appointment[], unknown];
    return rows[0] ?? null;
  }

  async findTakenSlots(date: string): Promise<{ dateTime: string }[]> {
    const [rows] = await pool.query(
      `SELECT dateTime FROM appointments WHERE DATE(dateTime) = ? AND status = 'upcoming'`, [date]
    ) as [{ dateTime: string }[], unknown];
    return rows;
  }

  async isSlotTaken(dateTime: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT id FROM appointments WHERE dateTime = ? AND status = 'upcoming'`;
    const params: string[] = [dateTime];
    if (excludeId) { query += ' AND id != ?'; params.push(excludeId); }

    const [existing] = await pool.query(query, params) as [{ id: number }[], unknown];
    return existing.length > 0;
  }

  async create(userId: number, data: {
    title: string; description?: string; dateTime: string; agent?: string; quantity?: number;
  }): Promise<Appointment> {
    const [result] = await pool.query(
      'INSERT INTO appointments (userId, title, description, dateTime, agent, quantity) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, data.title, data.description || '', data.dateTime, data.agent || '', data.quantity || 1]
    ) as [{ insertId: number }, unknown];
    const created = await this.findById(result.insertId);
    return created!;
  }

  async update(id: string, userId: number, data: {
    title?: string; description?: string; dateTime?: string; location?: string;
    quantity?: number; status?: AppointmentStatus;
  }): Promise<void> {
    await pool.query(
      'UPDATE appointments SET title=?, description=?, dateTime=?, location=?, quantity=?, status=? WHERE id=? AND userId=?',
      [data.title, data.description, data.dateTime, data.location, data.quantity || 1, data.status || 'upcoming', id, userId]
    );
  }

  async updateStatus(id: string, userId: number, status: AppointmentStatus): Promise<void> {
    await pool.query(
      'UPDATE appointments SET status = ? WHERE id = ? AND userId = ?', [status, id, userId]
    );
  }

  async delete(id: string, userId: number): Promise<void> {
    await pool.query('DELETE FROM appointments WHERE id = ? AND userId = ?', [id, userId]);
  }

  async findAdminList(filters: { status?: string; from?: string; to?: string; limit: number }): Promise<Appointment[]> {
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (filters.status) { conditions.push('a.status = ?'); params.push(filters.status); }
    if (filters.from)   { conditions.push('a.dateTime >= ?'); params.push(filters.from); }
    if (filters.to)     { conditions.push('a.dateTime <= ?'); params.push(filters.to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filters.limit);

    const [rows] = await pool.query(
      `SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId ${where} ORDER BY a.dateTime ASC LIMIT ?`,
      params
    ) as [Appointment[], unknown];
    return rows;
  }

  async countAdminList(filters: { status?: string; from?: string; to?: string }): Promise<number> {
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (filters.status) { conditions.push('a.status = ?'); params.push(filters.status); }
    if (filters.from)   { conditions.push('a.dateTime >= ?'); params.push(filters.from); }
    if (filters.to)     { conditions.push('a.dateTime <= ?'); params.push(filters.to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a ${where}`, params
    ) as [{ total: number }[], unknown];
    return total;
  }

  async findByIdWithUserName(id: string): Promise<Appointment | null> {
    const [rows] = await pool.query(
      'SELECT a.*, u.name as userName FROM appointments a LEFT JOIN users u ON u.id = a.userId WHERE a.id = ?',
      [id]
    ) as [Appointment[], unknown];
    return rows[0] ?? null;
  }

  async updateAdminFields(id: string, data: Partial<Pick<Appointment, 'title' | 'description' | 'dateTime' | 'location' | 'status'>>): Promise<void> {
    const fields = Object.keys(data);
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await pool.query(`UPDATE appointments SET ${setClause} WHERE id = ?`, [...Object.values(data), id]);
  }

  async deleteById(id: string): Promise<void> {
    await pool.query('DELETE FROM appointments WHERE id = ?', [id]);
  }

  async setStatusById(id: string, status: AppointmentStatus): Promise<void> {
    await pool.query('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
  }

  async findByUser(userId: number | string, limit: number): Promise<Appointment[]> {
    const [rows] = await pool.query(
      'SELECT * FROM appointments WHERE userId = ? ORDER BY dateTime DESC LIMIT ?', [userId, limit]
    ) as [Appointment[], unknown];
    return rows;
  }

  async findUpcomingWithinHours(userId: number, hours: number) {
    const [rows] = await pool.query(
      `SELECT title, dateTime FROM appointments
       WHERE userId = ? AND status = 'upcoming'
         AND dateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
       ORDER BY dateTime ASC LIMIT 5`,
      [userId, hours]
    ) as [{ title: string; dateTime: string }[], unknown];
    return rows;
  }

  async findUpcomingBetween(userId: number, fromHours: number, toDays: number) {
    const [rows] = await pool.query(
      `SELECT title, dateTime FROM appointments
       WHERE userId = ? AND status = 'upcoming'
         AND dateTime BETWEEN DATE_ADD(NOW(), INTERVAL ? HOUR) AND DATE_ADD(NOW(), INTERVAL ? DAY)
       ORDER BY dateTime ASC LIMIT 3`,
      [userId, fromHours, toDays]
    ) as [{ title: string; dateTime: string }[], unknown];
    return rows;
  }
}

