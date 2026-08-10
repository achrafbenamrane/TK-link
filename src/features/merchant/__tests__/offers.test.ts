import { discountPct, isLive, liveOffers, secondsLeft, soldCents, stateOf } from '../lib/offers';
import { OfferDraftSchema, type PublishedOffer } from '../model/schema';
import { useMerchantStore } from '../model/store';

const NOW = new Date(2026, 7, 10, 12).getTime();

const offer = (over: Partial<PublishedOffer> = {}): PublishedOffer => ({
  id: 'o1',
  title: 'Plateau de viennoiseries',
  category: 'restauration',
  priceCents: 900,
  oldPriceCents: 1800,
  stock: 10,
  stockLeft: 10,
  durationMinutes: 60,
  description: '',
  publishedAt: NOW,
  offline: false,
  audience: 'clients',
  seller: '',
  ...over,
});

describe('vie d’une offre', () => {
  it('est en ligne tant qu’il reste du temps ET du stock', () => {
    expect(stateOf(offer(), NOW + 60_000)).toBe('en-ligne');
    expect(isLive(offer(), NOW + 60_000)).toBe(true);
  });

  it('meurt par le stock', () => {
    expect(stateOf(offer({ stockLeft: 0 }), NOW)).toBe('epuisee');
  });

  it('meurt par le temps', () => {
    expect(stateOf(offer(), NOW + 61 * 60_000)).toBe('terminee');
  });

  it('un retrait manuel prime sur tout le reste', () => {
    expect(stateOf(offer({ offline: true, stockLeft: 0 }), NOW + 10 ** 9)).toBe('retiree');
  });

  it('le compte à rebours ne passe pas dans le négatif', () => {
    expect(secondsLeft(offer(), NOW + 10 ** 9)).toBe(0);
    expect(secondsLeft(offer(), NOW)).toBe(3600);
  });

  it('ne garde en ligne que ce qui l’est, du plus récent au plus ancien', () => {
    const a = offer({ id: 'a', publishedAt: NOW - 1000 });
    const b = offer({ id: 'b', publishedAt: NOW });
    const dead = offer({ id: 'c', offline: true });
    expect(liveOffers([a, b, dead], NOW).map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('calcule la remise et ce qui est vendu', () => {
    expect(discountPct(offer())).toBe(50);
    expect(discountPct(offer({ oldPriceCents: 900 }))).toBeNull();
    expect(soldCents(offer({ stockLeft: 4 }))).toBe(6 * 900);
  });
});

describe('brouillon d’offre', () => {
  const valid = {
    title: 'Plateau de viennoiseries',
    category: 'restauration' as const,
    priceCents: 900,
    oldPriceCents: 1800,
    stock: 10,
    durationMinutes: 60,
    description: '',
    audience: 'clients' as const,
  };

  it('accepte une offre bien formée', () => {
    expect(OfferDraftSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un prix flash supérieur au prix initial', () => {
    // Sans cette règle, on publierait une « promotion » plus chère que le
    // prix barré — l’erreur ne se voit qu’une fois en ligne.
    const r = OfferDraftSchema.safeParse({ ...valid, priceCents: 2000 });
    expect(r.success).toBe(false);
  });

  it('exige un titre, un prix et une quantité', () => {
    expect(OfferDraftSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(false);
    expect(OfferDraftSchema.safeParse({ ...valid, priceCents: 0 }).success).toBe(false);
    expect(OfferDraftSchema.safeParse({ ...valid, stock: 0 }).success).toBe(false);
  });
});

describe('store commerçant', () => {
  const draft = {
    title: 'Invendus du soir',
    category: 'restauration' as const,
    priceCents: 500,
    oldPriceCents: 1200,
    stock: 4,
    durationMinutes: 30,
    description: '',
    audience: 'clients' as const,
  };

  beforeEach(() => useMerchantStore.getState().resetDemo());

  it('publie et consomme une opération', () => {
    const r = useMerchantStore.getState().publish(draft, '', NOW);
    expect(r.ok).toBe(true);
    expect(useMerchantStore.getState().used).toBe(1);
    expect(useMerchantStore.getState().offers).toHaveLength(1);
    expect(useMerchantStore.getState().offers[0]!.stockLeft).toBe(4);
  });

  it('refuse la sixième publication — CDC §9', () => {
    for (let i = 0; i < 5; i++) useMerchantStore.getState().publish(draft, '', NOW);
    const r = useMerchantStore.getState().publish(draft, '', NOW);

    expect(r).toEqual({ ok: false, reason: 'quota' });
    // Rien n’est consommé sur un refus, sinon le compteur dériverait.
    expect(useMerchantStore.getState().used).toBe(5);
    expect(useMerchantStore.getState().offers).toHaveLength(5);
  });

  it('un pack débloque la suite', () => {
    for (let i = 0; i < 5; i++) useMerchantStore.getState().publish(draft, '', NOW);
    expect(useMerchantStore.getState().buyPack('pack_10')).toBe(true);
    expect(useMerchantStore.getState().publish(draft, '', NOW).ok).toBe(true);
  });

  it('ignore un pack inconnu', () => {
    expect(useMerchantStore.getState().buyPack('pack_fantome')).toBe(false);
    expect(useMerchantStore.getState().purchased).toBe(0);
  });

  it('retire une offre et décrémente un stock', () => {
    const r = useMerchantStore.getState().publish(draft, '', NOW);
    const id = r.ok ? r.offer.id : '';

    useMerchantStore.getState().sellOne(id);
    expect(useMerchantStore.getState().offers[0]!.stockLeft).toBe(3);

    useMerchantStore.getState().takeOffline(id);
    expect(useMerchantStore.getState().offers[0]!.offline).toBe(true);
  });

  it('un stock ne descend jamais sous zéro', () => {
    const r = useMerchantStore.getState().publish({ ...draft, stock: 1 }, '', NOW);
    const id = r.ok ? r.offer.id : '';
    useMerchantStore.getState().sellOne(id);
    useMerchantStore.getState().sellOne(id);
    expect(useMerchantStore.getState().offers[0]!.stockLeft).toBe(0);
  });
});
