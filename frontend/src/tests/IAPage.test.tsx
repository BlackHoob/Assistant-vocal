import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 7, name: 'Elie Marc Kouakou' },
  refresh: vi.fn(),
  clipboard: vi.fn(),
  voice: {
    isRecording: false,
    isLoading: false,
    isSpeaking: false,
    speakingMsgId: null as number | null,
    startRecording: vi.fn(),
    stopAndTranscribe: vi.fn(),
    sendMessage: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('../hooks/useVoice', () => ({ useVoice: () => mocks.voice }));
vi.mock('../hooks/useNotification', () => ({ triggerNotificationsRefresh: mocks.refresh }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      ia_title: 'Assistant Nestor',
      ia_subtitle: 'Votre assistant de voyage',
      ia_placeholder: 'Écrivez votre message',
      ia_clear: 'Effacer la conversation',
      ia_recording: 'Enregistrement en cours',
      ia_orb_hint: 'Parlez à Nestor',
      ia_suggestion_flight: 'Chercher un vol',
      ia_suggestion_appointment: 'Prendre rendez-vous',
      ia_suggestion_documents: 'Voir mes documents',
      ia_suggestion_return: 'Organiser mon retour',
    } as Record<string, string>)[key] || key,
    i18n: { language: 'fr' },
  }),
}));

import IAPage from '../pages/IAPage';

function seedConversation(messages = [{ id: 1, role: 'assistant', content: 'Bonjour Elie' }]) {
  sessionStorage.setItem('nestor_chat', JSON.stringify(messages));
}

describe('IAPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mocks.refresh.mockReset();
    mocks.clipboard.mockReset();
    mocks.voice.isRecording = false;
    mocks.voice.isLoading = false;
    mocks.voice.isSpeaking = false;
    mocks.voice.speakingMsgId = null;
    mocks.voice.startRecording.mockReset();
    mocks.voice.stopAndTranscribe.mockReset();
    mocks.voice.sendMessage.mockReset();
    mocks.voice.speak.mockReset();
    mocks.voice.stopSpeaking.mockReset();
    mocks.voice.sendMessage.mockResolvedValue('Voici votre réponse');
    mocks.voice.speak.mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.clipboard },
    });
  });

  it('salue l’utilisateur et affiche les suggestions de démarrage', () => {
    render(<IAPage />);
    expect(screen.getByText('Elie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chercher un vol' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prendre rendez-vous' })).toBeInTheDocument();
  });

  it('envoie un message écrit avec Entrée et affiche la réponse', async () => {
    render(<IAPage />);
    await userEvent.type(screen.getByPlaceholderText('Écrivez votre message'), 'Vol pour Abidjan{Enter}');

    expect(await screen.findByText('Voici votre réponse')).toBeInTheDocument();
    expect(mocks.voice.sendMessage).toHaveBeenCalledWith([{ role: 'user', content: 'Vol pour Abidjan' }], 'fr');
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(JSON.parse(sessionStorage.getItem('nestor_chat')!)).toHaveLength(2);
  });

  it('envoie directement une suggestion sélectionnée', async () => {
    render(<IAPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Chercher un vol' }));
    expect(await screen.findByText('Voici votre réponse')).toBeInTheDocument();
    expect(mocks.voice.sendMessage).toHaveBeenCalledWith([{ role: 'user', content: 'Chercher un vol' }], 'fr');
  });

  it('restaure une conversation enregistrée dans la session', () => {
    seedConversation();
    render(<IAPage />);
    expect(screen.getByText('Bonjour Elie')).toBeInTheDocument();
    expect(screen.queryByText('Chercher un vol')).not.toBeInTheDocument();
  });

  it('repart sur une conversation vide si la session est corrompue', () => {
    sessionStorage.setItem('nestor_chat', 'json invalide');
    render(<IAPage />);
    expect(screen.getByRole('button', { name: 'Chercher un vol' })).toBeInTheDocument();
  });

  it('affiche une erreur lorsque l’assistant ne répond pas', async () => {
    mocks.voice.sendMessage.mockRejectedValue(new Error('Assistant indisponible'));
    render(<IAPage />);
    await userEvent.type(screen.getByPlaceholderText('Écrivez votre message'), 'Bonjour{Enter}');
    expect(await screen.findByText('Assistant indisponible')).toBeInTheDocument();
  });

  it('copie le contenu d’un message dans le presse-papiers', async () => {
    mocks.clipboard.mockResolvedValue(undefined);
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Copier'));
    expect(mocks.clipboard).toHaveBeenCalledWith('Bonjour Elie');
  });

  it('modifie puis enregistre un message existant', async () => {
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Modifier'));
    const textarea = screen.getByDisplayValue('Bonjour Elie');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Message corrigé');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Message corrigé')).toBeInTheDocument();
  });

  it('annule la modification d’un message', async () => {
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Modifier'));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Bonjour Elie')).toBeInTheDocument();
  });

  it('supprime un message individuel', async () => {
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Supprimer'));
    expect(screen.queryByText('Bonjour Elie')).not.toBeInTheDocument();
    expect(screen.getByText('Chercher un vol')).toBeInTheDocument();
  });

  it('efface toute la conversation', async () => {
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Effacer la conversation'));
    expect(screen.queryByText('Bonjour Elie')).not.toBeInTheDocument();
    expect(screen.getByText('Prendre rendez-vous')).toBeInTheDocument();
  });

  it('lit un message à voix haute', async () => {
    seedConversation();
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Écouter'));
    expect(mocks.voice.speak).toHaveBeenCalledWith('Bonjour Elie', 1);
  });

  it('active la lecture automatique de la prochaine réponse', async () => {
    render(<IAPage />);
    await userEvent.click(screen.getByTitle('Activer la voix auto'));
    await userEvent.type(screen.getByPlaceholderText('Écrivez votre message'), 'Bonjour{Enter}');
    await waitFor(() => expect(mocks.voice.speak).toHaveBeenCalledWith('Voici votre réponse', expect.any(Number)));
  });

  it('transcrit puis envoie un message vocal', async () => {
    mocks.voice.startRecording.mockResolvedValue('Réserve un billet');
    const { container } = render(<IAPage />);
    const input = screen.getByPlaceholderText('Écrivez votre message');
    const microphone = input.parentElement!.querySelector('button')!;
    fireEvent.click(microphone);
    await waitFor(() => expect(mocks.voice.sendMessage).toHaveBeenCalled());
    expect(await screen.findByText('Réserve un billet')).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  it('signale une absence de parole détectée', async () => {
    mocks.voice.startRecording.mockResolvedValue('   ');
    render(<IAPage />);
    const microphone = screen.getByPlaceholderText('Écrivez votre message').parentElement!.querySelector('button')!;
    await userEvent.click(microphone);
    expect(await screen.findByText('Aucune parole détectée. Réessayez.')).toBeInTheDocument();
  });

  it('arrête un enregistrement déjà en cours', async () => {
    mocks.voice.isRecording = true;
    mocks.voice.stopAndTranscribe.mockResolvedValue(undefined);
    render(<IAPage />);
    const microphone = screen.getByPlaceholderText('Enregistrement en cours').parentElement!.querySelector('button')!;
    await userEvent.click(microphone);
    expect(mocks.voice.stopAndTranscribe).toHaveBeenCalledOnce();
  });
});
