import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));

import AdminTicketsPage from '../pages/admin/AdminTicketsPage';

const ticket = {
  id: 18,
  flightNumber: 'AF702',
  origin: 'Paris',
  destination: 'Abidjan',
  userName: 'Elie Kouakou',
  departureDate: '2026-09-15T10:30:00.000Z',
  price: 540,
  currency: 'EUR',
  status: 'upcoming',
};

describe('AdminTicketsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.del.mockReset();
    mocks.get.mockResolvedValue({ tickets: [ticket], total: 1 });
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('charge les billets et affiche le trajet, le client et le prix', async () => {
    render(<AdminTicketsPage />);
    expect(await screen.findByText('AF702')).toBeInTheDocument();
    expect(screen.getByText(/Paris/)).toHaveTextContent('Paris');
    expect(screen.getByText('Elie Kouakou')).toBeInTheDocument();
    expect(screen.getByText('540 EUR')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/tickets?limit=50');
  });

  it('affiche un état vide lorsque aucun billet n’existe', async () => {
    mocks.get.mockResolvedValue({ tickets: [], total: 0 });
    render(<AdminTicketsPage />);
    expect(await screen.findByText('Aucun billet')).toBeInTheDocument();
  });

  it('filtre les billets annulés', async () => {
    render(<AdminTicketsPage />);
    await screen.findByText('AF702');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'cancelled');
    expect(mocks.get).toHaveBeenCalledWith('/admin/tickets?limit=50&status=cancelled');
  });

  it('supprime un billet lorsque l’administrateur confirme', async () => {
    render(<AdminTicketsPage />);
    const row = (await screen.findByText('AF702')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button'));
    expect(mocks.del).toHaveBeenCalledWith('/admin/tickets/18');
  });

  it('conserve le billet lorsque la confirmation est annulée', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<AdminTicketsPage />);
    const row = (await screen.findByText('AF702')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button'));
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
