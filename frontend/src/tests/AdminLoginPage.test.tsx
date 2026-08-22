import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ setAdmin: vi.fn() }));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ setAdmin: mocks.setAdmin }),
}));

import AdminLoginPage from '../pages/admin/AdminLoginPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<div>Tableau de bord chargé</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submit() {
  await userEvent.type(screen.getByPlaceholderText('admin'), 'superadmin');
  await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    mocks.setAdmin.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('affiche le formulaire administrateur et l’accès client', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Administration/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Client' })).toHaveAttribute('href', '/login');
  });

  it('connecte l’administrateur et ouvre le tableau de bord', async () => {
    const admin = { id: 1, username: 'superadmin', role: 'superadmin' };
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ token: 'jwt-admin', admin }) } as Response);
    renderPage();
    await submit();

    expect(await screen.findByText('Tableau de bord chargé')).toBeInTheDocument();
    expect(mocks.setAdmin).toHaveBeenCalledWith('jwt-admin', admin);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/auth/login'), expect.objectContaining({
      body: JSON.stringify({ username: 'superadmin', password: 'secret123' }),
    }));
  });

  it('affiche le message du serveur si les identifiants sont refusés', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Accès refusé' }) } as Response);
    renderPage();
    await submit();
    expect(await screen.findByText('Accès refusé')).toBeInTheDocument();
  });

  it('affiche un message clair en cas d’erreur réseau', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    renderPage();
    await submit();
    expect(await screen.findByText('Erreur de connexion au serveur')).toBeInTheDocument();
  });

  it('permet d’afficher puis de masquer le mot de passe', async () => {
    const { container } = renderPage();
    const field = screen.getByPlaceholderText('••••••••');
    await userEvent.click(container.querySelector('button[type="button"]')!);
    expect(field).toHaveAttribute('type', 'text');
    await userEvent.click(container.querySelector('button[type="button"]')!);
    expect(field).toHaveAttribute('type', 'password');
  });
});
