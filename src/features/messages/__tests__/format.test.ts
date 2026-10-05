import { preview, timeLabel } from '../lib/format';

// Dates construites en heure locale : les tests ne dépendent pas du fuseau.
const at = (month: number, day: number, h = 0, m = 0) =>
  new Date(2026, month - 1, day, h, m).getTime();

describe('timeLabel', () => {
  const now = at(10, 12, 18, 0);

  it('affiche l’heure pour aujourd’hui', () => {
    expect(timeLabel(at(10, 12, 14, 32), now)).toBe('14:32');
    expect(timeLabel(at(10, 12, 0, 5), now)).toBe('00:05');
  });

  it('affiche « Hier » pour la veille', () => {
    expect(timeLabel(at(10, 11, 23, 59), now)).toBe('Hier');
    expect(timeLabel(at(10, 11, 0, 0), now)).toBe('Hier');
  });

  it('affiche jj/mm au-delà', () => {
    expect(timeLabel(at(10, 10, 23, 59), now)).toBe('10/10');
    expect(timeLabel(at(1, 3, 9, 0), now)).toBe('03/01');
  });
});

describe('preview', () => {
  it('laisse un texte court intact et fusionne les espaces', () => {
    expect(preview('Bonjour')).toBe('Bonjour');
    expect(preview('Bonjour\n  à  tous')).toBe('Bonjour à tous');
  });

  it('tronque avec une ellipse', () => {
    const out = preview('a'.repeat(100), 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith('…')).toBe(true);
    expect(preview('a'.repeat(60))).toHaveLength(60);
  });
});
