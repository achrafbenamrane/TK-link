import {
  NBSP,
  endsAt,
  formatDuration,
  minutesOfDay,
  screeningDetails,
  screeningLabel,
  sortByShowtime,
} from '../lib/screening';
import { DEALS } from '../model/catalog';
import type { Deal, Screening } from '../model/schema';

const seance: Screening = {
  film: 'Le Grand Bleu',
  startsAt: '20:15',
  durationMin: 168,
  genre: 'Aventure',
  version: 'VF',
  room: 'Salle 3',
  audience: 'Tous publics',
};

describe('formatDuration', () => {
  it('écrit les heures et les minutes comme un cinéma les écrit', () => {
    // NBSP et non une espace ordinaire : le chiffre et son unité ne doivent
    // pas se séparer en fin de ligne. Comparé via la constante, jamais tapé —
    // les deux chaînes seraient identiques à l'œil en cas d'erreur.
    expect(formatDuration(168)).toBe(`2${NBSP}h 48`);
    expect(formatDuration(120)).toBe(`2${NBSP}h`);
    expect(formatDuration(48)).toBe('48 min');
  });

  it('garde les minutes sur deux chiffres — « 2 h 5 » se lit mal', () => {
    expect(formatDuration(125)).toBe(`2${NBSP}h 05`);
  });
});

describe('minutesOfDay', () => {
  it('lit une heure sur 24 h', () => {
    expect(minutesOfDay('20:15')).toBe(1215);
    expect(minutesOfDay('00:00')).toBe(0);
  });

  it('refuse ce qui n’est pas une heure plutôt que d’inventer un horaire', () => {
    expect(minutesOfDay('ce soir')).toBeNull();
    expect(minutesOfDay('25:00')).toBeNull();
    expect(minutesOfDay('20:75')).toBeNull();
  });
});

describe('endsAt', () => {
  it('donne l’heure de fin de la séance', () => {
    expect(endsAt(seance)).toBe('23:03');
  });

  it('repasse par minuit sans produire « 25:30 »', () => {
    // Une séance tardive qui déborde sur le lendemain : le cas qu'on ne voit
    // jamais en développement et qui saute aux yeux du premier spectateur.
    expect(endsAt({ ...seance, startsAt: '22:30', durationMin: 180 })).toBe('01:30');
  });

  it('ne calcule rien à partir d’une heure illisible', () => {
    expect(endsAt({ ...seance, startsAt: 'plus tard' })).toBeNull();
  });
});

describe('screeningDetails', () => {
  it('assemble genre, durée, version et salle', () => {
    expect(screeningDetails(seance)).toBe(`Aventure · 2${NBSP}h 48 · VF · Salle 3 · Tous publics`);
  });

  it('ne laisse pas de séparateur orphelin quand un champ manque', () => {
    const nu: Screening = { film: 'X', startsAt: '18:00', durationMin: 90, genre: 'Drame' };
    expect(screeningDetails(nu)).toBe(`Drame · 1${NBSP}h 30`);
  });
});

describe('screeningLabel', () => {
  it('annonce le film et l’heure — une carte de cinéma sans ça est inutilisable sans les yeux', () => {
    expect(screeningLabel(seance)).toBe('Le Grand Bleu, séance de 20 h 15, fin vers 23 h 03');
  });
});

describe('sortByShowtime', () => {
  const deal = (id: string, startsAt?: string): Deal =>
    ({
      id,
      screening: startsAt ? { ...seance, startsAt } : undefined,
    }) as Deal;

  it('range les séances dans l’ordre de la soirée', () => {
    const ordered = sortByShowtime([deal('c', '22:30'), deal('a', '19:30'), deal('b', '20:15')]);
    expect(ordered.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('place ce qui n’a pas d’horaire à la fin, sans lui en inventer un', () => {
    const ordered = sortByShowtime([deal('sans'), deal('a', '19:30')]);
    expect(ordered.map((d) => d.id)).toEqual(['a', 'sans']);
  });
});

describe('la programmation du catalogue', () => {
  const screenings = DEALS.filter((d) => d.screening);

  it('présente plusieurs films, pas une seule séance', () => {
    // La demande du client : « pour le cinéma, présenter des films ». Une
    // programmation d'un seul titre n'est pas une programmation.
    const films = new Set(screenings.map((d) => d.screening!.film));
    expect(films.size).toBeGreaterThanOrEqual(3);
  });

  it('donne à chaque séance une heure lisible et une durée réelle', () => {
    for (const deal of screenings) {
      expect(minutesOfDay(deal.screening!.startsAt)).not.toBeNull();
      expect(deal.screening!.durationMin).toBeGreaterThan(0);
    }
  });

  it('n’attache une séance qu’à des sorties', () => {
    // Une côte de bœuf n'a pas d'horaire de projection : si le champ dérive
    // vers l'alimentaire, c'est que le modèle a été détourné.
    for (const deal of screenings) expect(deal.category).toBe('services');
  });
});
