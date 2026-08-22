import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));

import AdminUsersPage from '../pages/admin/AdminUsersPage';

const account = {
  id: 7,
  appwriteId: 'appwrite-elie-7',
  name: 'Elie Kouakou',
  email: 'elie@example.com',
  phone: '+33612345678',
  blocked: false,
  appointmentCount: 2,
  ticketCount: 1,
  created_at: '2026-01-15T10:00:00.000Z',
};

const detail = {
  appointments: [{ id: 11, title: 'Conseil voyage', dateTime: '2026-09-15' }],
  tickets: [{ id: 12, origin: 'Paris', destination: 'Abidjan', price: 540 }],
  documents: [{ id: 13 }],
};

async function openDetail() {
  await userEvent.click(await screen.findByText('Elie Kouakou'));
  await screen.findByText(/Conseil voyage/i);
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.del.mockReset();
    mocks.get.mockImplementation(async (url: string) => url.includes('?search=')
      ? { users: [account], total: 1 }
      : detail);
    mocks.put.mockResolvedValue({ name: 'Elie mis à jour' });
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('affiche la liste des utilisateurs inscrits', async () => {
    render(<AdminUsersPage />);
    expect(await screen.findByText('Elie Kouakou')).toBeInTheDocument();
    expect(screen.getByText('1 inscrits')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/users?search=');
  });

  it('affiche un état vide en l’absence de comptes', async () => {
    mocks.get.mockResolvedValue({ users: [], total: 0 });
    render(<AdminUsersPage />);
    expect(await screen.findByText('Aucun utilisateur')).toBeInTheDocument();
  });

  it('recherche un utilisateur avec la touche Entrée', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('Elie Kouakou');
    await userEvent.type(screen.getByPlaceholderText('Rechercher...'), 'Elie Kouakou{Enter}');
    expect(mocks.get).toHaveBeenCalledWith('/admin/users?search=Elie%20Kouakou');
  });

  it('charge le détail des rendez-vous, billets et documents', async () => {
    render(<AdminUsersPage />);
    await openDetail();
    expect(mocks.get).toHaveBeenCalledWith('/admin/users/appwrite-elie-7');
    expect(screen.getByText(/Paris → Abidjan/)).toBeInTheDocument();
    expect(screen.getByText(/1 Documents/)).toBeInTheDocument();
  });

  it('modifie les informations d’un utilisateur', async () => {
    render(<AdminUsersPage />);
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    const field = screen.getByDisplayValue('Elie Kouakou');
    await userEvent.clear(field);
    await userEvent.type(field, 'Elie mis à jour');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(mocks.put).toHaveBeenCalledWith('/admin/users/7', expect.objectContaining({ name: 'Elie mis à jour' }));
    await waitFor(() => expect(screen.getByText('Elie mis à jour')).toBeInTheDocument());
  });

  it('bloque un compte après confirmation', async () => {
    render(<AdminUsersPage />);
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Bloquer' }));
    expect(mocks.put).toHaveBeenCalledWith('/admin/users/7/block', { blocked: true });
    expect(await screen.findByRole('button', { name: 'Débloquer' })).toBeInTheDocument();
  });

  it('ne bloque pas le compte lorsque la confirmation est annulée', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<AdminUsersPage />);
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Bloquer' }));
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('supprime l’utilisateur en utilisant son identifiant Appwrite', async () => {
    render(<AdminUsersPage />);
    await openDetail();
    const panel = screen.getByText('Détail').closest('div')!.parentElement!;
    const buttons = within(panel).getAllByRole('button');
    await userEvent.click(buttons[2]);
    expect(mocks.del).toHaveBeenCalledWith('/admin/users/appwrite-elie-7');
  });
});
