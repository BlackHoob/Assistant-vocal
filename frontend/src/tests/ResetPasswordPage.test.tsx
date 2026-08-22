import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '../pages/ResetPasswordPage';

function renderPage(url = '/reset-password?token=jeton-securise') {
  return render(<MemoryRouter initialEntries={[url]}><ResetPasswordPage /></MemoryRouter>);
}

async function fillPasswords(password: string, confirmation: string) {
  const fields = screen.getAllByPlaceholderText('••••••••');
  await userEvent.type(fields[0], password);
  await userEvent.type(fields[1], confirmation);
  await userEvent.click(screen.getByRole('button', { name: /Réinitialiser le mot de passe/i }));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('signale un lien sans jeton de réinitialisation', () => {
    renderPage('/reset-password');
    expect(screen.getByRole('heading', { name: 'Lien invalide' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour à la demande/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('affiche les deux champs lorsque le jeton est présent', () => {
    renderPage();
    expect(screen.getAllByPlaceholderText('••••••••')).toHaveLength(2);
  });

  it('refuse des mots de passe différents', async () => {
    renderPage();
    await fillPasswords('motdepasse123', 'motdepasse456');
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe inférieur à huit caractères', async () => {
    renderPage();
    await fillPasswords('court', 'court');
    expect(screen.getByText('Minimum 8 caractères')).toBeInTheDocument();
  });

  it('envoie le jeton et le nouveau mot de passe à l’API', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    renderPage();
    await fillPasswords('Nouveau123!', 'Nouveau123!');

    expect(await screen.findByText('Mot de passe mis à jour')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/reset-password'), expect.objectContaining({
      body: JSON.stringify({ token: 'jeton-securise', password: 'Nouveau123!' }),
    }));
  });

  it('affiche le message d’un jeton expiré', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Jeton expiré' }) } as Response);
    renderPage();
    await fillPasswords('Nouveau123!', 'Nouveau123!');
    expect(await screen.findByText('Jeton expiré')).toBeInTheDocument();
  });

  it('permet d’afficher ou de masquer les mots de passe', async () => {
    const { container } = renderPage();
    const toggle = container.querySelector('button[type="button"]')!;
    await userEvent.click(toggle);
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toHaveAttribute('type', 'text');
    await userEvent.click(toggle);
    expect(screen.getAllByPlaceholderText('••••••••')[0]).toHaveAttribute('type', 'password');
  });
});
