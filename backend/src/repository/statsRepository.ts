import { pool } from '../config/db';
import { DashboardStats } from '../types';

interface MonthlyCount { month: string; count: number }

// Les requêtes de reporting du dashboard sont groupées ici plutôt que
// dispersées dans les repositories métier : ce sont des agrégations
// transversales (plusieurs tables), pas des opérations CRUD sur une
// ressource unique.
export interface StatsRepository {
  countUsers(): Promise<number>;
  countAppointments(): Promise<number>;
  countTickets(): Promise<number>;
  countDocuments(): Promise<number>;
  countUpcomingAppointments(): Promise<number>;
  countUpcomingTickets(): Promise<number>;
  getRecentActivity(): Promise<DashboardStats['recentActivity']>;
  getAppointmentsByMonth(): Promise<MonthlyCount[]>;
  getTicketsByMonth(): Promise<MonthlyCount[]>;
  getNewUsersByMonth(): Promise<MonthlyCount[]>;
  getTopDestinations(): Promise<DashboardStats['topDestinations']>;
  countUsersWithTicket(): Promise<number>;
}

export class MySqlStatsRepository implements StatsRepository {
  async countUsers(): Promise<number> {
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users') as [{ totalUsers: number }[], unknown];
    return totalUsers;
  }

  async countAppointments(): Promise<number> {
    const [[{ totalAppointments }]] = await pool.query('SELECT COUNT(*) as totalAppointments FROM appointments') as [{ totalAppointments: number }[], unknown];
    return totalAppointments;
  }

  async countTickets(): Promise<number> {
    const [[{ totalTickets }]] = await pool.query('SELECT COUNT(*) as totalTickets FROM tickets') as [{ totalTickets: number }[], unknown];
    return totalTickets;
  }

  async countDocuments(): Promise<number> {
    const [[{ totalDocuments }]] = await pool.query('SELECT COUNT(*) as totalDocuments FROM documents') as [{ totalDocuments: number }[], unknown];
    return totalDocuments;
  }

  async countUpcomingAppointments(): Promise<number> {
    const [[{ upcomingAppointments }]] = await pool.query(
      "SELECT COUNT(*) as upcomingAppointments FROM appointments WHERE status='upcoming'"
    ) as [{ upcomingAppointments: number }[], unknown];
    return upcomingAppointments;
  }

  async countUpcomingTickets(): Promise<number> {
    const [[{ upcomingTickets }]] = await pool.query(
      "SELECT COUNT(*) as upcomingTickets FROM tickets WHERE status='upcoming'"
    ) as [{ upcomingTickets: number }[], unknown];
    return upcomingTickets;
  }

  async getRecentActivity(): Promise<DashboardStats['recentActivity']> {
    const [rows] = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count, 'appointment' as type FROM appointments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
      UNION ALL
      SELECT DATE(created_at), COUNT(*), 'ticket' FROM tickets
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at)
      ORDER BY date DESC
    `) as [DashboardStats['recentActivity'], unknown];
    return rows;
  }

  async getAppointmentsByMonth(): Promise<MonthlyCount[]> {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM appointments
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];
    return rows;
  }

  async getTicketsByMonth(): Promise<MonthlyCount[]> {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM tickets
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];
    return rows;
  }

  async getNewUsersByMonth(): Promise<MonthlyCount[]> {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`) as [MonthlyCount[], unknown];
    return rows;
  }

  async getTopDestinations(): Promise<DashboardStats['topDestinations']> {
    const [rows] = await pool.query(`
      SELECT destination, COUNT(*) as count FROM tickets
      WHERE destination IS NOT NULL AND destination != ''
      GROUP BY destination ORDER BY count DESC LIMIT 5`) as [DashboardStats['topDestinations'], unknown];
    return rows;
  }

  async countUsersWithTicket(): Promise<number> {
    const [[{ usersWithTicket }]] = await pool.query(
      'SELECT COUNT(DISTINCT userId) as usersWithTicket FROM tickets'
    ) as [{ usersWithTicket: number }[], unknown];
    return usersWithTicket;
  }
}

