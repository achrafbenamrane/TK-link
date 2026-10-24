import { clientDeliveryFee, deliveryDistanceKm } from '../lib/delivery';

const pricing = { deliveryFeeEur: 3, courierPerKmEur: 0.8, courierBaseZoneKm: 3 };

describe('frais de livraison payés par le client', () => {
  it('le forfait dans la zone de base, 0,80 €/km au-delà', () => {
    expect(clientDeliveryFee(1, pricing)).toBe(3);
    expect(clientDeliveryFee(3, pricing)).toBe(3);
    expect(clientDeliveryFee(8, pricing)).toBe(7);
    // Arrondi au centime : 3 + 0,45 km × 0,80 € = 3,36 €.
    expect(clientDeliveryFee(3.45, pricing)).toBe(3.36);
  });

  it('distance inconnue ou zone retirée : le forfait seul, jamais de majoration inventée', () => {
    expect(clientDeliveryFee(null, pricing)).toBe(3);
    expect(clientDeliveryFee(12, { ...pricing, courierBaseZoneKm: null })).toBe(3);
  });

  it('applique le même barème que le gain du livreur (3 € + 0,80 €/km au-delà de 3 km)', () => {
    // Le test miroir côté livreur (`courierGain`) pose les mêmes chiffres : 12 km → 10,20 €.
    expect(clientDeliveryFee(12, pricing)).toBe(10.2);
    expect(clientDeliveryFee(2, pricing)).toBe(3);
  });

  it('la distance n’existe que si on connaît les deux points', () => {
    const shop = { lat: 43.6053, lng: 1.4478 };
    expect(deliveryDistanceKm(shop, null)).toBeNull();
    expect(deliveryDistanceKm(undefined, shop)).toBeNull();
    expect(deliveryDistanceKm(shop, { lat: 43.6773, lng: 1.4478 })).toBeCloseTo(8, 0);
  });
});
