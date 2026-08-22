import { pool } from '../config/db';
import { User } from '../types';

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleIdOrEmail(googleId: string, email: string): Promise<User | null>;
  findByResetToken(token: string): Promise<User | null>;
  create(data: { name: string; email: string; passwordHash?: string; googleId?: string }): Promise<User>;
  update(id: number, data: Partial<Pick<User, 'name' | 'phone' | 'email' | 'avatar'>>): Promise<void>;
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
  resetPasswordWithToken(id: number, passwordHash: string): Promise<void>;
  setGoogleId(id: number, googleId: string): Promise<void>;
  setResetToken(id: number, token: string, expires: Date): Promise<void>;
  clearResetToken(id: number): Promise<void>;
  setBlocked(id: number | string, blocked: boolean): Promise<void>;
  delete(id: number): Promise<void>;
  findAdminList(search: string, limit: number, offset: number): Promise<(User & { appointmentCount: number; ticketCount: number })[]>;
  countBySearch(search: string): Promise<number>;
  findAdminById(id: number | string): Promise<Pick<User, 'id' | 'name' | 'email' | 'avatar' | 'phone' | 'blocked' | 'created_at'> | null>;
  updateAdminFields(id: number | string, data: Partial<Pick<User, 'name' | 'phone' | 'email'>>): Promise<void>;
  deleteById(id: number | string): Promise<void>;
  findAllIds(): Promise<number[]>;
}

// ─── Implémentation MySQL ───────────────────────────────────────────────────

