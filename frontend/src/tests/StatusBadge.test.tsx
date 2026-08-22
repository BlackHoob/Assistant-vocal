import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../components/shared/StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['upcoming', 'À venir', 'text-orange-400'],
    ['completed', 'Terminé', 'text-green-400'],
    ['cancelled', 'Annulé', 'text-red-400'],
  ])('affiche le statut administrateur %s', (status, label, style) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(style);
  });

  it.each([
    ['upcoming', 'À venir', 'badge-orange'],
    ['completed', 'Terminé', 'badge-green'],
    ['cancelled', 'Annulé', 'badge-red'],
  ])('affiche le statut client %s', (status, label, style) => {
    render(<StatusBadge status={status} variant="client" />);
    expect(screen.getByText(label)).toHaveClass(style);
  });

  it('utilise le statut à venir lorsque le statut est inconnu', () => {
    render(<StatusBadge status="inconnu" />);
    expect(screen.getByText('À venir')).toBeInTheDocument();
  });
});
