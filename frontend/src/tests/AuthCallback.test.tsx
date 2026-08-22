import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn(), setAuth: vi.fn() }));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ setAuth: mocks.setAuth }) }));
vi.mock('../hooks/useApi', () => ({ useApi: () => ({ post: mocks.post }) }));

import AuthCallback from '../pages/AuthCallback';

function renderCallback(query: string) {
  window.history.pushState({}, '', `/auth/callback${query}`);
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${query}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={<div>Connexion Google refusée</div>} />
        <Route path="/" element={<div>Accueil connecté</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthCallback', () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.setAuth.mockReset();
  });

  it('redirige vers la connexion si le code Google est absent', async () => {
    renderCallback('');
    expect(await screen.findByText('Connexion Google refusée')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('redirige vers la connexion lorsque Google renvoie une erreur', async () => {
    renderCallback('?error=access_denied');
    expect(await screen.findByText('Connexion Google refusée')).toBeInTheDocument();
  });

  it('échange le code Google puis initialise la session', async () => {
    const user = { id: 4, name: 'Elie' };
    mocks.post.mockResolvedValue({ token: 'jwt-google', user });
    renderCallback('?code=code-google');

    expect(await screen.findByText('Accueil connecté')).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledWith('/auth/google/exchange', { code: 'code-google' });
    expect(mocks.setAuth).toHaveBeenCalledWith('jwt-google', user);
  });

  it('redirige vers la connexion si l’échange échoue', async () => {
    mocks.post.mockRejectedValue(new Error('Google indisponible'));
    renderCallback('?code=code-invalide');
    await waitFor(() => expect(screen.getByText('Connexion Google refusée')).toBeInTheDocument());
  });
});
