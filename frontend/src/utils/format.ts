// Avant : formatDate/formatPrice réécrits légèrement différemment dans
// TicketsPage, AdminAppointmentsPage, AdminTicketsPage, AdminDocumentsPage...

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fr-FR', options || { day: 'numeric', month: 'short' });
  } catch {
    return value;
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

export function formatPrice(price?: number | null, currency = 'EUR'): string {
  if (price == null) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}