import { formatIsoDuration, mapDuffelOffer } from '../routes/tickets';

describe('formatIsoDuration', () => {
  it('formate une durée avec heures et minutes', () => {
    expect(formatIsoDuration('PT7H45M')).toBe('7h45');
  });

  it('formate une durée avec seulement des heures', () => {
    expect(formatIsoDuration('PT2H')).toBe('2h00');
  });

  it('formate une durée avec seulement des minutes', () => {
    expect(formatIsoDuration('PT45M')).toBe('45min');
  });

  it('retourne une chaîne vide si la durée est absente', () => {
    expect(formatIsoDuration(undefined)).toBe('');
  });

  it('retourne une chaîne vide si le format est invalide', () => {
    expect(formatIsoDuration('n\'importe quoi')).toBe('');
  });
});

describe('mapDuffelOffer', () => {
  const baseOffer = {
    id: 'off_123',
    owner: { name: 'Air France', logo_symbol_url: 'https://logo.png' },
    cabin_class: 'economy',
    total_amount: '245.50',
    total_currency: 'EUR',
    expires_at: '2026-08-01T10:00:00Z',
    slices: [{
      duration: 'PT7H45M',
      segments: [
        {
          origin: { iata_code: 'CDG' },
          destination: { iata_code: 'JFK' },
          departing_at: '2026-08-15T08:30:00',
          arriving_at: '2026-08-15T16:15:00',
          marketing_carrier: { iata_code: 'AF' },
          marketing_carrier_flight_number: '447',
        },
      ],
    }],
  };

  it('extrait correctement les champs principaux d\'une offre directe', () => {
    const result = mapDuffelOffer(baseOffer as any);
    expect(result).toMatchObject({
      id: 'off_123',
      airline: 'Air France',
      flightNumber: 'AF447',
      origin: 'CDG',
      destination: 'JFK',
      price: 245.5,
      currency: 'EUR',
      stops: 0,
      duration: '7h45',
    });
  });

  it('compte les escales à partir du nombre de segments', () => {
    const offerWithStop = {
      ...baseOffer,
      slices: [{
        ...baseOffer.slices[0],
        segments: [...baseOffer.slices[0].segments, { ...baseOffer.slices[0].segments[0] }],
      }],
    };
    expect(mapDuffelOffer(offerWithStop as any).stops).toBe(1);
  });

  it('gère une offre sans aucune donnée (valeurs par défaut sûres)', () => {
    const result = mapDuffelOffer({ id: 'off_empty' } as any);
    expect(result).toMatchObject({
      id: 'off_empty',
      airline: '',
      flightNumber: '',
      origin: '',
      destination: '',
      price: 0,
      currency: 'EUR',
      stops: 0,
    });
  });
});
