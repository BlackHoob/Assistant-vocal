// Avant : une fonction badge(status) quasi identique était réécrite dans
// TicketsPage, AdminAppointmentsPage et AdminTicketsPage. Deux variantes
// visuelles existent dans l'app (cartes claires côté client, cartes sombres
// côté admin) — le composant les gère toutes les deux via `variant`.
type Status = 'upcoming' | 'completed' | 'cancelled';

const LABELS: Record<Status, string> = {
  upcoming: 'À venir',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

const ADMIN_STYLES: Record<Status, string> = {
  upcoming: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const CLIENT_STYLES: Record<Status, string> = {
  upcoming: 'badge-orange',
  completed: 'badge-green',
  cancelled: 'badge-red',
};

interface StatusBadgeProps {
  status: string;
  variant?: 'admin' | 'client';
}

export default function StatusBadge({ status, variant = 'admin' }: StatusBadgeProps) {
  const key: Status = status in LABELS ? (status as Status) : 'upcoming';
  const label = LABELS[key];

  if (variant === 'client') {
    return <span className={`${CLIENT_STYLES[key]} text-xs`}>{label}</span>;
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${ADMIN_STYLES[key]}`}>
      {label}
    </span>
  );
}