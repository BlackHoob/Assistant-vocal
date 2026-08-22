import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));

import AdminMessagesPage from '../pages/admin/AdminMessagesPage';

const account = { id: 7, name: 'Elie Kouakou', email: 'elie@example.com' };
const previousMessage = {
  id: 4,
  userId: 7,
  userName: 'Elie Kouakou',
  type: 'success',
  message: 'Votre document est prêt',
  created_at: '2026-08-20T10:00:00.000Z',
};

describe('AdminMessagesPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.get.mockImplementation(async (url: string) => url.startsWith('/admin/users?')
      ? { users: [account] }
      : [previousMessage]);
    mocks.post.mockResolvedValue({ sent: 3 });
  });

  it('charge et affiche l’historique des messages envoyés', async () => {
    render(<AdminMessagesPage />);
    expect(await screen.findByText('Votre document est prêt')).toBeInTheDocument();
    expect(screen.getByText('Elie Kouakou')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/notifications?limit=50');
  });

  it('affiche un état vide lorsque aucun message n’a été envoyé', async () => {
    mocks.get.mockResolvedValue([]);
    render(<AdminMessagesPage />);
    expect(await screen.findByText('Aucune notification envoyée')).toBeInTheDocument();
  });

  it('envoie un message à tous les utilisateurs', async () => {
    render(<AdminMessagesPage />);
    await userEvent.type(screen.getByPlaceholderText(/Notre agence sera fermée/i), 'Agence fermée lundi');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer à tous' }));

    expect(mocks.post).toHaveBeenCalledWith('/admin/notifications/send', {
      target: 'all',
      userId: undefined,
      type: 'info',
      category: 'system',
      message: 'Agence fermée lundi',
    });
    expect(await screen.findByText('Envoyée à 3 utilisateur(s)')).toBeInTheDocument();
  });

  it('exige un destinataire pour un message individuel', async () => {
    render(<AdminMessagesPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Utilisateur spécifique' }));
    await userEvent.type(screen.getByPlaceholderText(/Notre agence sera fermée/i), 'Bonjour Elie');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer à l'utilisateur" }));
    expect(screen.getByText('Sélectionnez un utilisateur')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('recherche un destinataire puis lui envoie une notification ciblée', async () => {
    render(<AdminMessagesPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Utilisateur spécifique' }));
    await userEvent.type(screen.getByPlaceholderText('Nom ou email...'), 'Elie{Enter}');
    expect(mocks.get).toHaveBeenCalledWith('/admin/users?search=Elie&limit=8');

    await userEvent.click(await screen.findByRole('button', { name: /Elie Kouakou.*elie@example\.com/i }));
    await userEvent.type(screen.getByPlaceholderText(/Notre agence sera fermée/i), 'Votre billet est disponible');
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'success');
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'ticket');
    await userEvent.click(screen.getByRole('button', { name: "Envoyer à l'utilisateur" }));

    expect(mocks.post).toHaveBeenCalledWith('/admin/notifications/send', {
      target: 'user',
      userId: 7,
      type: 'success',
      category: 'ticket',
      message: 'Votre billet est disponible',
    });
    expect(await screen.findByText('Notification envoyée')).toBeInTheDocument();
  });

  it('affiche l’erreur du serveur si l’envoi échoue', async () => {
    mocks.post.mockRejectedValue(new Error('Envoi interdit'));
    render(<AdminMessagesPage />);
    await userEvent.type(screen.getByPlaceholderText(/Notre agence sera fermée/i), 'Bonjour');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer à tous' }));
    expect(await screen.findByText('Envoi interdit')).toBeInTheDocument();
  });

  it('recharge l’historique après un envoi réussi', async () => {
    render(<AdminMessagesPage />);
    await screen.findByText('Votre document est prêt');
    await userEvent.type(screen.getByPlaceholderText(/Notre agence sera fermée/i), 'Nouveau message');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer à tous' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
});
