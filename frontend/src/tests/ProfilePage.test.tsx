import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {
    id: 7,
    name: 'Elie Marc Kouakou',
    email: 'elie@example.com',
    phone: '+33612345678',
    avatar: null as string | null,
    notifyEmail: true,
    notifyPush: true,
  },
  setAuth: vi.fn(),
  logout: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  changeLanguage: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, token: 'jwt-client', setAuth: mocks.setAuth, logout: mocks.logout }),
}));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ put: mocks.put, del: mocks.del }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr', changeLanguage: mocks.changeLanguage } }),
}));

import ProfilePage from '../pages/ProfilePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profil']}>
      <Routes>
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="/login" element={<div>Page de connexion</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openSection(name: RegExp | string) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(mocks.user, {
      name: 'Elie Marc Kouakou',
      email: 'elie@example.com',
      phone: '+33612345678',
      avatar: null,
      notifyEmail: true,
      notifyPush: true,
    });
    mocks.setAuth.mockReset();
    mocks.logout.mockReset();
    mocks.put.mockReset();
    mocks.del.mockReset();
    mocks.changeLanguage.mockReset();
    mocks.put.mockResolvedValue({ name: 'Elie modifié' });
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('affiche les informations du compte et les rubriques principales', () => {
    renderPage();
    expect(screen.getAllByText('Elie Marc Kouakou').length).toBeGreaterThan(0);
    expect(screen.getAllByText('elie@example.com').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Mon profil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Informations légales/i })).toBeInTheDocument();
  });

  it('modifie l’identité puis actualise la session', async () => {
    renderPage();
    await openSection(/Mon profil/i);
    const field = screen.getByPlaceholderText('Votre nom');
    await userEvent.clear(field);
    await userEvent.type(field, 'Elie modifié');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/profile', {
      name: 'Elie modifié',
      phone: '+33612345678',
    }));
    expect(mocks.setAuth).toHaveBeenCalledWith('jwt-client', expect.objectContaining({ name: 'Elie modifié' }));
    expect(await screen.findByText(/Enregistré/)).toBeInTheDocument();
  });

  it('modifie le numéro de téléphone', async () => {
    renderPage();
    await openSection(/Téléphone/i);
    const field = screen.getByPlaceholderText('+33 6 00 00 00 00');
    await userEvent.clear(field);
    await userEvent.type(field, '+33700000000');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(mocks.put).toHaveBeenCalledWith('/profile', expect.objectContaining({ phone: '+33700000000' }));
  });

  it('présente l’adresse e-mail vérifiée', async () => {
    renderPage();
    await openSection(/E-mail/i);
    expect(screen.getByText('Adresse vérifiée')).toBeInTheDocument();
    expect(screen.getByText('elie@example.com')).toBeInTheDocument();
  });

  it('refuse des nouveaux mots de passe différents', async () => {
    const { container } = renderPage();
    await openSection(/Mot de passe/i);
    const fields = container.querySelectorAll('input[type="password"]');
    await userEvent.type(fields[0], 'Ancien123!');
    await userEvent.type(fields[1], 'Nouveau123!');
    await userEvent.type(fields[2], 'Different123!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
  });

  it('met à jour le mot de passe auprès de l’API', async () => {
    const { container } = renderPage();
    await openSection(/Mot de passe/i);
    const fields = container.querySelectorAll('input[type="password"]');
    await userEvent.type(fields[0], 'Ancien123!');
    await userEvent.type(fields[1], 'Nouveau123!');
    await userEvent.type(fields[2], 'Nouveau123!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
    expect(mocks.put).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: 'Ancien123!',
      newPassword: 'Nouveau123!',
    });
    expect(await screen.findByText(/Mot de passe mis à jour avec succès/i)).toBeInTheDocument();
  });

  it('affiche l’erreur si le changement de mot de passe est refusé', async () => {
    mocks.put.mockRejectedValue(new Error('Mot de passe actuel incorrect'));
    const { container } = renderPage();
    await openSection(/Mot de passe/i);
    const fields = container.querySelectorAll('input[type="password"]');
    await userEvent.type(fields[0], 'Ancien123!');
    await userEvent.type(fields[1], 'Nouveau123!');
    await userEvent.type(fields[2], 'Nouveau123!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));
    expect(await screen.findByText('Mot de passe actuel incorrect')).toBeInTheDocument();
  });

  it('enregistre les préférences de notifications', async () => {
    renderPage();
    await openSection(/Notifications/i);
    const pushCard = screen.getByText("Notifications dans l'application").closest('div')!.parentElement!;
    await userEvent.click(within(pushCard).getByRole('button'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(mocks.put).toHaveBeenCalledWith('/profile', { notifyEmail: true, notifyPush: false });
    expect(await screen.findByText('Préférences enregistrées')).toBeInTheDocument();
  });

  it('change la langue et mémorise le choix', async () => {
    renderPage();
    await openSection(/Langue/i);
    await userEvent.click(screen.getByRole('button', { name: /English/i }));
    expect(mocks.changeLanguage).toHaveBeenCalledWith('en');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('présente les informations légales et les données personnelles', async () => {
    renderPage();
    await openSection(/Informations légales/i);
    expect(screen.getByText('Éditeur')).toBeInTheDocument();
    expect(screen.getByText('Données personnelles')).toBeInTheDocument();
    expect(screen.getByText("Conditions d'utilisation")).toBeInTheDocument();
  });

  it('déconnecte l’utilisateur et redirige vers la connexion', async () => {
    renderPage();
    await openSection(/Déconnexion/i);
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Page de connexion')).toBeInTheDocument();
  });

  it('supprime le compte après confirmation explicite', async () => {
    renderPage();
    await openSection(/Supprimer mon compte/i);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(mocks.del).toHaveBeenCalledWith('/profile'));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Page de connexion')).toBeInTheDocument();
  });

  it('ne supprime pas le compte lorsque la confirmation est annulée', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPage();
    await openSection(/Supprimer mon compte/i);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(mocks.del).not.toHaveBeenCalled();
  });

  it('affiche une erreur si la suppression du compte échoue', async () => {
    mocks.del.mockRejectedValue(new Error('Compte protégé'));
    renderPage();
    await openSection(/Supprimer mon compte/i);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText('Compte protégé')).toBeInTheDocument();
  });

  it('téléverse une photo de profil avec le jeton de session', async () => {
    vi.mocked(fetch).mockResolvedValue({ json: async () => ({ avatar: 'elie.jpg' }) } as Response);
    const { container } = renderPage();
    const file = new File(['photo'], 'elie.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/profile/avatar'), expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer jwt-client' },
    })));
    await waitFor(() => expect(mocks.setAuth).toHaveBeenCalledWith('jwt-client', expect.objectContaining({ avatar: 'elie.jpg' })));
  });

  it('supprime une photo de profil existante après validation du serveur', async () => {
    mocks.user.avatar = 'elie.jpg';
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la photo' }));

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/profile/avatar'), expect.objectContaining({ method: 'DELETE' }));
    await waitFor(() => expect(mocks.setAuth).toHaveBeenCalledWith('jwt-client', expect.objectContaining({ avatar: null })));
  });

  it('conserve la photo si le serveur refuse sa suppression', async () => {
    mocks.user.avatar = 'elie.jpg';
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Photo protégée' }) } as Response);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la photo' }));
    expect(await screen.findByText('Photo protégée')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'avatar' })).toBeInTheDocument();
  });
});
