import { fulfilmentIcon, fulfilmentLabel, fulfilmentsOf } from '../lib/fulfilment';
import { DEALS, getDeal } from '../model/catalog';
import type { Deal } from '../model/schema';

const base = (over: Partial<Deal> = {}): Deal => ({ ...getDeal('d_cote')!, ...over });

describe('mode de retrait — CDC V1.0 §3.1 et §4.2', () => {
  it('accepte les deux modes quand l’offre ne dit rien', () => {
    // Absent ≠ inconnu : la majorité des offres acceptent les deux, et exiger
    // le champ partout n’apprendrait rien à personne.
    expect(fulfilmentsOf(base({ fulfilments: undefined }))).toEqual(['touch-collect', 'livraison']);
    expect(fulfilmentLabel(base({ fulfilments: undefined }))).toBe('Touch & Collect ou livraison');
  });

  it('respecte une offre qui ne se retire que sur place', () => {
    const d = base({ fulfilments: ['touch-collect'] });
    expect(fulfilmentsOf(d)).toEqual(['touch-collect']);
    expect(fulfilmentLabel(d)).toBe('Touch & Collect');
    expect(fulfilmentIcon(d)).toBe('shopping-bag');
  });

  it('respecte une offre livrée uniquement', () => {
    const d = base({ fulfilments: ['livraison'] });
    expect(fulfilmentLabel(d)).toBe('Livraison');
    expect(fulfilmentIcon(d)).toBe('truck');
  });

  it('lit toujours « Touch & Collect » en premier, quel que soit l’ordre de saisie', () => {
    // Sinon la même offre se lirait « Livraison ou Touch & Collect » selon
    // l’ordre dans lequel le commerçant a coché les cases.
    expect(fulfilmentsOf(base({ fulfilments: ['livraison', 'touch-collect'] }))).toEqual([
      'touch-collect',
      'livraison',
    ]);
  });
});

describe('le catalogue ne promet pas l’impossible', () => {
  it('ne propose la livraison sur aucune prestation à consommer sur place', () => {
    // Une place de cinéma, une piste de bowling ou une révision auto ne se
    // livrent pas. Promettre la livraison serait un mensonge affiché sur la
    // carte, corrigé au panier — trop tard.
    for (const id of ['d_cinema', 'd_cine_duo', 'd_bowling', 'd_poterie', 'd_revision']) {
      const deal = getDeal(id);
      expect(deal).toBeDefined();
      expect(fulfilmentsOf(deal!)).toEqual(['touch-collect']);
    }
  });

  it('donne un mode de retrait lisible à CHAQUE offre', () => {
    // Le CDC §3.1 en fait l’une des neuf informations obligatoires de la carte.
    for (const deal of DEALS) {
      expect(fulfilmentLabel(deal).length).toBeGreaterThan(0);
      expect(fulfilmentsOf(deal).length).toBeGreaterThan(0);
    }
  });
});
