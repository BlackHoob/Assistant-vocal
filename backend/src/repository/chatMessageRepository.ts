import { pool } from '../config/db';
import { ChatMessage } from '../types';

export interface ChatMessageRepository {
  findAll(userId: number | undefined, limit: number): Promise<ChatMessage[]>;
  create(userId: number, role: 'user' | 'assistant', content: string): Promise<void>;
  countTotal(): Promise<number>;
  countDistinctUsers(): Promise<number>;
  countAssistantToday(): Promise<number>;
}

export class MySqlChatMessageRepository implements ChatMessageRepository {
  async findAll(userId: number | undefined, limit: number): Promise<ChatMessage[]> {
    const params: (string | number)[] = [];
    let where = '';
    if (userId) { where = 'WHERE c.userId = ?'; params.push(userId); }
    params.push(limit);

    const [rows] = await pool.query(
      `SELECT c.*, u.name as userName FROM chat_messages c LEFT JOIN users u ON u.id = c.userId
       ${where} ORDER BY c.created_at DESC LIMIT ?`,
      params
    ) as [ChatMessage[], unknown];
    return rows;
  }

  async create(userId: number, role: 'user' | 'assistant', content: string): Promise<void> {
    await pool.query(
      'INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)', [userId, role, content]
    );
  }

  async countTotal(): Promise<number> {
    const [[{ totalIAMessages }]] = await pool.query('SELECT COUNT(*) as totalIAMessages FROM chat_messages') as [{ totalIAMessages: number }[], unknown];
    return totalIAMessages;
  }

  async countDistinctUsers(): Promise<number> {
    const [[{ totalIAUsers }]] = await pool.query('SELECT COUNT(DISTINCT userId) as totalIAUsers FROM chat_messages') as [{ totalIAUsers: number }[], unknown];
    return totalIAUsers;
  }

  async countAssistantToday(): Promise<number> {
    const [[{ iaConversationsToday }]] = await pool.query(
      "SELECT COUNT(*) as iaConversationsToday FROM chat_messages WHERE role='assistant' AND DATE(created_at) = CURDATE()"
    ) as [{ iaConversationsToday: number }[], unknown];
    return iaConversationsToday;
  }
}

