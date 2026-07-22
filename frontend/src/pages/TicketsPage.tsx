import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Ticket, Plus, Trash2, ArrowRight, Search, Plane, Clock, AlertCircle, X, CheckCircle } from 'lucide-react';

interface SavedTicket {
  id: number;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  price: number;
  currency: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface FlightOffer {
  id: string;
  airline: string;
  airlineLogo: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  arrivalDate: string;
  duration: string;
  stops: number;
  cabinClass: string;
  price: number;
  currency: string;
  expiresAt: string;
}

export default function TicketsPage() {
  const { t } = useTranslation();
  const api = useApi();
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'search'>('mine');

  // Recherche
  const [searchForm, setSearchForm] = useState({
    name: '', origin: '', destination: '', date: '', passengers: 1, cabinClass: 'economy',
  });
  const [results, setResults] = useState<FlightOffer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await api.get('/tickets');
      setTickets(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setResults([]);
    setSearching(true);
    try {
      const data = await api.post('/tickets/search', searchForm);
      setResults(Array.isArray(data) ? data : []);
      if (!data.length) setSearchError(t('tkt_no_result'));
    } catch (err: any) {
      setSearchError(err.message || 'Erreur lors de la recherche');
    } finally { setSearching(false); }
  };

  const handleSave = async (flight: FlightOffer) => {
    setSaving(flight.id);
    try {
      await api.post('/tickets', {
        passengerName: searchForm.name,
        flightNumber:  flight.flightNumber,
        airline:       flight.airline,
        origin:        flight.origin,
        destination:   flight.destination,
        departureDate: flight.departureDate,
        arrivalDate:   flight.arrivalDate,
        price:         flight.price,
        currency:      flight.currency,
      });
      setSaved(flight.id);
      setTimeout(() => setSaved(null), 2000);
      await load();
    } finally { setSaving(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce billet ?')) return;
    await api.del(`/tickets/${id}`);
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  const formatDate = (dt: string) => {
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
  };

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(price);
    } catch { return `${price} ${currency}`; }
  };

  const statusBadge = (status: string) => {
    if (status === 'upcoming') return <span className="badge-orange text-xs">À venir</span>;
    if (status === 'completed') return <span className="badge-green text-xs">Terminé</span>;
    if (status === 'cancelled') return <span className="badge-red text-xs">Annulé</span>;
    return <span className="badge-gray text-xs">{status}</span>;
  };

  const upcoming = tickets.filter(t => t.status === 'upcoming');
  const past = tickets.filter(t => t.status !== 'upcoming');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
          <Ticket size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Billets de vol</h1>
          <p className="text-xs text-gray-400">{upcoming.length} à venir</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-8 pt-4 pb-0">
        {[
          { key: 'mine', label: t('tkt_mine'), icon: Ticket },
          { key: 'search', label: t('tkt_search'), icon: Search },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-8 py-5 space-y-5">

        {/* ─── MES BILLETS ─── */}
        {tab === 'mine' && (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                <Plane size={24} className="text-orange-300" />
              </div>
              <p className="text-sm text-gray-400">Aucun billet enregistré</p>
              <button onClick={() => setTab('search')} className="mt-3 text-orange-500 text-sm hover:underline">
                Rechercher un vol
              </button>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">À venir</h2>
                  <div className="space-y-3">
                    {upcoming.map(t => (
                      <div key={t.id} className="card hover:border-orange-100 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                {t.origin}
                                <ArrowRight size={14} className="text-orange-400" />
                                {t.destination}
                              </span>
                              {statusBadge(t.status)}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                              {t.flightNumber && <span className="font-mono font-medium text-gray-700">{t.flightNumber}</span>}
                              {t.airline && <span>{t.airline}</span>}
                              {t.departureDate && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} className="text-orange-400" />
                                  {formatDate(t.departureDate)}
                                </span>
                              )}
                              {t.price > 0 && (
                                <span className="font-semibold text-gray-700">{formatPrice(t.price, t.currency)}</span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => handleDelete(t.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Historique</h2>
                  <div className="space-y-2">
                    {past.map(t => (
                      <div key={t.id} className="card opacity-60 hover:opacity-80 transition-opacity">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-700">
                                {t.origin} → {t.destination}
                              </span>
                              {statusBadge(t.status)}
                            </div>
                            <p className="text-xs text-gray-400">{t.flightNumber} · {formatDate(t.departureDate)}</p>
                          </div>
                          <button onClick={() => handleDelete(t.id)}
                            className="p-2 text-gray-200 hover:text-red-400 rounded-xl transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        )}

        {/* ─── RECHERCHE ─── */}
        {tab === 'search' && (
          <div className="space-y-5">
            <form onSubmit={handleSearch} className="card border-orange-100 bg-orange-50/30 space-y-3">
              <h3 className="text-sm font-medium text-gray-800">Recherche de vols</h3>
              <p className="text-xs text-gray-400">Codes IATA aéroport ou ville (ex : CDG, JFK, NYC)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Nom du passager</label>
                  <input type="text" placeholder="ex : Jean Dupont"
                    value={searchForm.name}
                    onChange={e => setSearchForm({ ...searchForm, name: e.target.value })}
                    className="input-field" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Origine</label>
                  <input type="text" placeholder="ex : CDG"
                    value={searchForm.origin}
                    onChange={e => setSearchForm({ ...searchForm, origin: e.target.value.toUpperCase() })}
                    className="input-field uppercase font-mono tracking-widest" required maxLength={3} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Destination</label>
                  <input type="text" placeholder="ex : JFK"
                    value={searchForm.destination}
                    onChange={e => setSearchForm({ ...searchForm, destination: e.target.value.toUpperCase() })}
                    className="input-field uppercase font-mono tracking-widest" required maxLength={3} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date de départ</label>
                  <input type="date" value={searchForm.date}
                    onChange={e => setSearchForm({ ...searchForm, date: e.target.value })}
                    className="input-field" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Passagers</label>
                  <input type="number" min={1} max={9} value={searchForm.passengers}
                    onChange={e => setSearchForm({ ...searchForm, passengers: parseInt(e.target.value) || 1 })}
                    className="input-field" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Classe</label>
                  <select value={searchForm.cabinClass}
                    onChange={e => setSearchForm({ ...searchForm, cabinClass: e.target.value })}
                    className="input-field">
                    <option value="economy">Économique</option>
                    <option value="premium_economy">Premium économique</option>
                    <option value="business">Affaires</option>
                    <option value="first">Première</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={searching}
                className="btn-primary flex items-center gap-2">
                {searching
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Search size={14} />}
                {searching ? t('tkt_searching') : t('tkt_search')}
              </button>
            </form>

            {searchError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                <AlertCircle size={14} />
                {searchError}
                <button onClick={() => setSearchError('')} className="ml-auto"><X size={13} /></button>
              </div>
            )}

            {results.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-3">{results.length} offre{results.length > 1 ? 's' : ''} trouvée{results.length > 1 ? 's' : ''} · triées par prix</p>
                <div className="space-y-3">
                  {results.map((f) => {
                    const isSaving = saving === f.id;
                    const isSaved = saved === f.id;
                    return (
                      <div key={f.id} className="card hover:border-orange-100 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-bold text-gray-900 flex items-center gap-2">
                                {f.origin}
                                <ArrowRight size={13} className="text-orange-400" />
                                {f.destination}
                              </span>
                              {f.flightNumber && (
                                <span className="font-mono text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">
                                  {f.flightNumber}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                f.stops === 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                              }`}>
                                {f.stops === 0 ? 'Direct' : `${f.stops} escale${f.stops > 1 ? 's' : ''}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                              {f.airline && <span>{f.airline}</span>}
                              {f.departureDate && (
                                <span className="flex items-center gap-1">
                                  <Plane size={10} className="text-orange-400" />
                                  Départ : {formatDate(f.departureDate)}
                                </span>
                              )}
                              {f.arrivalDate && <span>Arrivée : {formatDate(f.arrivalDate)}</span>}
                              {f.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} className="text-orange-400" />
                                  {f.duration}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className="text-base font-bold text-gray-900">{formatPrice(f.price, f.currency)}</span>
                            <button onClick={() => handleSave(f)} disabled={isSaving || isSaved}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                isSaved ? 'bg-green-50 text-green-600 border border-green-100' :
                                'btn-primary'
                              }`}>
                              {isSaving
                                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : isSaved ? <CheckCircle size={13} /> : <Plus size={13} />}
                              {isSaved ? t('tkt_saved') : t('tkt_save')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}