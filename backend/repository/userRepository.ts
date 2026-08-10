// Toutes les routes appellent directement `pool.query(...)` (mysql2) —
// couplage fort avec MySQL. Ce fichier montre le pattern à généraliser :
// une interface Repository indépendante du moteur de BDD, avec une
// implémentation MySQL derrière. Remplacer MySQL par une autre BDD (ou
// mocker en test) ne demanderait alors de changer que l'implémentation,
// jamais le code appelant (routes, fonctions métier).
//
// Démonstration sur User (le plus utilisé) — à répliquer pour
// Appointment/Ticket/Document si on généralise l'approche à tout le projet.
import { pool } from '../../backend/src/config/db';
import { User } from '../../backend/src/types';

// ─── Contrat, indépendant du moteur de stockage ────────────────────────────
export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: { name: string; email: string; passwordHash: string }): Promise<User>;
  update(id: number, data: Partial<Pick<User, 'name' | 'phone' | 'email' | 'avatar'>>): Promise<void>;
  setBlocked(id: number, blocked: boolean): Promise<void>;
  delete(id: number): Promise<void>;
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

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [data.name, data.email, data.passwordHash]
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

  async setBlocked(id: number, blocked: boolean): Promise<void> {
    await pool.query('UPDATE users SET blocked = ? WHERE id = ?', [blocked ? 1 : 0, id]);
  }

  async delete(id: number): Promise<void> {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }
}

// ─── Exemple d'implémentation alternative (test / mémoire) ─────────────────
// Prouve concrètement l'indépendance : ce Repository respecte le même
// contrat sans base de données du tout — utile en test unitaire, ou comme
// point de départ pour n'importe quel autre moteur de stockage.
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];
  private nextId = 1;

  async findById(id: number): Promise<User | null> {
    return this.users.find(u => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email === email) ?? null;
  }

  async create(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const user = {
      id: this.nextId++,
      name: data.name,
      email: data.email,
      password_hash: data.passwordHash,
      phone: null, avatar: null, blocked: false,
      notifyEmail: true, notifyPush: true,
      reset_token: null, reset_token_expires: null,
      created_at: new Date().toISOString(),
    } as User;
    this.users.push(user);
    return user;
  }

  async update(id: number, data: Partial<User>): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) Object.assign(user, data);
  }

  async setBlocked(id: number, blocked: boolean): Promise<void> {
    const user = this.users.find(u => u.id === id);
    if (user) user.blocked = blocked;
  }

  async delete(id: number): Promise<void> {
    this.users = this.users.filter(u => u.id !== id);
  }
}
