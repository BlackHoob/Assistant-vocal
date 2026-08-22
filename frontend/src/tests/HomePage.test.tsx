import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from '../pages/HomePage';

describe('HomePage', () => {
  it('présente le message d’accueil et l’agence de voyage', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Votre prochain voyage');
    expect(screen.getByText('Une agence de voyage, un vrai conseiller')).toBeInTheDocument();
  });

  it('affiche une image d’accueil accessible', () => {
    render(<HomePage />);
    expect(screen.getByRole('img', { name: /conseiller Selectour Alltour/i })).toHaveAttribute('src', '/img-accueil.avif');
  });

  it('présente les trois fonctionnalités principales de Nestor', () => {
    render(<HomePage />);
    expect(screen.getByText('Recherche de vols')).toBeInTheDocument();
    expect(screen.getByText('Rendez-vous en agence')).toBeInTheDocument();
    expect(screen.getByText('Toujours sous contrôle')).toBeInTheDocument();
  });
});
