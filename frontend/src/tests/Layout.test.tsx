import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { name: 'Elie Marc Kouakou', email: 'elie@example.com', avatar: null as string | null },
  logout: vi.fn(),
  i18n: { language: 'fr', changeLanguage: vi.fn() },
  notifications: {
    notifications: [] as Array<{ id: number; message: string; type: string; category: string; read: boolean; time: string }>,
    unread: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, logout: mocks.logout }) }));
vi.mock('../hooks/useNotifications', () => ({ useNotifications: () => mocks.notifications }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      nav_home: 'Accueil',
      nav_ia: 'Assistant',
      nav_appointments: 'Rendez-vous',
      nav_documents: 'Documents',
      nav_tickets: 'Billets',
      nav_profile: 'Profil',
      nav_lang: 'Langue',
      nav_dark: 'Mode sombre',
      nav_light: 'Mode clair',
      nav_notif: 'Notifications',
      nav_logout: 'Déconnexion',
      notif_title: 'Notifications',
      notif_read_all: 'Tout lire',
      notif_active: 'Actif',
      notif_off: 'Désactivé',
      notif_empty: 'Aucune notification',
    } as Record<string, string>)[key] || key,
    i18n: mocks.i18n,
  }),
}));

import Layout from '../components/Layout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Contenu client affiché</div>} />
        </Route>
        <Route path="/login" element={<div>Connexion client</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedNotification(overrides: Record<string, unknown> = {}) {
  mocks.notifications.notifications = [{
    id: 9,
    message: 'Votre rendez-vous est confirmé',
    type: 'success',
    category: 'appointment',
    read: false,
    time: 'Il y a 2 min',
    ...overrides,
  } as (typeof mocks.notifications.notifications)[number]];
  mocks.notifications.unread = 1;
}

describe('Layout client', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.dir = 'ltr';
    mocks.user.avatar = null;
    mocks.logout.mockReset();
    mocks.i18n.language = 'fr';
    mocks.i18n.changeLanguage.mockReset();
    mocks.notifications.notifications = [];
    mocks.notifications.unread = 0;
    mocks.notifications.markRead.mockReset();
    mocks.notifications.markAllRead.mockReset();
    mocks.notifications.dismiss.mockReset();
    mocks.notifications.refresh.mockReset();
  });

  it('présente les liens de navigation, l’utilisateur et le contenu', () => {
    renderLayout();
    expect(screen.getByText('Contenu client affiché')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Assistant' })).toHaveAttribute('href', '/assistant');
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('href', '/documents');
    expect(screen.getByText('Elie Marc Kouakou')).toBeInTheDocument();
    expect(screen.getByText('EM')).toBeInTheDocument();
  });

  it('active puis désactive le mode sombre en mémorisant le choix', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Mode sombre' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Mode clair' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('change la langue et active le sens de lecture arabe', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Langue/i }));
    await userEvent.click(screen.getByRole('button', { name: /العربية/i }));
    expect(mocks.i18n.changeLanguage).toHaveBeenCalledWith('ar');
    expect(localStorage.getItem('lang')).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ferme le menu des langues lors d’un clic extérieur', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Langue/i }));
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: /English/i })).not.toBeInTheDocument();
  });

  it('ouvre un panneau vide et actualise les notifications', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
    expect(mocks.notifications.refresh).toHaveBeenCalledOnce();
    expect(mocks.notifications.markAllRead).toHaveBeenCalledOnce();
  });

  it('affiche les notifications et permet de toutes les marquer lues', async () => {
    seedNotification();
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications\s*1/i }));
    expect(screen.getByText('Votre rendez-vous est confirmé')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tout lire' }));
    expect(mocks.notifications.markAllRead).toHaveBeenCalledTimes(2);
  });

  it('marque une notification individuelle comme lue', async () => {
    seedNotification();
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications\s*1/i }));
    await userEvent.click(screen.getByText('Votre rendez-vous est confirmé'));
    expect(mocks.notifications.markRead).toHaveBeenCalledWith(9);
  });

  it('supprime une notification sans la marquer lue', async () => {
    seedNotification();
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications\s*1/i }));
    const card = screen.getByText('Votre rendez-vous est confirmé').parentElement!.parentElement!;
    await userEvent.click(within(card).getByRole('button'));
    expect(mocks.notifications.dismiss).toHaveBeenCalledWith(9);
    expect(mocks.notifications.markRead).not.toHaveBeenCalled();
  });

  it('désactive les notifications et persiste la préférence', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Actif' }));
    expect(localStorage.getItem('notif')).toBe('false');
    expect(screen.getByRole('button', { name: 'Désactivé' })).toBeInTheDocument();
  });

  it('affiche la photo de profil si l’utilisateur en possède une', () => {
    mocks.user.avatar = 'elie.jpg';
    renderLayout();
    expect(screen.getByRole('img', { name: 'avatar' })).toHaveAttribute('src', expect.stringContaining('/uploads/avatars/elie.jpg'));
  });

  it('ouvre le menu mobile depuis l’en-tête', async () => {
    renderLayout();
    const header = document.querySelector('header')!;
    const buttons = within(header).getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(screen.getAllByRole('link', { name: 'Accueil' })).toHaveLength(2);
  });

  it('déconnecte l’utilisateur et revient à la page de connexion', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Connexion client')).toBeInTheDocument();
  });
});
