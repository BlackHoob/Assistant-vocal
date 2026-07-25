import {
  getAppointments, getTakenSlots, createAppointment,
  cancelAppointment, joinWaitlist, getMyWaitlistPosition,
} from '../appointments';
import { searchFlights, saveTicket, getUserTickets } from '../tickets';

// Exécute un outil demandé par le modèle. Chaque outil appelle directement
// les fonctions métier de appointments.ts / tickets.ts, avec le userId issu
// du JWT (jamais celui que le modèle pourrait inventer dans ses arguments).
export async function executeVoiceTool(name: string, args: any, userId: number): Promise<unknown> {
  try {
    switch (name) {
      case 'search_flights':          return await searchFlights(args.origin, args.destination, args.date, args.passengers, args.cabinClass);
      case 'book_flight':             return await saveTicket(userId, args);
      case 'list_my_tickets':         return await getUserTickets(userId);
      case 'check_slot_availability': return { takenSlots: await getTakenSlots(args.date) };
      case 'create_appointment':      return await createAppointment(userId, args);
      case 'list_my_appointments':    return await getAppointments(userId);
      case 'cancel_appointment':      return await cancelAppointment(userId, args.id);
      case 'join_waitlist':           return await joinWaitlist(userId, args);
      case 'check_waitlist_position': return await getMyWaitlistPosition(userId, args.date);
      default: return { error: `Fonction inconnue : ${name}` };
    }
  } catch (e: any) {
    // Une erreur métier (créneau pris, champs manquants...) est renvoyée
    // au modèle sous forme de résultat d'outil, pour qu'il l'explique à
    // l'utilisateur au lieu de planter la conversation.
    return { error: e.message || 'Erreur inconnue', code: e.code };
  }
}