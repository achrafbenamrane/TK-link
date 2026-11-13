import { cartDiscount } from '../lib/discount';

/**
 * Le crédit de parrainage dans le panier (CDC V1.1, migration 0019) : entier sur une commande
 * locale, borné à la commission de TK LINK sur une commande du serveur (Stripe « Direct charges »).
 */
const base = { credit: 0, serverCredit: 0, commissionPct: 5 };

it('commande locale : le crédit, borné aux articles', () => {
  expect(cartDiscount({ ...base, serverMode: false, subtotal: 24.9, credit: 5 })).toBe(5);
  expect(cartDiscount({ ...base, serverMode: false, subtotal: 3, credit: 5 })).toBe(3);
});

it('commande du serveur : borné à la commission, comme reserve_flash', () => {
  // 7,00 € d'articles : commission 0,35 € — le crédit de 5 € n'en couvre que 0,35 €.
  expect(cartDiscount({ ...base, serverMode: true, subtotal: 7, serverCredit: 5 })).toBe(0.35);
  // Il reste 0,10 € de crédit : c'est tout ce qui se déduit.
  expect(cartDiscount({ ...base, serverMode: true, subtotal: 7, serverCredit: 0.1 })).toBe(0.1);
  // 4,50 € : 22,5 centimes, arrondis à 23 comme Postgres.
  expect(cartDiscount({ ...base, serverMode: true, subtotal: 4.5, serverCredit: 5 })).toBe(0.23);
});

it('le crédit local ne sert jamais une commande du serveur', () => {
  expect(cartDiscount({ ...base, serverMode: true, subtotal: 7, credit: 5 })).toBe(0);
});
