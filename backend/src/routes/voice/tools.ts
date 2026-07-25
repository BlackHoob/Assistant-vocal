// Catalogue des outils exposés au modèle (function calling Groq). Extrait de
// voice.ts pour la même raison que prompts.ts : un fichier, une responsabilité.
export const voiceTools: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_flights',
      description: "Recherche des vols par origine, destination et date de départ, avec les prix réels. À utiliser avant toute proposition de réservation.",
      parameters: {
        type: 'object',
        properties: {
          origin: { type: 'string', description: "Code IATA de l'aéroport ou ville de départ, ex: CDG" },
          destination: { type: 'string', description: "Code IATA de l'aéroport ou ville d'arrivée, ex: JFK" },
          date: { type: 'string', description: 'Date de départ au format YYYY-MM-DD' },
          passengers: { type: 'number', description: 'Nombre de passagers adultes, par défaut 1' },
          cabinClass: { type: 'string', description: "Classe de voyage : economy, premium_economy, business ou first (par défaut economy)" },
        },
        required: ['origin', 'destination', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_flight',
      description: "Enregistre définitivement une offre de vol (trouvée via search_flights, avec son prix réel) dans les billets de l'utilisateur. N'appelle cette fonction qu'après confirmation explicite de l'utilisateur.",
      parameters: {
        type: 'object',
        properties: {
          flightNumber: { type: 'string' },
          airline: { type: 'string' },
          origin: { type: 'string' },
          destination: { type: 'string' },
          departureDate: { type: 'string' },
          arrivalDate: { type: 'string' },
          price: { type: 'number', description: 'Prix de l\'offre renvoyé par search_flights' },
          currency: { type: 'string', description: "Devise du prix, ex: EUR" },
        },
        required: ['origin', 'destination'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_tickets',
      description: "Liste les billets de vol déjà enregistrés par l'utilisateur.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_slot_availability',
      description: "Vérifie les créneaux horaires déjà pris pour une date donnée. À utiliser systématiquement avant create_appointment.",
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'Date au format YYYY-MM-DD' } },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: "Prend un rendez-vous pour l'utilisateur. N'appelle cette fonction qu'après confirmation explicite du créneau par l'utilisateur.",
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Objet du rendez-vous, ex: Consultation, Prendre un billet' },
          description: { type: 'string' },
          dateTime: { type: 'string', description: 'Date et heure ISO, ex: 2026-07-15T14:00:00' },
          quantity: { type: 'number', description: 'Nombre de personnes, par défaut 1' },
          agent: { type: 'string', description: 'Agent souhaité (optionnel)' },
        },
        required: ['title', 'dateTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_appointments',
      description: "Liste les rendez-vous de l'utilisateur.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: "Annule un rendez-vous existant de l'utilisateur, à partir de son id (obtenu via list_my_appointments). Demande toujours confirmation avant d'appeler.",
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID du rendez-vous à annuler' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'join_waitlist',
      description: "Inscrit l'utilisateur sur la liste d'attente d'un jour déjà complet.",
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date au format YYYY-MM-DD' },
          name: { type: 'string' },
          quantity: { type: 'number' },
        },
        required: ['date', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_waitlist_position',
      description: "Consulte la position de l'utilisateur dans la liste d'attente d'un jour donné.",
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'Date au format YYYY-MM-DD' } },
        required: ['date'],
      },
    },
  },
];
