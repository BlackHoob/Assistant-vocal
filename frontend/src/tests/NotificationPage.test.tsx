import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useApi', () => ({ useApi: () => mocks }));

import NotificationPage from '../pages/NotificationPage';

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    type: 'success',
    category: 'appointment',
    message: 'Rendez-vous confirmé',
    is_read: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.patch.mockReset();
    mocks.del.mockReset();
    mocks.get.mockResolvedValue([]);
    mocks.patch.mockResolvedValue({});
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('charge les notifications et les marque comme lues', async () => {
    render(<NotificationPage />);
    expect(await screen.findByText('Aucune notification pour le moment')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/notifications');
    expect(mocks.patch).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('affiche les messages, leur nombre et leur date relative', async () => {
    mocks.get.mockResolvedValue([notification(), notification({ id: 8, message: 'Billet enregistré', category: 'ticket', is_read: 1 })]);
    render(<NotificationPage />);
    expect(await screen.findByText('Rendez-vous confirmé')).toBeInTheDocument();
    expect(screen.getByText('Billet enregistré')).toBeInTheDocument();
    expect(screen.getByText('2 notifications')).toBeInTheDocument();
    expect(screen.getAllByText("À l'instant")).toHaveLength(2);
  });

  it('affiche les dates exprimées en minutes et en heures', async () => {
    mocks.get.mockResolvedValue([
      notification({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() }),
      notification({ id: 8, message: 'Ancien billet', created_at: new Date(Date.now() - 120 * 60_000).toISOString() }),
    ]);
    render(<NotificationPage />);
    expect(await screen.findByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Il y a 2h')).toBeInTheDocument();
  });

  it('supprime une notification individuellement', async () => {
    mocks.get.mockResolvedValue([notification()]);
    render(<NotificationPage />);
    const card = (await screen.findByText('Rendez-vous confirmé')).closest('.card')!;
    await userEvent.click(within(card as HTMLElement).getByRole('button'));

    expect(mocks.del).toHaveBeenCalledWith('/notifications/7');
    expect(await screen.findByText('Aucune notification pour le moment')).toBeInTheDocument();
  });

  it('efface toutes les notifications après confirmation', async () => {
    mocks.get.mockResolvedValue([notification()]);
    render(<NotificationPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tout effacer' }));
    expect(confirm).toHaveBeenCalled();
    expect(mocks.del).toHaveBeenCalledWith('/notifications');
  });

  it('conserve les notifications lorsque l’utilisateur annule', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    mocks.get.mockResolvedValue([notification()]);
    render(<NotificationPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tout effacer' }));
    expect(mocks.del).not.toHaveBeenCalled();
    expect(screen.getByText('Rendez-vous confirmé')).toBeInTheDocument();
  });

  it('recharge la liste si la suppression échoue', async () => {
    mocks.get.mockResolvedValue([notification()]);
    mocks.del.mockRejectedValue(new Error('Suppression impossible'));
    render(<NotificationPage />);
    const card = (await screen.findByText('Rendez-vous confirmé')).closest('.card')!;
    await userEvent.click(within(card as HTMLElement).getByRole('button'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
});
