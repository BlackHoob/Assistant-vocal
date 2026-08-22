import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

function renderPage() {
  return render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('affiche le formulaire et un retour vers la connexion', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Mot de passe oublié/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Retour à la connexion/i })).toHaveAttribute('href', '/login');
  });

  it('envoie l’adresse e-mail à l’API puis confirme la demande', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('vous@exemple.com'), 'elie@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));

    expect(await screen.findByRole('heading', { name: /Vérifiez vos e-mails/i })).toBeInTheDocument();
    expect(screen.getByText('elie@example.com')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/forgot-password'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'elie@example.com' }),
    }));
  });

  it('permet de revenir au formulaire après l’envoi', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('vous@exemple.com'), 'elie@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Renvoyer l'e-mail/i }));

    expect(screen.getByPlaceholderText('vous@exemple.com')).toHaveValue('elie@example.com');
  });

  it('affiche l’erreur renvoyée par le serveur', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Service indisponible' }) } as Response);
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('vous@exemple.com'), 'elie@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));

    expect(await screen.findByText('Service indisponible')).toBeInTheDocument();
  });

  it('affiche une erreur réseau sans bloquer le formulaire', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Connexion impossible'));
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('vous@exemple.com'), 'elie@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer le lien/i }));

    expect(await screen.findByText('Connexion impossible')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Envoyer le lien/i })).toBeEnabled());
  });
});
