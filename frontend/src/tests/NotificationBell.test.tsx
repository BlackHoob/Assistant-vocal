import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ get: mocks.get }) }));

import NotificationBell from '../pages/NotificationBell';

describe('NotificationBell', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.get.mockResolvedValue({ count: 0 });
  });

  it('récupère le nombre de notifications non lues', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/notifications/unread-count'));
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('masque le badge lorsqu’il n’existe aucune notification', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('affiche le nombre de notifications non lues', async () => {
    mocks.get.mockResolvedValue({ count: 4 });
    render(<NotificationBell />);
    expect(await screen.findByText('4')).toBeInTheDocument();
  });

  it('limite visuellement le compteur à 9+', async () => {
    mocks.get.mockResolvedValue({ count: 14 });
    render(<NotificationBell />);
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('déclenche l’action fournie au clic', async () => {
    const onClick = vi.fn();
    render(<NotificationBell onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ignore silencieusement une erreur de récupération', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    render(<NotificationBell />);
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
