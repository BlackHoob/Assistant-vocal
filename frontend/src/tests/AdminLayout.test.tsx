import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: { username: 'superadmin', email: 'admin@nestor.local' },
  logoutAdmin: vi.fn(),
  notifications: {
    notifications: [] as Array<{ id: number; message: string; type: string; category: string; read: boolean; time: string }>,
    unread: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    dismiss: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ adminUser: mocks.admin, logoutAdmin: mocks.logoutAdmin }) }));
vi.mock('../hooks/useNotifications', () => ({ useNotifications: () => mocks.notifications }));

import AdminLayout from '../components/Adminlayout';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>Contenu administration affiché</div>} />
        </Route>
        <Route path="/admin/login" element={<div>Connexion administrateur</div>} />
        <Route path="/" element={<div>Accueil de l’application</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedNotification(overrides: Record<string, unknown> = {}) {
  mocks.notifications.notifications = [{
    id: 15,
    message: 'Nouveau document reçu',
    type: 'warning',
    category: 'document',
    read: false,
    time: 'Il y a 3 min',
    ...overrides,
  } as (typeof mocks.notifications.notifications)[number]];
  mocks.notifications.unread = 1;
}

describe('AdminLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.dir = 'ltr';
    mocks.logoutAdmin.mockReset();
    mocks.notifications.notifications = [];
    mocks.notifications.unread = 0;
    mocks.notifications.markRead.mockReset();
    mocks.notifications.markAllRead.mockReset();
    mocks.notifications.dismiss.mockReset();
    mocks.notifications.refresh.mockReset();
  });

  it('présente les rubriques administratives et le compte connecté', () => {
    renderLayout();
    expect(screen.getByText('Contenu administration affiché')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Utilisateurs' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute('href', '/admin/documents');
    expect(screen.getByText('superadmin')).toBeInTheDocument();
    expect(screen.getByText('SU')).toBeInTheDocument();
  });

  it('active puis désactive le mode sombre', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Mode sombre' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Mode clair' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('change la langue anglaise puis mémorise le choix', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Langue/i }));
    await userEvent.click(screen.getByRole('button', { name: /English/i }));
    expect(localStorage.getItem('lang')).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('active le sens de lecture droite-gauche pour l’arabe', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Langue/i }));
    await userEvent.click(screen.getByRole('button', { name: /العربية/i }));
    expect(localStorage.getItem('lang')).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ferme le menu langue lors d’un clic extérieur', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Langue/i }));
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('button', { name: /English/i })).not.toBeInTheDocument();
  });

  it('ouvre le panneau de notifications vide', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
    expect(mocks.notifications.refresh).toHaveBeenCalledOnce();
  });

  it('marque toutes les notifications administratives comme lues', async () => {
    seedNotification();
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications\s*1/i }));
    expect(screen.getByText('Nouveau document reçu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tout lire' }));
    expect(mocks.notifications.markAllRead).toHaveBeenCalledOnce();
  });

  it('marque une notification comme lue puis permet de la supprimer', async () => {
    seedNotification();
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: /Notifications\s*1/i }));
    const message = screen.getByText('Nouveau document reçu');
    await userEvent.click(message);
    expect(mocks.notifications.markRead).toHaveBeenCalledWith(15);

    const card = message.parentElement!.parentElement!;
    await userEvent.click(within(card).getByRole('button'));
    expect(mocks.notifications.dismiss).toHaveBeenCalledWith(15);
  });

  it('désactive les notifications administrateur', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(screen.getByRole('button', { name: 'Actif' }));
    expect(localStorage.getItem('notif')).toBe('false');
    expect(screen.getByRole('button', { name: 'Désactivé' })).toBeInTheDocument();
  });

  it('ouvre le menu mobile administrateur', async () => {
    renderLayout();
    const header = document.querySelector('header')!;
    const buttons = within(header).getAllByRole('button');
    await userEvent.click(buttons[buttons.length - 1]);
    expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2);
  });

  it('revient à l’application cliente', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: "Retour à l'application" }));
    expect(await screen.findByText('Accueil de l’application')).toBeInTheDocument();
  });

  it('déconnecte l’administrateur', async () => {
    renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(mocks.logoutAdmin).toHaveBeenCalledOnce();
    expect(await screen.findByText('Connexion administrateur')).toBeInTheDocument();
  });
});
