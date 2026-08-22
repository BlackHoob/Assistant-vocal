import { pool } from '../config/db';
import { NotificationRow, NotificationType, NotificationCategory } from '../types';

export interface NotificationRepository {
  create(userId: number, type: NotificationType, category: NotificationCategory, message: string): Promise<void>;
  existsRecent(userId: number, category: NotificationCategory, message: string, hours: number): Promise<boolean>;
  findAllByUser(userId: number, limit: number): Promise<NotificationRow[]>;
  countUnread(userId: number): Promise<number>;
  markAllRead(userId: number): Promise<void>;
  markOneRead(id: string, userId: number): Promise<void>;
  deleteOne(id: string, userId: number): Promise<void>;
  deleteAllByUser(userId: number): Promise<void>;

  findAdminList(limit: number): Promise<NotificationRow[]>;
}

export class MySqlNotificationRepository implements NotificationRepository {
  async create(userId: number, type: NotificationType, category: NotificationCategory, message: string): Promise<void> {
    await pool.query(
      'INSERT INTO notifications (userId, type, category, message) VALUES (?, ?, ?, ?)',
      [userId, type, category, message]
    );
  }

  async existsRecent(userId: number, category: NotificationCategory, message: string, hours: number): Promise<boolean> {
    const [rows] = await pool.query(
      `SELECT id FROM notifications
       WHERE userId = ? AND category = ? AND message = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [userId, category, message, hours]
    ) as [{ id: number }[], unknown];
    return rows.length > 0;
  }

  async findAllByUser(userId: number, limit: number): Promise<NotificationRow[]> {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE userId = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]
    ) as [NotificationRow[], unknown];
    return rows;
  }

  async countUnread(userId: number): Promise<number> {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND is_read = 0', [userId]
    ) as [{ count: number }[], unknown];
    return count;
  }

  async markAllRead(userId: number): Promise<void> {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE userId = ? AND is_read = 0', [userId]);
  }

  async markOneRead(id: string, userId: number): Promise<void> {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND userId = ?', [id, userId]);
  }

  async deleteOne(id: string, userId: number): Promise<void> {
    await pool.query('DELETE FROM notifications WHERE id = ? AND userId = ?', [id, userId]);
  }

  async deleteAllByUser(userId: number): Promise<void> {
    await pool.query('DELETE FROM notifications WHERE userId = ?', [userId]);
  }

  async findAdminList(limit: number): Promise<NotificationRow[]> {
    const [rows] = await pool.query(
      `SELECT n.*, u.name as userName FROM notifications n LEFT JOIN users u ON u.id = n.userId
       ORDER BY n.created_at DESC LIMIT ?`,
      [limit]
    ) as [NotificationRow[], unknown];
    return rows;
  }
}

