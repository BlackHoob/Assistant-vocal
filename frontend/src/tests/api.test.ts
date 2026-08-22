import { describe, expect, it } from 'vitest';
import { API_URL, assetUrl } from '../lib/api';

describe('Configuration centralisée de l’API', () => {
  it('expose une URL d’API exploitable', () => {
    expect(API_URL).toMatch(/^https?:\/\//);
  });

  it('construit l’URL complète d’un fichier statique', () => {
    expect(assetUrl('/uploads/avatar.jpg')).toBe(`${API_URL.replace('/api', '')}/uploads/avatar.jpg`);
  });

  it.each(['http://cdn.exemple.fr/image.png', 'https://cdn.exemple.fr/image.png'])('préserve une URL absolue : %s', url => {
    expect(assetUrl(url)).toBe(url);
  });
});
