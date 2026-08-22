import { pool } from '../config/db';
import { DocumentRow } from '../types';

export interface DocumentRepository {
  findAllByUser(userId: number): Promise<DocumentRow[]>;
  findById(id: number | string, userId: number): Promise<DocumentRow | null>;
  create(data: {
    userId: number; name: string; filePath: string;
    fileSize: number; mimeType: string; expiresAt: string | null;
  }): Promise<DocumentRow>;
  delete(id: number | string): Promise<void>;

  findAdminList(userId: string | undefined, limit: number): Promise<DocumentRow[]>;
  findByUser(userId: number | string): Promise<DocumentRow[]>;
  
  findByIdAdmin(id: string): Promise<DocumentRow | null>;
  createByAdmin(data: {
    userId: number; name: string; filePath: string;
    fileSize: number; mimeType: string; expiresAt: string | null;
  }): Promise<DocumentRow>;
  deleteById(id: string): Promise<void>;


  findExpiringWithinDays(userId: number, days: number): Promise<{ name: string; expires_at: string }[]>;
  findExpired(userId: number): Promise<{ name: string }[]>;

  findAllExpired(): Promise<DocumentRow[]>;
}

export class MySqlDocumentRepository implements DocumentRepository {
  async findAllByUser(userId: number): Promise<DocumentRow[]> {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [userId]
    ) as [DocumentRow[], unknown];
    return rows;
  }

  async findById(id: number | string, userId: number): Promise<DocumentRow | null> {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE id = ? AND userId = ?', [id, userId]
    ) as [DocumentRow[], unknown];
    return rows[0] ?? null;
  }

  async create(data: {
    userId: number; name: string; filePath: string;
    fileSize: number; mimeType: string; expiresAt: string | null;
  }): Promise<DocumentRow> {
    const [result] = await pool.query(
      'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.name, data.filePath, data.fileSize, data.mimeType, data.expiresAt]
    ) as [{ insertId: number }, unknown];
    const created = await this.findById(result.insertId, data.userId);
    return created!;
  }

  async delete(id: number | string): Promise<void> {
    await pool.query('DELETE FROM documents WHERE id = ?', [id]);
  }

  async findAdminList(userId: string | undefined, limit: number): Promise<DocumentRow[]> {
    const params: (string | number)[] = [];
    let where = '';
    if (userId) { where = 'WHERE d.userId = ?'; params.push(userId); }
    params.push(limit);

    const [rows] = await pool.query(
      `SELECT d.*, u.name as userName FROM documents d LEFT JOIN users u ON u.id = d.userId ${where} ORDER BY d.created_at DESC LIMIT ?`,
      params
    ) as [DocumentRow[], unknown];
    return rows;
  }

  async findByUser(userId: number | string): Promise<DocumentRow[]> {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE userId = ? ORDER BY created_at DESC', [userId]
    ) as [DocumentRow[], unknown];
    return rows;
  }

  async findByIdAdmin(id: string): Promise<DocumentRow | null> {
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [id]) as [DocumentRow[], unknown];
    return rows[0] ?? null;
  }

  async createByAdmin(data: {
    userId: number; name: string; filePath: string;
    fileSize: number; mimeType: string; expiresAt: string | null;
  }): Promise<DocumentRow> {
    const [result] = await pool.query(
      'INSERT INTO documents (userId, name, file_path, file_size, mime_type, expires_at, sent_by_admin) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [data.userId, data.name, data.filePath, data.fileSize, data.mimeType, data.expiresAt]
    ) as [{ insertId: number }, unknown];
    const created = await this.findById(result.insertId, data.userId);
    return created!;
  }

  async deleteById(id: string): Promise<void> {
    await pool.query('DELETE FROM documents WHERE id = ?', [id]);
  }

  async findExpiringWithinDays(userId: number, days: number) {
    const [rows] = await pool.query(
      `SELECT name, expires_at FROM documents
       WHERE userId = ? AND expires_at IS NOT NULL
         AND expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ORDER BY expires_at ASC LIMIT 5`,
      [userId, days]
    ) as [{ name: string; expires_at: string }[], unknown];
    return rows;
  }

  async findExpired(userId: number) {
    const [rows] = await pool.query(
      `SELECT name FROM documents
       WHERE userId = ? AND expires_at IS NOT NULL AND expires_at < CURDATE()
       ORDER BY expires_at DESC LIMIT 3`,
      [userId]
    ) as [{ name: string }[], unknown];
    return rows;
  }

  async findAllExpired(): Promise<DocumentRow[]> {
    const [rows] = await pool.query(
      'SELECT * FROM documents WHERE expires_at IS NOT NULL AND expires_at < CURDATE()'
    ) as [DocumentRow[], unknown];
    return rows;
  }
}
