import { pool } from '../config/db';
import { Admin, AdminRole } from '../types';

export interface AdminRepository {
  findByUsernameOrEmail(usernameOrEmail: string): Promise<Admin | null>;
  findById(id: number): Promise<Admin | null>;
  updateLastLogin(id: number): Promise<void>;
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
  findAll(): Promise<Admin[]>;
  create(data: { username: string; email: string; passwordHash: string; role: AdminRole }): Promise<{ id: number }>;
  deleteById(id: number | string): Promise<void>;
}

export class MySqlAdminRepository implements AdminRepository {
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<Admin | null> {
    const [rows] = await pool.query(
      'SELECT * FROM admins WHERE username = ? OR email = ?',
      [usernameOrEmail, usernameOrEmail]
    ) as [Admin[], unknown];
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<Admin | null> {
    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [id]) as [Admin[], unknown];
    return rows[0] ?? null;
  }

  async updateLastLogin(id: number): Promise<void> {
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = ?', [id]).catch(() => {});
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  async findAll(): Promise<Admin[]> {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, created_at FROM admins ORDER BY created_at DESC'
    ) as [Admin[], unknown];
    return rows;
  }

  async create(data: { username: string; email: string; passwordHash: string; role: AdminRole }): Promise<{ id: number }> {
    const [result] = await pool.query(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [data.username, data.email, data.passwordHash, data.role]
    ) as [{ insertId: number }, unknown];
    return { id: result.insertId };
  }

  async deleteById(id: number | string): Promise<void> {
    await pool.query('DELETE FROM admins WHERE id = ?', [id]);
  }
}
