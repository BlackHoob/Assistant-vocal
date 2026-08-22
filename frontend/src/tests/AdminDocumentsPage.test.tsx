import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ adminToken: 'jwt-admin' }) }));

import AdminDocumentsPage from '../pages/admin/AdminDocumentsPage';

const account = { id: 7, name: 'Elie Kouakou', email: 'elie@example.com' };
const receivedDocument = {
  id: 21,
  name: '[passport] passeport-elie.pdf',
  userId: 7,
  userName: 'Elie Kouakou',
  file_path: '/uploads/documents/passeport-elie.pdf',
  file_size: 2048,
  mime_type: 'application/pdf',
  sent_by_admin: false,
  created_at: '2026-08-20T10:00:00.000Z',
};
const sentDocument = {
  id: 22,
  name: 'visa',
  userId: 7,
  userName: 'Elie Kouakou',
  file_path: '/uploads/documents/visa.jpg',
  mime_type: 'image/jpeg',
  sent_by_admin: true,
  created_at: '2026-08-21T10:00:00.000Z',
};

async function chooseRecipient() {
  await userEvent.type(screen.getByPlaceholderText('Nom ou email...'), 'Elie{Enter}');
  await userEvent.click(await screen.findByRole('button', { name: /Elie Kouakou.*elie@example\.com/i }));
}

describe('AdminDocumentsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.del.mockReset();
    mocks.get.mockImplementation(async (url: string) => url.startsWith('/admin/users?')
      ? { users: [account] }
      : [receivedDocument, sentDocument]);
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sépare les documents reçus et les documents envoyés', async () => {
    render(<AdminDocumentsPage />);
    expect(await screen.findByText(/passeport-elie\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reçus des clients/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Envoyés par l'agence/i })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/documents?limit=100');
  });

  it('affiche les états vides si aucun document n’existe', async () => {
    mocks.get.mockResolvedValue([]);
    render(<AdminDocumentsPage />);
    expect(await screen.findByText('Aucun document reçu des clients')).toBeInTheDocument();
    expect(screen.getByText('Aucun document envoyé')).toBeInTheDocument();
  });

  it('exige la sélection d’un destinataire', async () => {
    render(<AdminDocumentsPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }));
    expect(screen.getByText('Sélectionnez un utilisateur')).toBeInTheDocument();
  });

  it('exige un fichier après la sélection du destinataire', async () => {
    render(<AdminDocumentsPage />);
    await chooseRecipient();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }));
    expect(screen.getByText('Sélectionnez un fichier')).toBeInTheDocument();
  });

  it('envoie un document, son type et son destinataire avec FormData', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const { container } = render(<AdminDocumentsPage />);
    await chooseRecipient();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'passport');
    const file = new File(['pdf'], 'passeport.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }));

    expect(await screen.findByText('Document envoyé')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/documents/send'), expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer jwt-admin' },
      body: expect.any(FormData),
    }));
    const formData = vi.mocked(fetch).mock.calls[0][1]!.body as FormData;
    expect(formData.get('userId')).toBe('7');
    expect(formData.get('type')).toBe('passport');
    expect(formData.get('file')).toBeInstanceOf(File);
  });

  it('affiche l’erreur lorsque le serveur refuse le document', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Fichier trop volumineux' }) } as Response);
    const { container } = render(<AdminDocumentsPage />);
    await chooseRecipient();
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['pdf'], 'passeport.pdf', { type: 'application/pdf' })] },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }));
    expect(await screen.findByText('Fichier trop volumineux')).toBeInTheDocument();
  });

  it('ouvre un aperçu PDF accessible et propose le téléchargement', async () => {
    render(<AdminDocumentsPage />);
    await userEvent.click(await screen.findByText(/passeport-elie\.pdf/i));
    const dialog = screen.getByRole('dialog', { name: 'Aperçu du document Passeport' });
    expect(within(dialog).getByTitle('[passport] passeport-elie.pdf')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Télécharger' })).toHaveAttribute('href', expect.stringContaining('/uploads/documents/passeport-elie.pdf'));
  });

  it('ouvre l’aperçu d’un document image', async () => {
    render(<AdminDocumentsPage />);
    await screen.findByText(/passeport-elie\.pdf/i);
    const sentHeading = screen.getByRole('heading', { name: /Envoyés par l'agence/i });
    const sentSection = sentHeading.parentElement!;
    await userEvent.click(within(sentSection).getByText('Visa'));
    expect(screen.getByRole('dialog', { name: 'Aperçu du document Visa' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'visa' })).toHaveAttribute('src', expect.stringContaining('/uploads/documents/visa.jpg'));
  });

  it('ferme l’aperçu avec le bouton accessible', async () => {
    render(<AdminDocumentsPage />);
    await userEvent.click(await screen.findByText(/passeport-elie\.pdf/i));
    await userEvent.click(screen.getByRole('button', { name: "Fermer l'aperçu" }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supprime un document depuis son aperçu après confirmation', async () => {
    render(<AdminDocumentsPage />);
    await userEvent.click(await screen.findByText(/passeport-elie\.pdf/i));
    const dialog = screen.getByRole('dialog', { name: 'Aperçu du document Passeport' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(mocks.del).toHaveBeenCalledWith('/admin/documents/21');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
