// Avant : `const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';`
// était réécrit dans presque chaque page. Centralisé ici.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Le backend sert aussi des fichiers statiques (avatars, documents) en
// dehors du préfixe /api. Construit l'URL complète à partir d'un chemin
// relatif renvoyé par le serveur (ex: "/uploads/avatars/xxx.jpg").
export const assetUrl = (path: string): string =>
  path.startsWith('http') ? path : `${API_URL.replace('/api', '')}${path}`;