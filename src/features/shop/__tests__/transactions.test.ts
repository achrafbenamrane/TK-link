import { orderToTransaction, producesReceipt } from '../lib/transactions';
import { DEALS } from '../model/catalog';
import type { Order } from '../model/schema';

const deal = DEALS[0]!;

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o_1',
  createdAt: Date.now(),
  addressId: null,
  items: [{ dealId: deal.id, title: deal.title, emoji: deal.emoji, qty: 2, price: 9.5 }],
  total: 19,
  discount: 0,
  couponCode: null,
  deliveryFee: 0,
  fulfilment: 'click-collect',
  status: 'recuperee',
  pointsEarned: 19,
  managed: false,
  ...over,
});

describe('quelles commandes produisent un ticket — CDC §14', () => {
  it('celles réellement honorées, et elles seules', () => {
    expect(producesReceipt(order({ status: 'recuperee' }))).toBe(true);
    expect(producesReceipt(order({ status: 'livree' }))).toBe(true);
  });

  it('ni les annulations, ni les remboursements, ni ce qui est en cours', () => {
    // Un remboursement qui peuplerait la comptabilité du commerçant serait un
    // faux en écriture, pas un détail d'affichage.
    for (const status of ['annulee', 'remboursee', 'preparation', 'prete', 'payee'] as const) {
      expect(producesReceipt(order({ status }))).toBe(false);
    }
  });
});

describe('commande → transaction', () => {
  it('reprend les lignes, en centimes entiers', () => {
    const t = orderToTransaction(order());

    expect(t.orderId).toBe('o_1');
    expect(t.lines).toEqual([{ label: deal.title, qty: 2, unitCents: 950 }]);
    expect(t.channel).toBe('online');
  });

  it('nomme l’enseigne du catalogue', () => {
    expect(orderToTransaction(order()).merchant.length).toBeGreaterThan(0);
  });

  it('ne prétend pas connaître l’enseigne d’une offre publiée dans l’app', () => {
    const t = orderToTransaction(
      order({ items: [{ dealId: 'pub_xyz', title: 'Invendus', emoji: '🥐', qty: 1, price: 5 }] }),
    );
    expect(t.merchant).toBe('Commerçant TK LINK');
    expect(t.category).toBe('autre');
  });

  it('la livraison est une LIGNE, pas un supplément invisible', () => {
    const t = orderToTransaction(order({ deliveryFee: 2.9 }));
    expect(t.lines).toContainEqual({ label: 'Livraison', qty: 1, unitCents: 290 });
  });

  it('la remise s’inscrit en négatif, sous son code', () => {
    const t = orderToTransaction(order({ discount: 3, couponCode: 'BIENVENUE' }));
    expect(t.lines).toContainEqual({ label: 'Remise BIENVENUE', qty: 1, unitCents: -300 });
  });

  it('le total du ticket retombe TOUJOURS sur ce qui a été payé', () => {
    // L'invariant qui rend un ticket opposable : la somme de ses lignes doit
    // égaler le montant réglé, livraison et remise comprises.
    //
    // La commande respecte ici la règle de la caisse — `total` vaut le
    // sous-total MOINS la remise (19 € d'articles, 3 € de remise, donc 16 €).
    const o = order({ total: 16, discount: 3, couponCode: 'BIENVENUE', deliveryFee: 2.9 });
    const t = orderToTransaction(o);

    const sum = t.lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
    expect(sum).toBe(Math.round((o.total + o.deliveryFee) * 100));
  });
});
