// Types partagés côté frontend. Reprend les mêmes noms/formes que le backend
// (types.backend.ts) pour que les données transitent sans surprise entre
// les deux — évite le genre de bug qu'on a eu avec `category` ENUM.

export type TicketStatus = 'upcoming' | 'completed' | 'cancelled';
export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled';
export type NotificationCategory = 'appointment' | 'ticket' | 'document' | 'system';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type DocumentType = 'passport' | 'visa' | 'id_card' | 'insurance' | 'vaccination' | 'other';
export type AdminRole = 'admin' | 'superadmin';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  phone: string | null;
  notifyEmail?: boolean;
  notifyPush?: boolean;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
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
  userName?: string;
}

export interface WaitlistEntry {
  id: number;
  userId: number;
  name: string;
  date: string;
  quantity: number;
  rank: number;
  total: number;
}

export interface SavedTicket {
  id: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  price: number;
  currency: string;
  status: TicketStatus;
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

export interface DocumentItem {
  id: number;
  userId: number;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  expires_at: string | null;
  sent_by_admin: boolean;
  created_at: string;
  userName?: string;
}

export interface NotificationItem {
  id: number;
  userId: number;
  type: NotificationType;
  category: NotificationCategory;
  message: string;
  read: boolean;
  created_at: string;
  userName?: string;
}

export interface AdminListResponse<T> {
  total: number;
}
export interface AdminAppointmentsResponse extends AdminListResponse<Appointment> {
  appointments: Appointment[];
}
export interface AdminTicketsResponse extends AdminListResponse<Ticket> {
  tickets: Ticket[];
}
export interface Ticket extends SavedTicket {
  userId: number;
  userName?: string;
}