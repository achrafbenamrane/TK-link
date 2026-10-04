import { isHonoured, isMerchantOrder, summarizeOrder, toneOf } from '../lib/order-summary';
import { DEALS, LOCAL_MERCHANT_ID } from '../model/catalog';
import type { Order } from '../model/schema';

const order = (over: Partial<Order> = {}): Order => ({
  id: 'ord_abc123def',
  createdAt: 1,
  addressId: null,
  items: [{ dealId: 'd_cote', title: 'Côte de bœuf', emoji: '🥩', qty: 1, price: 24.9 }],
  total: 24.9,
  discount: 0,
  deliveryFee: 0,
  fulfilment: 'touch-collect',
  status: 'payee',
  pointsEarned: 25,
  managed: false,
  rating: null,
  issue: null,
  ...over,
});

describe('summarizeOrder — la commande vue du comptoir', () => {
  it('donne une référence lisible à voix haute, le mode et l’état', () => {
    const s = summarizeOrder(order());
    expect(s.ref).toBe('#TKL-123DEF');
    expect(s.title).toBe('Côte de bœuf');
    expect(s.modeLabel).toBe('Touch & Collect');
    expect(s.statusLabel).toBe('Payée');
    expect(s.totalCents).toBe(2490);
  });

  it('annonce les lignes en plus', () => {
    const extra = { dealId: 'd_pizza', title: 'Pizza', emoji: '🍕', qty: 1, price: 6.9 };
    expect(summarizeOrder(order({ items: [order().items[0]!, extra, extra] })).title).toBe(
      'Côte de bœuf +2',
    );
  });

  it('arrondit le total au centime, sans poussière flottante', () => {
    expect(summarizeOrder(order({ total: 19.92 })).totalCents).toBe(1992);
  });
});

describe('toneOf — ce que le commerçant a à faire', () => {
  it('une commande payée est à préparer : le paiement vaut acceptation (CDC V1.1)', () => {
    expect(toneOf('payee')).toBe('todo');
    expect(toneOf('acceptee')).toBe('todo');
  });

  it('en préparation ou en livraison : en cours', () => {
    expect(toneOf('preparation')).toBe('progress');
    expect(toneOf('en_livraison')).toBe('progress');
  });

  it('prête, remise, ou sortie du parcours : plus rien à préparer', () => {
    for (const s of ['prete', 'recuperee', 'livree', 'refusee', 'annulee', 'remboursee'] as const) {
      expect(toneOf(s)).toBe('done');
    }
  });
});

describe('isHonoured', () => {
  it('ne compte que ce que le client a récupéré ou reçu', () => {
    expect(isHonoured(order({ status: 'recuperee' }))).toBe(true);
    expect(isHonoured(order({ status: 'livree' }))).toBe(true);
    expect(isHonoured(order({ status: 'prete' }))).toBe(false);
    expect(isHonoured(order({ status: 'remboursee' }))).toBe(false);
  });
});

describe('isMerchantOrder — les commandes de CE commerce', () => {
  const line = (dealId: string) => ({ dealId, title: 'x', emoji: '🥖', qty: 1, price: 1 });

  it('reconnaît une vente publiée depuis l’app', () => {
    expect(isMerchantOrder(order({ items: [line('pub_abc')] }), new Set(['pub_abc']))).toBe(true);
  });

  it('reconnaît une offre de la boutique locale, et seulement elle', () => {
    const mine = DEALS.find((d) => d.merchantId === LOCAL_MERCHANT_ID)!;
    const other = DEALS.find((d) => d.merchantId !== LOCAL_MERCHANT_ID)!;
    expect(isMerchantOrder(order({ items: [line(mine.id)] }), new Set())).toBe(true);
    expect(isMerchantOrder(order({ items: [line(other.id)] }), new Set())).toBe(false);
  });

  it('une offre publiée par un autre ne compte pas', () => {
    expect(isMerchantOrder(order({ items: [line('pub_zzz')] }), new Set(['pub_abc']))).toBe(false);
  });
});
