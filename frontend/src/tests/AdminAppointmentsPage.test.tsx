import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('../hooks/useAdminApi', () => ({ useAdminApi: () => mocks }));

import AdminAppointmentsPage from '../pages/admin/AdminAppointmentsPage';

const appointment = {
  id: 12,
  title: 'Conseil voyage Abidjan',
  description: 'Préparer le dossier',
  userName: 'Elie Kouakou',
  dateTime: '2026-09-15T10:30:00.000Z',
  location: 'Agence Paris',
  status: 'upcoming',
};

describe('AdminAppointmentsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.put.mockReset();
    mocks.del.mockReset();
    mocks.get.mockResolvedValue({ appointments: [appointment], total: 1 });
    mocks.put.mockResolvedValue({});
    mocks.del.mockResolvedValue({});
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('charge et présente les rendez-vous administrés', async () => {
    render(<AdminAppointmentsPage />);
    expect(await screen.findByText('Conseil voyage Abidjan')).toBeInTheDocument();
    expect(screen.getByText('Elie Kouakou')).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/admin/appointments?limit=50');
  });

  it('affiche un état vide lorsque aucun rendez-vous n’existe', async () => {
    mocks.get.mockResolvedValue({ appointments: [], total: 0 });
    render(<AdminAppointmentsPage />);
    expect(await screen.findByText('Aucun rendez-vous')).toBeInTheDocument();
  });

  it('filtre les rendez-vous selon leur statut', async () => {
    render(<AdminAppointmentsPage />);
    await screen.findByText('Conseil voyage Abidjan');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'completed');
    expect(mocks.get).toHaveBeenCalledWith('/admin/appointments?limit=50&status=completed');
  });

  it('ouvre une fenêtre de modification accessible', async () => {
    render(<AdminAppointmentsPage />);
    await userEvent.click(await screen.findByTitle('Modifier'));
    const dialog = screen.getByRole('dialog', { name: 'Modifier le rendez-vous' });
    expect(within(dialog).getByDisplayValue('Conseil voyage Abidjan')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Fermer la fenêtre de modification' })).toBeInTheDocument();
  });

  it('enregistre les modifications du rendez-vous', async () => {
    render(<AdminAppointmentsPage />);
    await userEvent.click(await screen.findByTitle('Modifier'));
    const field = screen.getByDisplayValue('Conseil voyage Abidjan');
    await userEvent.clear(field);
    await userEvent.type(field, 'Conseil voyage Dakar');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(mocks.put).toHaveBeenCalledWith('/admin/appointments/12', expect.objectContaining({ title: 'Conseil voyage Dakar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('bloque un rendez-vous après confirmation', async () => {
    render(<AdminAppointmentsPage />);
    await userEvent.click(await screen.findByTitle('Bloquer'));
    expect(mocks.put).toHaveBeenCalledWith('/admin/appointments/12/block', {});
  });

  it('supprime un rendez-vous après confirmation', async () => {
    render(<AdminAppointmentsPage />);
    await userEvent.click(await screen.findByTitle('Supprimer'));
    expect(mocks.del).toHaveBeenCalledWith('/admin/appointments/12');
  });

  it('ne propose pas de bloquer un rendez-vous déjà annulé', async () => {
    mocks.get.mockResolvedValue({ appointments: [{ ...appointment, status: 'cancelled' }], total: 1 });
    render(<AdminAppointmentsPage />);
    expect(await screen.findByText('Annulé')).toBeInTheDocument();
    expect(screen.queryByTitle('Bloquer')).not.toBeInTheDocument();
  });
});
