import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Ticket, Plus, Trash2, Plane, Search, ArrowRight } from 'lucide-react';

interface TicketItem {
  id: number;
  flight_number?: string;
  airline?: string;
  origin: string;
  destination: string;
  departure_date?: string;
  arrival_date?: string;
  seat?: string;
  class?: string;
  price?: number;
  currency?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface FlightOffer {
  id: string;
  itineraries: any[];
  price: { total: string; currency: string };
  validatingAirlineCodes: string[];
}

export default function TicketsPage() {
  const api = useApi();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tickets' | 'search'>('tickets');
  const [searchForm, setSearchForm] = useState({ origin: '', destination: '', date: '', adults: '1' });
  const [searchResults, setSearchResults] = useState<FlightOffer[]>([]);
  const [searching, setSearching] = useState(false);
  const [addForm, setAddForm] = useState({ flight_number: '', airline: '', origin: '', destination: '', departure_date: '', arrival_date: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/tickets');
      setTickets(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setSearchResults([]);
    try {
      const results = await api.post('/tickets/search', searchForm);
      setSearchResults(results);
    } catch (err: any) {
      alert(err.message);
    } finally { setSearching(false); }
  };

  const handleSaveOffer = async (offer: FlightOffer) => {
    const seg = offer.itineraries[0]?.segments[0];
    await api.post('/tickets', {
      flight_number: seg?.carrierCode + seg?.number,
      airline: offer.validatingAirlineCodes?.[0],
      origin: seg?.departure?.iataCode,
      destination: seg?.arrival?.iataCode,
      departure_date: seg?.departure?.at,
      arrival_date: seg?.arrival?.at,
      price: parseFloat(offer.price.total),
      currency: offer.price.currency,
      amadeus_offer_id: offer.id,
    });
    await load();
    setTab('tickets');
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/tickets', addForm);
    setAddForm({ flight_number: '', airline: '', origin: '', destination: '', departure_date: '', arrival_date: '' });
    setShowAddForm(false);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce billet ?')) return;
    await api.del(`/tickets/${id}`);
    setTickets(prev => prev.filter(t => t.id !== id));
  };

  const upcoming = tickets.filter(t => t.status === 'upcoming');
  const past = tickets.filter(t => t.status !== 'upcoming');

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Ticket size={18} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Billets</h1>
            <p className="text-xs text-gray-400">{upcoming.length} vol{upcoming.length > 1 ? 's' : ''} à venir</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('search')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${tab === 'search' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>
            <Search size={14} /> Rechercher
          </button>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Manuel
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit">
          {['tickets', 'search'].map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {t === 'tickets' ? 'Mes billets' : 'Recherche vols'}
            </button>
          ))}
        </div>

        {tab === 'tickets' && (
          <>
            {showAddForm && (
              <div className="card border-orange-100 bg-orange-50/30">
                <h3 className="font-medium text-sm text-gray-800 mb-3">Ajouter un billet manuellement</h3>
                <form onSubmit={handleAddManual} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="N° de vol (ex: AF123)" value={addForm.flight_number}
                      onChange={e => setAddForm({ ...addForm, flight_number: e.target.value })}
                      className="input-field" />
                    <input placeholder="Compagnie" value={addForm.airline}
                      onChange={e => setAddForm({ ...addForm, airline: e.target.value })}
                      className="input-field" />
                    <input placeholder="Origine (IATA ex: CDG)" required value={addForm.origin}
                      onChange={e => setAddForm({ ...addForm, origin: e.target.value.toUpperCase() })}
                      className="input-field uppercase" />
                    <input placeholder="Destination (IATA ex: ABJ)" required value={addForm.destination}
                      onChange={e => setAddForm({ ...addForm, destination: e.target.value.toUpperCase() })}
                      className="input-field uppercase" />
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Départ</label>
                      <input type="datetime-local" value={addForm.departure_date}
                        onChange={e => setAddForm({ ...addForm, departure_date: e.target.value })}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Arrivée</label>
                      <input type="datetime-local" value={addForm.arrival_date}
                        onChange={e => setAddForm({ ...addForm, arrival_date: e.target.value })}
                        className="input-field" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary">Enregistrer</button>
                    <button type="button" onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-sm text-gray-500">Annuler</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">À venir</h2>
                    <div className="space-y-3">
                      {upcoming.map(t => (
                        <div key={t.id} className="card hover:border-orange-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                <Plane size={18} className="text-orange-500" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 font-semibold text-gray-900">
                                  <span>{t.origin}</span>
                                  <ArrowRight size={14} className="text-orange-400" />
                                  <span>{t.destination}</span>
                                  {t.flight_number && <span className="text-xs font-normal text-gray-400">{t.flight_number}</span>}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {t.departure_date && new Date(t.departure_date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                                  {t.price && ` · ${t.price} ${t.currency || 'EUR'}`}
                                  {t.airline && ` · ${t.airline}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="badge-orange text-xs">À venir</span>
                              <button onClick={() => handleDelete(t.id)}
                                className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
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
                        <div key={t.id} className="card opacity-60 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Plane size={16} className="text-gray-300" />
                            <div>
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                <span>{t.origin}</span><ArrowRight size={12} /><span>{t.destination}</span>
                              </div>
                              <p className="text-xs text-gray-400">
                                {t.departure_date && new Date(t.departure_date).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="badge-gray text-xs">Terminé</span>
                            <button onClick={() => handleDelete(t.id)}
                              className="p-1.5 text-gray-200 hover:text-red-400 rounded-lg transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tickets.length === 0 && !showAddForm && (
                  <div className="text-center py-20">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
                      <Plane size={24} className="text-orange-300" />
                    </div>
                    <p className="text-sm text-gray-400">Aucun billet enregistré</p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'search' && (
          <div className="space-y-5">
            <div className="card border-orange-100 bg-orange-50/30">
              <h3 className="font-medium text-sm text-gray-800 mb-4 flex items-center gap-2">
                <Search size={14} className="text-orange-500" /> Rechercher des vols (Amadeus)
              </h3>
              <form onSubmit={handleSearch} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Origine (IATA)</label>
                    <input required placeholder="CDG, ORY..." value={searchForm.origin}
                      onChange={e => setSearchForm({ ...searchForm, origin: e.target.value.toUpperCase() })}
                      className="input-field uppercase" maxLength={3} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Destination (IATA)</label>
                    <input required placeholder="ABJ, LAX..." value={searchForm.destination}
                      onChange={e => setSearchForm({ ...searchForm, destination: e.target.value.toUpperCase() })}
                      className="input-field uppercase" maxLength={3} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Date de départ</label>
                    <input type="date" required value={searchForm.date}
                      onChange={e => setSearchForm({ ...searchForm, date: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Passagers</label>
                    <select value={searchForm.adults}
                      onChange={e => setSearchForm({ ...searchForm, adults: e.target.value })}
                      className="input-field">
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} adulte{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={searching} className="btn-primary flex items-center gap-2">
                  {searching ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />}
                  {searching ? 'Recherche...' : 'Chercher des vols'}
                </button>
              </form>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{searchResults.length} résultats</h3>
                {searchResults.map((offer) => {
                  const seg = offer.itineraries[0]?.segments[0];
                  return (
                    <div key={offer.id} className="card hover:border-orange-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                            <Plane size={16} className="text-orange-500" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-2">
                              <span>{seg?.departure?.iataCode}</span>
                              <ArrowRight size={13} className="text-orange-400" />
                              <span>{seg?.arrival?.iataCode}</span>
                              <span className="text-xs font-normal text-gray-400">{offer.validatingAirlineCodes?.[0]}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {seg?.departure?.at && new Date(seg.departure.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-orange-500">{offer.price.total} {offer.price.currency}</div>
                          </div>
                          <button onClick={() => handleSaveOffer(offer)}
                            className="btn-primary text-xs px-3 py-2">
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults.length === 0 && !searching && (
              <div className="text-center py-10 text-sm text-gray-400">
                Entrez une origine, une destination et une date pour rechercher des vols
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
