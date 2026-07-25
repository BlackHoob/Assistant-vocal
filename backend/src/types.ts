// Types partagés côté backend — reflètent les colonnes réelles des tables
// (vérifiées au fil des bugs : blocked, sent_by_admin, category ENUM...).
// Objectif : une seule source de vérité au lieu de `any` dispersé partout.

export type TicketStatus = 'upcoming' | 'completed' | 'cancelled';
export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled';
export type NotificationCategory = 'appointment' | 'ticket' | 'document' | 'system';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type DocumentType = 'passport' | 'visa' | 'id_card' | 'insurance' | 'vaccination' | 'other';
export type AdminRole = 'admin' | 'superadmin';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  password_hash: string | null;
  blocked: boolean;
  notifyEmail: boolean;
  notifyPush: boolean;
  reset_token: string | null;
  reset_token_expires: Date | null;
  created_at: string;
}

// Vue "sûre" d'un utilisateur, sans champs sensibles — ce que les routes
// doivent renvoyer au client (jamais password_hash, reset_token...).
export type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'avatar' | 'phone'>;

export interface Admin {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  created_at: string;
}

export interface Appointment {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  dateTime: string;
  location: string | null;
  quantity: number;
  agent: string | null;
  status: AppointmentStatus;
  created_at: string;
  userName?: string; // ajouté par le JOIN dans les routes admin
}

export interface WaitlistEntry {
  id: number;
  userId: number;
  name: string;
  date: string;
  quantity: number;
  created_at: string;
  rank?: number;   // calculé côté serveur, pas stocké en base
  total?: number;  // idem
}

export interface Ticket {
  id: number;
  userId: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  price: number;
  currency: string;
  status: TicketStatus;
  created_at: string;
  userName?: string;
}

export interface DocumentRow {
  id: number;
  userId: number;
  name: string; // type de document, ex: "passport", ou "[passport] fichier.pdf" si envoyé par le client
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  expires_at: string | null;
  sent_by_admin: boolean;
  created_at: string;
  userName?: string;
}

export interface NotificationRow {
  id: number;
  userId: number;
  type: NotificationType;
  category: NotificationCategory;
  message: string;
  read: boolean;
  created_at: string;
  userName?: string;
}

export interface ChatMessage {
  id: number;
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  userName?: string;
}

export interface FlightOffer {
  id: string;
  airline: string;
  airlineLogo: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  duration: string;
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
  expiresAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalAppointments: number;
  totalTickets: number;
  totalDocuments: number;
  upcomingAppointments: number;
  upcomingTickets: number;
  recentActivity: { date: string; count: number; type: 'appointment' | 'ticket' }[];
  bookingsByMonth: { month: string; appointments: number; tickets: number }[];
  newUsersByMonth: { month: string; count: number }[];
  topDestinations: { destination: string; count: number }[];
  ia: {
    totalMessages: number;
    totalUsers: number;
    conversationsToday: number;
    conversionRate: number;
  };
}
