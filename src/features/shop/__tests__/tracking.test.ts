import { addressQuery } from '../lib/geocode';
import {
  courierPosition,
  deliveryProgress,
  DELIVERED_AFTER_S,
  minutesRemaining,
  pointAlong,
  SHIPPING_AFTER_S,
} from '../lib/tracking';
import type { Address, Coord, Order } from '../model/schema';

const NOW = 1_800_000_000_000;
const orderAgedBy = (seconds: number): Order => ({
  id: 'o_1',
  createdAt: NOW - seconds * 1000,
  addressId: 'a_1',
  items: [{ dealId: 'd_cote', title: 'Côte', emoji: '🥩', qty: 1, price: 24.9 }],
  total: 24.9,
  deliveryFee: 0,
  status: 'en_livraison',
  pointsEarned: 24,
});

/** Ligne droite est-ouest, segments de longueurs très différentes. */
const LINE: Coord[] = [
  { lat: 43.6, lng: 1.4 },
  { lat: 43.6, lng: 1.41 },
  { lat: 43.6, lng: 1.5 },
];

describe('deliveryProgress', () => {
  it('vaut 0 tant que la commande est en préparation', () => {
    expect(deliveryProgress(orderAgedBy(0), NOW)).toBe(0);
    expect(deliveryProgress(orderAgedBy(SHIPPING_AFTER_S), NOW)).toBe(0);
  });

  it('vaut 1 une fois le délai de livraison passé', () => {
    expect(deliveryProgress(orderAgedBy(DELIVERED_AFTER_S), NOW)).toBe(1);
    expect(deliveryProgress(orderAgedBy(DELIVERED_AFTER_S + 999), NOW)).toBe(1);
  });

  it('progresse à mi-course à la moitié du trajet', () => {
    const middle = (SHIPPING_AFTER_S + DELIVERED_AFTER_S) / 2;
    expect(deliveryProgress(orderAgedBy(middle), NOW)).toBeCloseTo(0.5, 5);
  });

  it('ne sort jamais de [0, 1]', () => {
    for (const s of [-100, 0, 30, 61, 150, 240, 10_000]) {
      const p = deliveryProgress(orderAgedBy(s), NOW);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('pointAlong', () => {
  it('rend les extrémités aux bornes', () => {
    expect(pointAlong(LINE, 0)).toEqual(LINE[0]);
    expect(pointAlong(LINE, 1)).toEqual(LINE[2]);
  });

  // Le cœur du sujet : à mi-parcours on doit être au milieu en DISTANCE, pas
  // au deuxième point sur trois. Interpoler sur l'index ferait ramper le
  // livreur dans les virages puis bondir sur les lignes droites.
  it('mesure en distance parcourue, pas en nombre de points', () => {
    const mid = pointAlong(LINE, 0.5);
    expect(mid?.lng).toBeCloseTo(1.45, 2);
    // le point d'index médian est à 1.41 : s'y retrouver signalerait le bug
    expect(Math.abs((mid?.lng ?? 0) - 1.41)).toBeGreaterThan(0.02);
  });

  it('progresse de façon monotone', () => {
    let previous = -Infinity;
    for (let t = 0; t <= 1; t += 0.1) {
      const p = pointAlong(LINE, t);
      expect(p?.lng ?? 0).toBeGreaterThanOrEqual(previous);
      previous = p?.lng ?? 0;
    }
  });

  it('ne casse pas sur une ligne vide ou à un seul point', () => {
    expect(pointAlong([], 0.5)).toBeNull();
    expect(pointAlong([LINE[0]!], 0.5)).toEqual(LINE[0]);
  });

  it('tolère un trajet de longueur nulle', () => {
    const same = [LINE[0]!, LINE[0]!];
    expect(pointAlong(same, 0.5)).toEqual(LINE[0]);
  });
});

describe('courierPosition', () => {
  it('est au départ tant que la course n’a pas commencé', () => {
    expect(courierPosition(orderAgedBy(10), LINE, NOW)).toEqual(LINE[0]);
  });

  it('est arrivé une fois le délai écoulé', () => {
    expect(courierPosition(orderAgedBy(DELIVERED_AFTER_S), LINE, NOW)).toEqual(LINE[2]);
  });

  it('renvoie null sans trajet', () => {
    expect(courierPosition(orderAgedBy(120), [], NOW)).toBeNull();
  });
});

describe('minutesRemaining', () => {
  it('ne descend jamais sous zéro', () => {
    expect(minutesRemaining(orderAgedBy(10_000), NOW)).toBe(0);
  });

  it('décroît avec le temps', () => {
    expect(minutesRemaining(orderAgedBy(0), NOW)).toBeGreaterThan(
      minutesRemaining(orderAgedBy(120), NOW),
    );
  });
});

describe('addressQuery', () => {
  it('assemble une adresse lisible par le géocodeur', () => {
    const a: Address = {
      id: 'a_1',
      label: 'Maison',
      street: '12 rue des Filatiers',
      zip: '31000',
      city: 'Toulouse',
      isDefault: true,
    };
    expect(addressQuery(a)).toBe('12 rue des Filatiers, 31000 Toulouse');
  });
});
