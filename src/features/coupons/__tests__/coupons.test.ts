import {
  discountAmountCents,
  evaluatePromo,
  formatDiscount,
  generateCode,
  normalizeCode,
} from '../lib/coupons';
import { useCouponsStore } from '../model/store';
import type { HeldCoupon, PromoCode } from '../model/schema';

const NOW = 1_800_000_000_000;

const promo = (over: Partial<PromoCode> = {}): PromoCode => ({
  id: 'p1',
  code: 'NOEL2026',
  discount: { kind: 'amount', cents: 500 },
  label: '',
  createdAt: NOW - 1000,
  expiresAt: null,
  active: true,
  maxRedemptions: null,
  redeemedCount: 0,
  ...over,
});

const held = (code: string): HeldCoupon => ({
  id: 'h1',
  code,
  source: 'promo',
  discount: { kind: 'amount', cents: 500 },
  label: '',
  createdAt: NOW,
  usedAt: null,
});

describe('generateCode / normalizeCode', () => {
  it('évite les caractères ambigus (0 O 1 I)', () => {
    for (let i = 0; i < 40; i++) expect(generateCode()).not.toMatch(/[O01I]/);
  });

  it('normalise la saisie : majuscules, sans espaces', () => {
    expect(normalizeCode('  noel 2026 ')).toBe('NOEL2026');
  });
});

describe('formatDiscount / discountAmountCents', () => {
  it('formate montant et pourcentage', () => {
    expect(formatDiscount({ kind: 'amount', cents: 500 })).toBe('5,00 €');
    expect(formatDiscount({ kind: 'percent', pct: 20 })).toBe('-20 %');
  });

  it('un pourcentage s’applique au sous-total', () => {
    expect(discountAmountCents({ kind: 'percent', pct: 20 }, 5000)).toBe(1000);
  });

  // Une réduction ne rend jamais une commande négative.
  it('ne dépasse jamais le sous-total', () => {
    expect(discountAmountCents({ kind: 'amount', cents: 9999 }, 1200)).toBe(1200);
  });
});

describe('evaluatePromo', () => {
  it('accepte un code valide, insensible à la casse et aux espaces', () => {
    expect(evaluatePromo(' noel 2026 ', [promo()], [], NOW).ok).toBe(true);
  });

  it('refuse un code inconnu', () => {
    const r = evaluatePromo('ZZZZ', [promo()], [], NOW);
    expect(r).toEqual({ ok: false, reason: 'unknown' });
  });

  it('refuse un code désactivé par l’admin', () => {
    const r = evaluatePromo('NOEL2026', [promo({ active: false })], [], NOW);
    expect(r).toEqual({ ok: false, reason: 'inactive' });
  });

  it('refuse un code expiré', () => {
    const r = evaluatePromo('NOEL2026', [promo({ expiresAt: NOW - 1 })], [], NOW);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('accepte pile avant l’expiration', () => {
    expect(evaluatePromo('NOEL2026', [promo({ expiresAt: NOW + 1 })], [], NOW).ok).toBe(true);
  });

  // Une seule fois par personne : le code est déjà dans le portefeuille.
  it('refuse un code déjà réclamé par cet utilisateur', () => {
    const r = evaluatePromo('NOEL2026', [promo()], [held('NOEL2026')], NOW);
    expect(r).toEqual({ ok: false, reason: 'already_claimed' });
  });

  it('refuse quand le plafond global est atteint', () => {
    const r = evaluatePromo(
      'NOEL2026',
      [promo({ maxRedemptions: 50, redeemedCount: 50 })],
      [],
      NOW,
    );
    expect(r).toEqual({ ok: false, reason: 'cap_reached' });
  });
});

describe('store — source jeu', () => {
  beforeEach(() => useCouponsStore.setState({ wallet: [], promoCatalog: [] }));

  it('un gain de jeu crée un coupon personnel à usage unique', () => {
    const c = useCouponsStore.getState().grantEarnedCoupon({ kind: 'amount', cents: 300 }, 'Quiz');
    expect(c.source).toBe('game');
    expect(c.usedAt).toBeNull();
    expect(useCouponsStore.getState().wallet).toHaveLength(1);
  });

  it('consommer un coupon le marque une fois, pas deux', () => {
    const c = useCouponsStore.getState().grantEarnedCoupon({ kind: 'amount', cents: 300 }, 'Quiz');
    useCouponsStore.getState().useCoupon(c.id);
    const first = useCouponsStore.getState().wallet[0]?.usedAt;
    useCouponsStore.getState().useCoupon(c.id);
    expect(useCouponsStore.getState().wallet[0]?.usedAt).toBe(first);
  });
});

describe('store — source admin / promo', () => {
  beforeEach(() =>
    useCouponsStore.setState({
      wallet: [],
      promoCatalog: [promo({ id: 'p1', code: 'NOEL2026' })],
    }),
  );

  it('réclamer un promo l’ajoute au portefeuille et incrémente le compteur', () => {
    const r = useCouponsStore.getState().redeemPromo('noel2026');
    expect(r.ok).toBe(true);
    expect(useCouponsStore.getState().wallet).toHaveLength(1);
    expect(useCouponsStore.getState().promoCatalog[0]?.redeemedCount).toBe(1);
  });

  it('le même utilisateur ne peut pas réclamer deux fois', () => {
    useCouponsStore.getState().redeemPromo('NOEL2026');
    const second = useCouponsStore.getState().redeemPromo('NOEL2026');
    expect(second).toEqual({ ok: false, reason: 'already_claimed' });
    expect(useCouponsStore.getState().promoCatalog[0]?.redeemedCount).toBe(1);
  });

  it('l’admin crée un code personnalisé unique', () => {
    const r = useCouponsStore.getState().createPromo({
      discount: { kind: 'percent', pct: 15 },
      code: 'ETE15',
      expiresAt: null,
      maxRedemptions: null,
    });
    expect(r.ok).toBe(true);
    expect(useCouponsStore.getState().promoCatalog.some((p) => p.code === 'ETE15')).toBe(true);
  });

  it('l’admin ne peut pas créer un code en double', () => {
    const r = useCouponsStore.getState().createPromo({
      discount: { kind: 'amount', cents: 100 },
      code: 'noel2026',
      expiresAt: null,
      maxRedemptions: null,
    });
    expect(r.ok).toBe(false);
  });

  it('désactiver un code le rend irréclamable dans la foulée', () => {
    useCouponsStore.getState().setPromoActive('p1', false);
    expect(useCouponsStore.getState().redeemPromo('NOEL2026')).toEqual({
      ok: false,
      reason: 'inactive',
    });
  });

  it('fixer une expiration passée coupe le code', () => {
    // Le store utilise Date.now() réel ; NOW est une constante figée. On date
    // donc l'expiration par rapport au temps réel, pas par rapport à NOW.
    useCouponsStore.getState().setPromoExpiry('p1', Date.now() - 1000);
    expect(useCouponsStore.getState().redeemPromo('NOEL2026').ok).toBe(false);
  });
});
