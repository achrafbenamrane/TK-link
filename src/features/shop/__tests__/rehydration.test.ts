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
 * d'achat `vouchers`, le `couponCode` des commandes, et la messagerie
 * (`conversations`, `messages`) que ni la V1.0 ni la V1.1 ne décrivent.
 */
describe('relecture d’un état enregistré AVANT le retrait des coupons et du solde global', () => {
  const legacy = {
    cart: [{ dealId: deal.id, qty: 1 }],
    favorites: [deal.id],
    points: 120,
    vouchers: [{ id: 'v1', code: 'ABCD-1234', value: 2, createdAt: 1, usedAt: null }],
    conversations: [{ id: 'c1', partnerId: 'support', lastReadMessageId: null }],
    messages: [
      {
        id: 'm1',
        conversation_id: 'c1',
        sender_id: 'moi',
        body: 'Bonjour',
        created_at: '2026-08-01T10:00:00.000Z',
      },
    ],
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
    expect(parsed).not.toHaveProperty('conversations');
    expect(parsed).not.toHaveProperty('messages');
  });
});

describe('commandes livrées à la position actuelle', () => {
  const base = {
    cart: [],
    favorites: [],
    orders: [
      {
        id: 'o_pos',
        createdAt: 1_700_000_000_000,
        addressId: 'position',
        position: { lat: 43.6, lng: 1.44 },
        items: [],
        total: 6.5,
        deliveryFee: 0,
        status: 'creee',
        pointsEarned: 7,
      },
    ],
  };

  it('relit la position de la commande et des adresses sans coordonnées', () => {
    const parsed = PersistedShopSchema.parse({
      ...base,
      addresses: [
        {
          id: 'a1',
          label: 'Maison',
          street: '12 rue X',
          zip: '31000',
          city: 'Toulouse',
          isDefault: true,
        },
      ],
    });
    expect(parsed.orders[0]?.position).toEqual({ lat: 43.6, lng: 1.44 });
    expect(parsed.addresses[0]?.lat).toBeUndefined();
  });

  it('rejette des coordonnées hors du globe plutôt que de les stocker', () => {
    const bad = { ...base, orders: [{ ...base.orders[0], position: { lat: 120, lng: 1 } }] };
    expect(PersistedShopSchema.safeParse(bad).success).toBe(false);
  });
});
