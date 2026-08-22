import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));

import AdminWeeklyPage from '../pages/admin/AdminWeeklyPage';

function waitlistEntry(overrides: Record<string, unknown> = {}) {
  return { id: 9, name: 'Elie Kouakou', rank: 1, quantity: 2, date: new Date().toISOString(), ...overrides };
}

describe('AdminWeeklyPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.del.mockReset();
    mocks.get.mockResolvedValue([]);
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('charge la liste d’attente et affiche les sept jours', async () => {
    render(<AdminWeeklyPage />);
    expect(await screen.findByText('Lundi')).toBeInTheDocument();
    expect(screen.getByText('Dimanche')).toBeInTheDocument();
    expect(screen.getAllByText('Vide')).toHaveLength(7);
    expect(mocks.get).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/waitlist\?from=.*&to=/));
  });

  it('affiche les personnes en attente et leur nombre de places', async () => {
    mocks.get.mockResolvedValue([waitlistEntry()]);
    render(<AdminWeeklyPage />);
    expect(await screen.findByText('Elie Kouakou')).toBeInTheDocument();
    expect(screen.getByText('2 personnes')).toBeInTheDocument();
    expect(screen.getByText("1 en liste d'attente cette semaine")).toBeInTheDocument();
  });

  it('recharge la liste lorsque la semaine change', async () => {
    render(<AdminWeeklyPage />);
    await screen.findByText('Lundi');
    const controls = screen.getByRole('button', { name: "Aujourd'hui" }).parentElement!;
    const buttons = within(controls).getAllByRole('button');
    await userEvent.click(buttons[2]);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3));
  });

  it('retire une personne de la liste d’attente après confirmation', async () => {
    mocks.get.mockResolvedValue([waitlistEntry()]);
    render(<AdminWeeklyPage />);
    const card = (await screen.findByText('Elie Kouakou')).parentElement!;
    await userEvent.click(within(card).getByRole('button'));
    expect(mocks.del).toHaveBeenCalledWith('/admin/waitlist/9');
  });

  it('conserve l’inscription si la suppression est annulée', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    mocks.get.mockResolvedValue([waitlistEntry()]);
    render(<AdminWeeklyPage />);
    const card = (await screen.findByText('Elie Kouakou')).parentElement!;
    await userEvent.click(within(card).getByRole('button'));
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