export class MySqlUserRepository implements UserRepository {
  async findById(id: number): Promise<User | null> {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]) as [User[], unknown];
    return rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as [User[], unknown];
    return rows[0] ?? null;
  }

  async findByGoogleIdOrEmail(googleId: string, email: string): Promise<User | null> {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE google_id = ? OR email = ?', [googleId, email]
    ) as [User[], unknown];
    return rows[0] ?? null;
  }

  async findByResetToken(token: string): Promise<User | null> {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]
    ) as [User[], unknown];
    return rows[0] ?? null;
  }

  async create(data: { name: string; email: string; passwordHash?: string; googleId?: string }): Promise<User> {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, google_id) VALUES (?, ?, ?, ?)',
      [data.name, data.email, data.passwordHash || null, data.googleId || null]
    ) as [{ insertId: number }, unknown];
    const created = await this.findById(result.insertId);
    return created!;
  }

  async update(id: number, data: Partial<Pick<User, 'name' | 'phone' | 'email' | 'avatar'>>): Promise<void> {
    const fields = Object.keys(data);
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(data), id]);
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  async resetPasswordWithToken(id: number, passwordHash: string): Promise<void> {
    await pool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [passwordHash, id]
    );
  }

  async setGoogleId(id: number, googleId: string): Promise<void> {
    await pool.query('UPDATE users SET google_id = ? WHERE id = ?', [googleId, id]);
  }

  async setResetToken(id: number, token: string, expires: Date): Promise<void> {
    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expires, id]
    );
  }

  async clearResetToken(id: number): Promise<void> {
    await pool.query(
      'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [id]
    );
  }

  async setBlocked(id: number | string, blocked: boolean): Promise<void> {
    await pool.query('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, id]);
  }

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }

  async findAdminList(search: string, limit: number, offset: number) {
    const like = `%${search}%`;
    const [rows] = await pool.query(
      `SELECT u.*, COUNT(DISTINCT a.id) as appointmentCount, COUNT(DISTINCT t.id) as ticketCount
       FROM users u LEFT JOIN appointments a ON a.userId = u.id LEFT JOIN tickets t ON t.userId = u.id
       WHERE u.name LIKE ? OR u.email LIKE ?
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [like, like, limit, offset]
    ) as [(User & { appointmentCount: number; ticketCount: number })[], unknown];
    return rows;
  }

  async countBySearch(search: string): Promise<number> {
    const like = `%${search}%`;
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE name LIKE ? OR email LIKE ?', [like, like]
    ) as [{ total: number }[], unknown];
    return total;
  }

  async findAdminById(id: number | string) {
    const [rows] = await pool.query(
      'SELECT id, name, email, avatar, phone, blocked, created_at FROM users WHERE id = ?', [id]
    ) as [any[], unknown];
    return rows[0] ?? null;
  }

  async updateAdminFields(id: number | string, data: Partial<Pick<User, 'name' | 'phone' | 'email'>>): Promise<void> {
    const fields = Object.keys(data);
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...Object.values(data), id]);
  }

  async deleteById(id: number | string): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }

  async findAllIds(): Promise<number[]> {
    const [rows] = await pool.query('SELECT id FROM users') as [{ id: number }[], unknown];
    return rows.map(r => r.id);
  }
}

// ─── Implémentation alternative (test / mémoire) ────────────────────────
// Respecte le même contrat sans base de données — utile en test unitaire.
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
    return this.users.find(u => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) ?? null;
  }

  async findByGoogleIdOrEmail(googleId: string, email: string): Promise<User | null> {
    return this.users.find(u => (u as any).google_id === googleId || u.email === email) ?? null;
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.users.find(u => u.reset_token === token) ?? null;
  }

  async create(data: { name: string; email: string; passwordHash?: string; googleId?: string }): Promise<User> {
    const user = {
      id: this.nextId++,
      name: data.name,
      email: data.email,
      password_hash: data.passwordHash ?? null,
      phone: null, avatar: null, blocked: false,
      notifyEmail: true, notifyPush: true,
      reset_token: null, reset_token_expires: null,
      created_at: new Date().toISOString(),
      ...(data.googleId ? { google_id: data.googleId } as any : {}),
    } as User;
    this.users.push(user);
    return user;
  }

  async update(id: number, data: Partial<User>): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) Object.assign(user, data);
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) user.password_hash = passwordHash;
  }

  async resetPasswordWithToken(id: number, passwordHash: string): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) { user.password_hash = passwordHash; user.reset_token = null; user.reset_token_expires = null; }
  }

  async setGoogleId(id: number, googleId: string): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) (user as any).google_id = googleId;
  }

  async setResetToken(id: number, token: string, expires: Date): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) { user.reset_token = token; user.reset_token_expires = expires; }
  }

  async clearResetToken(id: number): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) { user.reset_token = null; user.reset_token_expires = null; }
  }

  async setBlocked(id: number | string, blocked: boolean): Promise<void> {
    const user = this.users.find(u => u.id === Number(id));
    if (user) user.blocked = blocked;
  }

  async delete(id: number): Promise<void> {
    this.users = this.users.filter(u => u.id !== id);
  }

  async findAdminList(search: string, limit: number, offset: number) {
    const filtered = this.users.filter(u => u.name.includes(search) || u.email.includes(search));
    return filtered.slice(offset, offset + limit).map(u => ({ ...u, appointmentCount: 0, ticketCount: 0 }));
  }

  async countBySearch(search: string): Promise<number> {
    return this.users.filter(u => u.name.includes(search) || u.email.includes(search)).length;
  }

  async findAdminById(id: number | string) {
    const user = this.users.find(u => u.id === Number(id));
    if (!user) return null;
    const { id: uid, name, email, avatar, phone, blocked, created_at } = user;
    return { id: uid, name, email, avatar, phone, blocked, created_at };
  }

  async updateAdminFields(id: number | string, data: Partial<Pick<User, 'name' | 'phone' | 'email'>>): Promise<void> {
    const user = this.users.find(u => u.id === Number(id));
    if (user) Object.assign(user, data);
  }

  async deleteById(id: number | string): Promise<void> {
    this.users = this.users.filter(u => u.id !== Number(id));
  }

  async findAllIds(): Promise<number[]> {
    return this.users.map(u => u.id);
  }
}
