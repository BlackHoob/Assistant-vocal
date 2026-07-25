import { mergeMonthlySeries } from '../routes/admin';

describe('mergeMonthlySeries', () => {
  it('fusionne deux séries qui partagent les mêmes mois', () => {
    const appointments = [{ month: '2026-06', count: 5 }, { month: '2026-07', count: 3 }];
    const tickets = [{ month: '2026-06', count: 2 }, { month: '2026-07', count: 8 }];

    const result = mergeMonthlySeries(appointments, tickets, 'appointments', 'tickets');

    expect(result).toEqual([
      { month: '2026-06', appointments: 5, tickets: 2 },
      { month: '2026-07', appointments: 3, tickets: 8 },
    ]);
  });

  it('gère les mois présents dans une seule des deux séries', () => {
    const appointments = [{ month: '2026-06', count: 5 }];
    const tickets = [{ month: '2026-07', count: 8 }];

    const result = mergeMonthlySeries(appointments, tickets, 'appointments', 'tickets');

    expect(result).toEqual([
      { month: '2026-06', appointments: 5, tickets: 0 },
      { month: '2026-07', appointments: 0, tickets: 8 },
    ]);
  });

  it('trie le résultat par mois croissant', () => {
    const appointments = [{ month: '2026-08', count: 1 }, { month: '2026-06', count: 1 }];
    const tickets: { month: string; count: number }[] = [];

    const result = mergeMonthlySeries(appointments, tickets, 'appointments', 'tickets');

    expect(result.map(r => r.month)).toEqual(['2026-06', '2026-08']);
  });

  it('retourne un tableau vide si les deux séries sont vides', () => {
    expect(mergeMonthlySeries([], [], 'appointments', 'tickets')).toEqual([]);
  });
});
