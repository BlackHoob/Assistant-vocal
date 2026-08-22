import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: { id: 1, username: 'principal', role: 'superadmin' },
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ adminUser: mocks.admin }) }));

import AdminAdminsPage from '../pages/admin/AdminAdminsPage';

const admins = [
  { id: 1, username: 'principal', email: 'principal@nestor.local', role: 'superadmin', created_at: '2026-01-01' },
  { id: 2, username: 'conseiller', email: 'conseiller@nestor.local', role: 'admin', created_at: '2026-02-01' },
];

async function openCreateForm() {
  await userEvent.click(screen.getByRole('button', { name: 'Nouvel admin' }));
  await userEvent.type(screen.getByPlaceholderText('johndoe'), 'nouveau');
  await userEvent.type(screen.getByPlaceholderText('john@nestor.local'), 'nouveau@nestor.local');
  await userEvent.type(screen.getByPlaceholderText('Min. 8 caractères'), 'Secret123!');
}

describe('AdminAdminsPage', () => {
  beforeEach(() => {
    mocks.admin.role = 'superadmin';
    mocks.get.mockReset();
    mocks.post.mockReset();
    mocks.del.mockReset();
    mocks.get.mockResolvedValue(admins);
    mocks.post.mockResolvedValue({});
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('réserve la gestion des administrateurs aux superadmins', async () => {
    mocks.admin.role = 'admin';
    render(<AdminAdminsPage />);
    expect(screen.getByText('Réservé aux superadmins')).toBeInTheDocument();
    await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  });

  it('affiche les administrateurs et identifie le compte courant', async () => {
    render(<AdminAdminsPage />);
    expect(await screen.findByText('conseiller')).toBeInTheDocument();
    expect(screen.getByText('(vous)')).toBeInTheDocument();
    expect(screen.getByText('2 admin(s)')).toBeInTheDocument();
  });

  it('crée un administrateur puis recharge la liste', async () => {
    render(<AdminAdminsPage />);
    await screen.findByText('conseiller');
    await openCreateForm();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'superadmin');
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(mocks.post).toHaveBeenCalledWith('/admin/admins', {
      username: 'nouveau',
      email: 'nouveau@nestor.local',
      password: 'Secret123!',
      role: 'superadmin',
    });
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });

  it('affiche l’erreur lorsque la création est refusée', async () => {
    mocks.post.mockRejectedValue(new Error('Adresse déjà utilisée'));
    render(<AdminAdminsPage />);
    await openCreateForm();
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(await screen.findByText('Adresse déjà utilisée')).toBeInTheDocument();
  });

  it('supprime un autre administrateur après confirmation', async () => {
    render(<AdminAdminsPage />);
    const row = (await screen.findByText('conseiller')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button'));
    expect(mocks.del).toHaveBeenCalledWith('/admin/admins/2');
  });

  it('ne supprime pas un administrateur si la confirmation est annulée', async () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<AdminAdminsPage />);
    const row = (await screen.findByText('conseiller')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button'));
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('ne propose pas de supprimer son propre compte administrateur', async () => {
    render(<AdminAdminsPage />);
    const row = (await screen.findByText('principal')).closest('tr')!;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });
});
