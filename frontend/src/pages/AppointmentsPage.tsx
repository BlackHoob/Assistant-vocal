import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { triggerNotificationsRefresh } from '../hooks/useNotification';
import {
  Calendar, Trash2, MapPin, Clock, CheckCircle, XCircle,
  AlertCircle, Users, UserPlus, Hash, ChevronRight, User
} from 'lucide-react';

interface Appointment {
  id: number;
  title: string;
  description?: string;
  dateTime: string;
  location?: string;
  quantity?: number;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface WaitlistEntry {
  id: number;
  name: string;
  date: string;
  quantity: number;
  rank: number;
  total: number;
}

const AGENTS = ['M. Kouakou Nesto', 'Mme. Karime O', 'M. Malek S'];
const TYPE_OPTIONS = ['Prendre un billet', 'Consultation', 'Suivi', 'Urgence'];

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { user } = useAuth();

  const [tab, setTab] = useState<'upcoming' | 'past' | 'waitlist'>(
    () => (localStorage.getItem('nestor_waitlist_date') ? 'waitlist' : 'upcoming')
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire RDV
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', dateTime: '', quantity: '1', agent: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [checkingSlot, setCheckingSlot] = useState(false);

  // Liste d'attente — la date est mémorisée pour survivre à un changement de page
  const [waitlistDate, setWaitlistDate] = useState(() => localStorage.getItem('nestor_waitlist_date') || '');
  const [myWaitlist, setMyWaitlist] = useState<WaitlistEntry | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ name: user?.name || '', quantity: '1' });
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [justLeft, setJustLeft] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/appointments');
      setAppointments(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Pré-remplir le nom avec celui du compte
  useEffect(() => {
    if (user?.name) setWaitlistForm(f => ({ ...f, name: user.name }));
  }, [user]);

  // Charger la liste d'attente du jour sélectionné
  const loadMyWaitlist = (date: string) => {
    setWaitlistLoading(true);
    return api.get(`/appointments/waitlist/me?date=${date}`)
      .then(data => setMyWaitlist(data || null))
      .catch(() => setMyWaitlist(null))
      .finally(() => setWaitlistLoading(false));
  };

  useEffect(() => {
    if (!waitlistDate) return;
    loadMyWaitlist(waitlistDate);
  }, [waitlistDate]);

  // Mémorise la date choisie pour la retrouver si on quitte puis revient sur la page
  useEffect(() => {
    if (waitlistDate) localStorage.setItem('nestor_waitlist_date', waitlistDate);
    else localStorage.removeItem('nestor_waitlist_date');
  }, [waitlistDate]);

  // Vérification créneau
  const handleDateTimeChange = useCallback(async (value: string) => {
    setForm(f => ({ ...f, dateTime: value }));
    setError('');
    if (!value) return setTakenSlots([]);
    const date = value.split('T')[0];
    const time = value.split('T')[1]?.slice(0, 5);
    setCheckingSlot(true);
    try {
      const data = await api.get(`/appointments/taken?date=${date}`);
      setTakenSlots(data.takenSlots || []);
      if (time && data.takenSlots?.includes(time)) setError('Ce créneau est déjà réservé.');
    } catch { setTakenSlots([]); }
    finally { setCheckingSlot(false); }
  }, []);

  const selectedTime = form.dateTime ? form.dateTime.split('T')[1]?.slice(0, 5) : null;
  const isSlotTaken = selectedTime ? takenSlots.includes(selectedTime) : false;

  // Soumettre RDV
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSlotTaken) return setError('Ce créneau est déjà réservé.');
    setSubmitting(true); setError('');
    try {
      await api.post('/appointments', {
        title: form.title,
        description: form.description,
        dateTime: form.dateTime,
        quantity: parseInt(form.quantity) || 1,
        agent: form.agent,
      });
      setForm({ title: '', description: '', dateTime: '', quantity: '1', agent: '' });
      setTakenSlots([]);
      setShowForm(false);
      await load();
      triggerNotificationsRefresh(); // le RDV vient de générer une notif en base
    } catch (err: any) {
      setError(err.message?.includes('SLOT_TAKEN') ? 'Ce créneau vient d\'être pris.' : err.message || 'Erreur');
    } finally { setSubmitting(false); }
  };

  // Supprimer RDV
  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce rendez-vous ?')) return;
    await api.del(`/appointments/${id}`);
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  // Marquer terminé
  const handleStatus = async (id: number, status: string) => {
    await api.put(`/appointments/${id}`, { ...appointments.find(a => a.id === id), status });
    await load();
    triggerNotificationsRefresh(); // annulation/terminé génère aussi une notif
  };

  // S'inscrire sur la liste d'attente
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistDate) return;
    setWaitlistSubmitting(true); setWaitlistError('');
    try {
      const data = await api.post('/appointments/waitlist', {
        date: waitlistDate,
        name: waitlistForm.name,
        quantity: parseInt(waitlistForm.quantity) || 1,
      });
      if (data && data.id) {
        setMyWaitlist(data);
      } else {
        // Réponse inattendue du serveur : on revérifie l'état réel plutôt que de laisser l'écran figé
        await loadMyWaitlist(waitlistDate);
      }
      triggerNotificationsRefresh(); // l'inscription génère une notif
    } catch (err: any) {
      setWaitlistError(err.message?.includes('ALREADY_LISTED') ? 'Vous êtes déjà inscrit pour ce jour.' : err.message || "Erreur lors de l'inscription");
    } finally { setWaitlistSubmitting(false); }
  };

  // Quitter la liste
  const handleWaitlistLeave = async () => {
    if (!myWaitlist || !confirm('Quitter la liste d\'attente ?')) return;
    setWaitlistError('');
    try {
      await api.del(`/appointments/waitlist/${myWaitlist.id}`);
      setMyWaitlist(null);
      setJustLeft(true);
      setTimeout(() => setJustLeft(false), 3000);
    } catch (err: any) {
      // On ne vide pas l'état localement si la suppression a échoué côté serveur —
      // on revérifie plutôt la vraie position pour ne jamais désynchroniser l'affichage.
      setWaitlistError(err.message || "Erreur lors de la sortie de la liste. Réessayez.");
      await loadMyWaitlist(waitlistDate);
    }
  };

  const formatDate = (dt: string) => new Date(dt).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const formatTime = (dt: string) => new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const upcoming = appointments.filter(a => a.status === 'upcoming');
  const past     = appointments.filter(a => a.status !== 'upcoming');

  // Demain comme date min pour la liste
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 pt-6 pb-0 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
          <Calendar size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('apt_title')}</h1>
          <p className="text-xs text-gray-400">{upcoming.length} à venir</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 md:px-8 mt-5 border-b border-gray-100 flex-shrink-0">
        {[
          { key: 'upcoming', label: 'À venir',       icon: Clock   },
          { key: 'past',     label: 'Passés',         icon: Calendar },
          { key: 'waitlist', label: 'Liste d\'attente', icon: Users  },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setTab(key as any); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
              tab === key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 md:px-8 py-6 space-y-5">

        {/* ── ONGLET À VENIR ─────────────────────────────── */}
        {tab === 'upcoming' && (
          <>
            {/* Bouton prendre RDV */}
          
            {/* Formulaire RDV */}
            {showForm && (
              <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                {/* En-tête formulaire */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-4">
                  <h3 className="font-semibold text-white text-sm">Nouveau rendez-vous</h3>
                  <p className="text-orange-100 text-xs mt-0.5">Remplissez les informations ci-dessous</p>
                </div>

                <div className="p-5">
                  {error && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                      <AlertCircle size={15} className="flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type de RDV */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                        Type de rendez-vous
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {TYPE_OPTIONS.map(opt => (
                          <button key={opt} type="button"
                            onClick={() => setForm(f => ({ ...f, title: opt }))}
                            className={`px-3 py-2.5 rounded-xl text-xs font-medium text-left border transition-all ${
                              form.title === opt
                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-orange-200 hover:bg-orange-50'
                            }`}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Choix de l'agent */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                        Agent
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AGENTS.map(agent => (
                          <button key={agent} type="button"
                            onClick={() => setForm(f => ({ ...f, agent }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                              form.agent === agent
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-orange-200'
                            }`}>
                            <User size={11} />
                            {agent}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                        Description <span className="font-normal normal-case text-gray-400">(optionnel)</span>
                      </label>
                      <textarea value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="input-field resize-none w-full" rows={2}
                        placeholder="Précisez votre demande..." />
                    </div>

                    {/* Date + Nombre de personnes */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                          Date & Heure
                        </label>
                        <div className="relative">
                          <input type="datetime-local" required value={form.dateTime}
                            onChange={e => handleDateTimeChange(e.target.value)}
                            className={`input-field w-full pr-8 ${
                              isSlotTaken ? 'border-red-300 bg-red-50 text-red-700' :
                              form.dateTime && !isSlotTaken && selectedTime ? 'border-green-300 bg-green-50' : ''
                            }`} />
                          {checkingSlot && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
                            </div>
                          )}
                          {!checkingSlot && isSlotTaken && (
                            <XCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                          )}
                          {!checkingSlot && form.dateTime && !isSlotTaken && selectedTime && (
                            <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                          )}
                        </div>
                        {form.dateTime && selectedTime && (
                          <p className={`text-xs mt-1 flex items-center gap-1 ${isSlotTaken ? 'text-red-500' : 'text-green-600'}`}>
                            {isSlotTaken ? <><XCircle size={10} /> Créneau indisponible</> : <><CheckCircle size={10} /> Disponible</>}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                          Nb. de personnes
                        </label>
                        <input type="number" min="1" max="20" value={form.quantity}
                          onChange={e => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value)||1).toString() })}
                          className="input-field w-full" />
                      </div>
                    </div>

                    {/* Boutons */}
                    <div className="flex gap-3 pt-1">
                      <button type="submit" disabled={submitting || isSlotTaken || !form.title || !form.agent}
                        className="btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                        {submitting
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><CheckCircle size={14} /> Confirmer le rendez-vous</>}
                      </button>
                      <button type="button" onClick={() => { setShowForm(false); setError(''); setTakenSlots([]); }}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Liste des RDV à venir */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : upcoming.length === 0 && !showForm ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                  <Calendar size={28} className="text-orange-300" />
                </div>
                <p className="font-semibold text-gray-700 mb-1">Aucun rendez-vous à venir</p>
                <p className="text-sm text-gray-400 mb-5">Prenez votre premier rendez-vous en quelques clics</p>
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  Prendre un rendez-vous
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(apt => (
                  <div key={apt.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-100 transition-all shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3 flex-1 min-w-0">
                        {/* Icône type */}
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                          <Calendar size={18} className="text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-gray-900 text-sm">{apt.title}</h3>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-100">
                              <Clock size={10} /> À venir
                            </span>
                          </div>
                          {apt.description && <p className="text-xs text-gray-400 mb-2">{apt.description}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Calendar size={11} className="text-orange-400" />{formatDate(apt.dateTime)}</span>
                            <span className="flex items-center gap-1"><Clock size={11} className="text-orange-400" />{formatTime(apt.dateTime)}</span>
                            {apt.location && <span className="flex items-center gap-1"><User size={11} className="text-orange-400" />{apt.location}</span>}
                            {apt.quantity && apt.quantity > 1 && <span className="flex items-center gap-1"><Users size={11} className="text-orange-400" />{apt.quantity} personnes</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleStatus(apt.id, 'completed')}
                          className="p-2 text-gray-300 hover:text-green-500 hover:bg-green-50 rounded-xl transition-all" title="Marquer terminé">
                          <CheckCircle size={15} />
                        </button>
                        <button onClick={() => handleDelete(apt.id)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ONGLET PASSÉS ──────────────────────────────── */}
        {tab === 'past' && (
          past.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Clock size={28} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-700 mb-1">Aucun historique</p>
              <p className="text-sm text-gray-400">Vos rendez-vous passés apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {past.map(apt => {
                const isCompleted = apt.status === 'completed';
                return (
                  <div key={apt.id} className="bg-white border border-gray-100 rounded-2xl p-4 opacity-70 hover:opacity-90 transition-opacity">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-50' : 'bg-red-50'}`}>
                          {isCompleted
                            ? <CheckCircle size={18} className="text-green-500" />
                            : <XCircle size={18} className="text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-medium text-gray-700 text-sm truncate">{apt.title}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${
                              isCompleted ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'
                            }`}>
                              {isCompleted ? 'Terminé' : 'Annulé'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400">{formatDate(apt.dateTime)} · {formatTime(apt.dateTime)}</p>
                          {apt.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><User size={10} />{apt.location}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(apt.id)}
                        className="p-2 text-gray-200 hover:text-red-400 rounded-xl transition-colors flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── ONGLET LISTE D'ATTENTE ──────────────────────── */}
        {tab === 'waitlist' && (
          <div className="space-y-5">
            {/* Sélection du jour */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                Choisir un jour
              </label>
              <input type="date" min={tomorrowStr} value={waitlistDate}
                onChange={e => { setWaitlistDate(e.target.value); setWaitlistError(''); setMyWaitlist(null); setJustLeft(false); }}
                className="input-field w-full sm:w-64" />
            </div>

            {waitlistDate && (
              <>
                {justLeft && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-600 text-sm rounded-xl border border-green-100">
                    <CheckCircle size={15} className="flex-shrink-0" />
                    Vous avez quitté la liste d'attente. Vous pouvez vous réinscrire à tout moment.
                  </div>
                )}
                {waitlistError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    {waitlistError}
                  </div>
                )}
                {waitlistLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : myWaitlist ? (
                  /* ── Ma position dans la liste ── */
                  <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-4">
                      <p className="text-orange-100 text-xs font-medium">Votre position</p>
                      <p className="text-white font-bold text-2xl mt-0.5">
                        #{myWaitlist.rank}
                        <span className="text-orange-200 text-sm font-normal ml-2">sur {myWaitlist.total}</span>
                      </p>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <User size={16} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400">Nom</p>
                          <p className="text-sm font-medium text-gray-800">{myWaitlist.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Calendar size={16} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400">Jour</p>
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(waitlistDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Users size={16} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400">Nombre de personnes devant vous</p>
                          <p className="text-sm font-medium text-gray-800">
                            {myWaitlist.rank - 1 === 0 ? 'Aucune — vous êtes le premier !' : `${myWaitlist.rank - 1} personne${myWaitlist.rank - 1 > 1 ? 's' : ''}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Hash size={16} className="text-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-400">Votre groupe</p>
                          <p className="text-sm font-medium text-gray-800">{myWaitlist.quantity} personne{myWaitlist.quantity > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <button onClick={handleWaitlistLeave}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 bg-red-50 text-red-500 border border-red-100 rounded-xl text-sm font-medium hover:bg-red-100 transition-all">
                        <XCircle size={15} />
                        Quitter la liste
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Formulaire inscription ── */
                  <div className="bg-white border border-orange-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-4">
                      <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                        <UserPlus size={16} /> S'inscrire sur la liste
                      </h3>
                      <p className="text-orange-100 text-xs mt-0.5">
                        {new Date(waitlistDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>

                    <div className="p-5">
                      <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                            Votre nom
                          </label>
                          <div className="relative">
                            <input type="text" required value={waitlistForm.name}
                              onChange={e => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                              className="input-field w-full pl-9"
                              placeholder="Nom complet" />
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          </div>
                          {user?.name && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <CheckCircle size={10} className="text-green-500" />
                              Pré-rempli depuis votre compte — vous pouvez modifier
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                            Nombre de personnes
                          </label>
                          <input type="number" min="1" max="20" value={waitlistForm.quantity}
                            onChange={e => setWaitlistForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value)||1).toString() }))}
                            className="input-field w-full" />
                        </div>

                        <button type="submit" disabled={waitlistSubmitting}
                          className="btn-primary w-full flex items-center justify-center gap-2">
                          {waitlistSubmitting
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><UserPlus size={15} /> Confirmer mon inscription</>}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {!waitlistDate && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-orange-300" />
                </div>
                <p className="font-semibold text-gray-700 mb-1">Liste d'attente</p>
                <p className="text-sm text-gray-400">Sélectionnez un jour pour voir votre position</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}