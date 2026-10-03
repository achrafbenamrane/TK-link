import { DEALS } from '../model/catalog';
import { PersistedShopSchema } from '../model/schema';

const deal = DEALS[0]!;

/**
 * Le piège de ce dépôt : un champ retiré du schéma ne doit JAMAIS faire échouer
 * la réhydratation. Le `merge` du store repartirait de zéro et effacerait le
 * panier, les commandes et les favoris des téléphones déjà installés (même
 * mécanique que « Click & Collect » et les rayons de recherche, le 16/08).
 *
 * Retirés le 03/10/2026 (CDC V1.1) : le solde global `points`, les bons
 * d'achat `vouchers` et le `couponCode` des commandes.
 */
describe('relecture d’un état enregistré AVANT le retrait des coupons et du solde global', () => {
  const legacy = {
    cart: [{ dealId: deal.id, qty: 1 }],
    favorites: [deal.id],
    points: 120,
    vouchers: [{ id: 'v1', code: 'ABCD-1234', value: 2, createdAt: 1, usedAt: null }],
    orders: [
      {
        id: 'o_1',
        createdAt: 1_700_000_000_000,
        addressId: null,
        items: [{ dealId: deal.id, title: deal.title, emoji: deal.emoji, qty: 1, price: 9.5 }],
        total: 6.5,
        discount: 3,
        couponCode: 'BIENVENUE',
        deliveryFee: 0,
        fulfilment: 'touch-collect',
        status: 'recuperee',
        pointsEarned: 7,
        managed: false,
      },
    ],
  };

  it('se relit sans erreur et garde le panier, les favoris et les commandes', () => {
    const parsed = PersistedShopSchema.safeParse(legacy);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.cart).toHaveLength(1);
    expect(parsed.data.favorites).toEqual([deal.id]);
    expect(parsed.data.orders).toHaveLength(1);
  });

  it('une commande à remise garde sa remise ; les champs retirés disparaissent', () => {
    const parsed = PersistedShopSchema.parse(legacy);

    expect(parsed.orders[0]?.discount).toBe(3);
    expect(parsed.orders[0]).not.toHaveProperty('couponCode');
    expect(parsed).not.toHaveProperty('points');
    expect(parsed).not.toHaveProperty('vouchers');
  });
});
