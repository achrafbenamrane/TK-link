import {
  discountPct,
  endsAt,
  isLive,
  liveOffers,
  secondsLeft,
  soldCents,
  startOf,
  STATE_LABEL,
  stateOf,
} from '../lib/offers';
import {
  DURATIONS,
  FLASH_MAX_MINUTES,
  FLASH_MIN_MINUTES,
  OfferDraftSchema,
  type PublishedOffer,
} from '../model/schema';
import { useMerchantStore } from '../model/store';

const NOW = new Date(2026, 7, 10, 12).getTime();

const offer = (over: Partial<PublishedOffer> = {}): PublishedOffer => ({
  id: 'o1',
  title: 'Plateau de viennoiseries',
  category: 'restauration',
  startsAt: 0,
  state: 'publiee',
  priceCents: 900,
  oldPriceCents: 1800,
  stock: 10,
  stockLeft: 10,
  durationMinutes: 60,
  description: '',
  publishedAt: NOW,
  offline: false,
  audience: 'clients',
  photoUri: '',
  modes: ['touch-collect', 'livraison'],
  seller: '',
  minQty: 1,
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

  it('ne vend aucun pack : la tarification n’est pas arrêtée', () => {
    expect(useMerchantStore.getState()).not.toHaveProperty('buyPack');
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

/**
 * LE CYCLE DE VIE DU §4.1 — les deux états qui manquaient.
 *
 * Le CDC en décrit six : brouillon, planifiée, active, épuisée, expirée,
 * annulée. Le code n'en connaissait que quatre : tout commençait à la
 * publication, et « publier ou programmer » (§4.2, étape 8) n'existait pas.
 */
describe('cycle de vie — CDC §4.1 et §4.2', () => {
  it('un brouillon n’est jamais en ligne, quelle que soit l’heure', () => {
    const o = offer({ state: 'brouillon' });
    expect(stateOf(o, NOW)).toBe('brouillon');
    expect(isLive(o, NOW)).toBe(false);
    // Même avec du stock et du temps devant lui : il n'a pas été publié.
    expect(liveOffers([o], NOW)).toEqual([]);
  });

  it('une offre programmée attend son heure', () => {
    const demain = NOW + 24 * 3600 * 1000;
    const o = offer({ startsAt: demain });
    expect(stateOf(o, NOW)).toBe('planifiee');
    expect(isLive(o, NOW)).toBe(false);
    // Et elle s'ouvre toute seule le moment venu.
    expect(stateOf(o, demain + 1000)).toBe('en-ligne');
  });

  it('fait courir la durée depuis le DÉBUT, pas depuis la création', () => {
    const demain = NOW + 24 * 3600 * 1000;
    // Une heure de vente, programmée pour demain : elle finit demain + 1 h.
    const o = offer({ startsAt: demain, durationMinutes: 60 });
    expect(endsAt(o)).toBe(demain + 60 * 60_000);
    // Sans cela, une offre programmée naîtrait déjà expirée.
    expect(stateOf(o, demain + 30 * 60_000)).toBe('en-ligne');
  });

  it('compte à rebours vers l’OUVERTURE tant qu’elle n’a pas commencé', () => {
    const dans2h = NOW + 2 * 3600 * 1000;
    const o = offer({ startsAt: dans2h });
    // Le commerçant veut savoir quand ça part, pas quand ça finit.
    expect(secondsLeft(o, NOW)).toBe(2 * 3600);
  });

  it('ne rallume jamais une offre retirée, même programmée', () => {
    // Le retrait est une DÉCISION : aucun horaire ne doit la contredire.
    const o = offer({ startsAt: NOW - 1000, offline: true });
    expect(stateOf(o, NOW)).toBe('retiree');
  });

  it('garde le comportement des offres d’avant la programmation', () => {
    // `startsAt: 0` — celles déjà enregistrées sur les téléphones. Elles
    // démarrent à leur publication, exactement comme avant.
    const o = offer({ startsAt: 0 });
    expect(startOf(o)).toBe(o.publishedAt);
    expect(stateOf(o, NOW)).toBe('en-ligne');
  });

  it('a un libellé pour chacun des six états', () => {
    for (const etat of [
      'brouillon',
      'planifiee',
      'en-ligne',
      'epuisee',
      'terminee',
      'retiree',
    ] as const) {
      expect(STATE_LABEL[etat].length).toBeGreaterThan(0);
    }
  });
});

describe('publier ou programmer — le quota', () => {
  beforeEach(() => {
    useMerchantStore.setState({ offers: [], used: 0, purchased: 0 });
  });

  const brouillon = {
    title: 'Panier surprise',
    category: 'restauration' as const,
    priceCents: 500,
    oldPriceCents: 1200,
    stock: 10,
    durationMinutes: 60,
  };

  it('n’entame pas le quota pour un brouillon', () => {
    const avant = useMerchantStore.getState().used;
    const r = useMerchantStore.getState().publish({ ...brouillon, state: 'brouillon' });
    expect(r.ok).toBe(true);
    // Enregistrer une idée n'est pas la publier.
    expect(useMerchantStore.getState().used).toBe(avant);
  });

  it('laisse enregistrer un brouillon même quota épuisé', () => {
    useMerchantStore.setState({ used: 99, purchased: 0 });
    const r = useMerchantStore.getState().publish({ ...brouillon, state: 'brouillon' });
    expect(r.ok).toBe(true);
    // Alors qu'une publication, elle, est refusée.
    const p = useMerchantStore.getState().publish(brouillon);
    expect(p.ok).toBe(false);
  });

  it('entame le quota pour une offre programmée — elle SERA publiée', () => {
    const avant = useMerchantStore.getState().used;
    const r = useMerchantStore.getState().publish({ ...brouillon, startInMinutes: 60 });
    expect(r.ok).toBe(true);
    expect(useMerchantStore.getState().used).toBe(avant + 1);
  });
});

describe('durée d’un Flash — CDC V1.1 (15 min à 2 h)', () => {
  const draft = (durationMinutes: number, audience: 'clients' | 'commercants' = 'clients') => ({
    title: 'Pain du soir',
    category: 'restauration' as const,
    priceCents: 300,
    oldPriceCents: 600,
    stock: 10,
    durationMinutes,
    audience,
  });

  it('accepte les bornes et ce qui est entre elles', () => {
    for (const m of [15, 30, 60, 120]) {
      expect(OfferDraftSchema.safeParse(draft(m)).success).toBe(true);
    }
  });

  it('refuse moins de 15 minutes et plus de 2 heures pour un Flash commerçant', () => {
    expect(OfferDraftSchema.safeParse(draft(10)).success).toBe(false);
    expect(OfferDraftSchema.safeParse(draft(121)).success).toBe(false);
    expect(OfferDraftSchema.safeParse(draft(240)).success).toBe(false);
  });

  it('n’invente aucune borne pour une offre B2B (le CDC n’en fixe pas)', () => {
    expect(OfferDraftSchema.safeParse(draft(240, 'commercants')).success).toBe(true);
  });

  it('ne propose que des durées dans les bornes', () => {
    expect(Math.max(...DURATIONS)).toBe(FLASH_MAX_MINUTES);
    expect(Math.min(...DURATIONS)).toBe(FLASH_MIN_MINUTES);
  });
});
