/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */
import {
  MAX_PHOTOS,
  MAX_PRESENTATION,
  MAX_VIDEOS,
} from '../../src/features/merchant/lib/shop-profile';
import { MAX_TIERS } from '../../src/features/loyalty/lib/tiers';
import { RATING_TAGS } from '../../src/features/shop/lib/rating';
import { VIDEO_LIMITS } from '../../src/shared/lib/image-picker';
import { PLATFORM_SETTINGS } from '../../src/shared/lib/platform-settings';

/**
 * LES MIROIRS DU BACK-OFFICE WEB.
 *
 * Le site (`landing/`) recopie des règles de l'app : le web et l'app éditent les mêmes données et
 * doivent refuser les mêmes choses. Chaque copie porte un avertissement « MIROIR de… » ; ce fichier
 * transforme l'avertissement en test, pour qu'une dérive échoue ici au lieu de se découvrir chez
 * le client.
 */
const platform = require('../app/pro/platform') as {
  DEFAULT_SETTINGS: Record<string, number | null>;
  FIELDS: { key: string; nullable?: boolean; min: number; max: number; integer?: boolean }[];
  validateSettings: (inputs: Record<string, string>) => {
    ok: boolean;
    errors: Record<string, string>;
    values: Record<string, number | null>;
  };
  toInput: (v: number | null) => string;
};
const loyalty = require('../app/pro/loyalty') as {
  MAX_TIERS: number;
  validateTiers: (d: { cost: string; reward: string }[]) => (string | undefined)[];
};
const reviews = require('../app/pro/reviews') as {
  RATING_TAGS: string[];
  summarize: (r: [number, string[]][]) => {
    count: number;
    average: number;
    byStars: { stars: number; count: number }[];
    tags: { tag: string; count: number }[];
  };
};
const showcase = require('../app/pro/showcase') as {
  MAX_PHOTOS: number;
  MAX_VIDEOS: number;
  MAX_PRESENTATION: number;
  VIDEO_MAX_SECONDS: number;
  VIDEO_MAX_BYTES: number;
  normaliseTime: (v: string) => string;
  defaultHours: () => Record<string, { open: boolean }>;
  validateHours: (h: Record<string, unknown>) => Record<string, string>;
  videoRefusal: (file: { size: number }, seconds: number) => string | null;
};
const b2b = require('../app/pro/b2b') as {
  b2bTotals: (
    lots: { orders: number; lotsSold: number; grossCents: number }[],
    pct: number,
  ) => {
    orders: number;
    lotsSold: number;
    grossCents: number;
    commissionCents: number;
    netCents: number;
  };
};

describe('réglages de la plateforme — web = app', () => {
  it('les valeurs par défaut du web sont celles de l’app, y compris les « non arrêtées »', () => {
    expect(platform.DEFAULT_SETTINGS).toEqual({
      freeOperations: PLATFORM_SETTINGS.freeOperations,
      commissionB2cPct: PLATFORM_SETTINGS.commissionB2cPct,
      commissionB2bPct: PLATFORM_SETTINGS.commissionB2bPct,
      referralRewardEur: PLATFORM_SETTINGS.referralRewardEur,
      pointsPerEuro: PLATFORM_SETTINGS.pointsPerEuro,
      deliveryFeeEur: PLATFORM_SETTINGS.deliveryFeeEur,
      courierBaseFeeEur: PLATFORM_SETTINGS.courierBaseFeeEur,
      courierPerKmEur: PLATFORM_SETTINGS.courierPerKmEur,
      courierBaseZoneKm: PLATFORM_SETTINGS.courierBaseZoneKm,
      importantParcelMinEur: PLATFORM_SETTINGS.importantParcelMinEur,
      cartHoldSeconds: PLATFORM_SETTINGS.cartHoldSeconds,
    });
  });

  it('seuls les réglages que le CDC ne chiffrait pas peuvent être vidés (« à définir »)', () => {
    const nullable = platform.FIELDS.filter((f) => f.nullable)
      .map((f) => f.key)
      .sort();
    expect(nullable).toEqual(['cartHoldSeconds', 'courierBaseZoneKm', 'importantParcelMinEur']);
  });

  it('valide une saisie : virgule française, bornes, vide = « à définir »', () => {
    const inputs = Object.fromEntries(
      Object.entries(platform.DEFAULT_SETTINGS).map(([k, v]) => [k, platform.toInput(v)]),
    );
    expect(platform.validateSettings(inputs)).toMatchObject({ ok: true });
    expect(
      platform.validateSettings({ ...inputs, courierBaseZoneKm: '' }).values.courierBaseZoneKm,
    ).toBeNull();

    const r = platform.validateSettings({ ...inputs, courierPerKmEur: '0,9', freeOperations: '8' });
    expect(r.values).toMatchObject({ courierPerKmEur: 0.9, freeOperations: 8 });
  });

  it('refuse l’invalide, champ par champ', () => {
    const inputs = Object.fromEntries(
      Object.entries(platform.DEFAULT_SETTINGS).map(([k, v]) => [k, platform.toInput(v)]),
    );
    const r = platform.validateSettings({
      ...inputs,
      commissionB2cPct: 'abc',
      freeOperations: '2,5',
      commissionB2bPct: '99',
      pointsPerEuro: '',
    });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual([
      'commissionB2bPct',
      'commissionB2cPct',
      'freeOperations',
      'pointsPerEuro',
    ]);
  });
});

describe('fidélité — web = app', () => {
  it('au plus 4 paliers, comme l’app', () => {
    expect(loyalty.MAX_TIERS).toBe(MAX_TIERS);
  });

  it('exige des seuils croissants et une récompense', () => {
    const ok = [
      { cost: '20', reward: 'Café' },
      { cost: '60', reward: 'Menu' },
    ];
    expect(loyalty.validateTiers(ok).some(Boolean)).toBe(false);

    const bad = loyalty.validateTiers([
      { cost: '60', reward: 'Café' },
      { cost: '60', reward: 'Menu' },
      { cost: 'x', reward: 'Dessert' },
      { cost: '90', reward: ' ' },
    ]);
    expect(bad[0]).toBeUndefined();
    expect(bad[1]).toMatch(/supérieur/);
    expect(bad[2]).toMatch(/nombre de points/);
    expect(bad[3]).toMatch(/avantage/);
  });
});

describe('avis — web = app', () => {
  it('propose les mêmes tags que l’app', () => {
    expect(reviews.RATING_TAGS).toEqual([...RATING_TAGS]);
  });

  it('synthétise : moyenne, répartition, tags les plus cités', () => {
    const s = reviews.summarize([
      [5, ['Rapide', 'Produit frais']],
      [4, ['Rapide']],
      [3, []],
    ]);
    expect(s.count).toBe(3);
    expect(s.average).toBe(4);
    expect(s.byStars.find((b) => b.stars === 5)?.count).toBe(1);
    expect(s.tags[0]).toEqual({ tag: 'Rapide', count: 2 });
    expect(reviews.summarize([]).average).toBe(0);
  });
});

describe('vitrine — web = app', () => {
  it('mêmes limites que l’écran « Ma boutique »', () => {
    expect(showcase.MAX_PHOTOS).toBe(MAX_PHOTOS);
    expect(showcase.MAX_VIDEOS).toBe(MAX_VIDEOS);
    expect(showcase.MAX_PRESENTATION).toBe(MAX_PRESENTATION);
    expect(showcase.VIDEO_MAX_SECONDS).toBe(VIDEO_LIMITS.maxSeconds);
    expect(showcase.VIDEO_MAX_BYTES).toBe(VIDEO_LIMITS.maxMegabytes * 1024 * 1024);
  });

  it('refuse une vidéo trop lourde ou trop longue', () => {
    expect(showcase.videoRefusal({ size: 60 * 1024 * 1024 }, 10)).toMatch(/lourde/);
    expect(showcase.videoRefusal({ size: 1024 }, 45)).toMatch(/longue/);
    expect(showcase.videoRefusal({ size: 1024 }, 30)).toBeNull();
  });

  it('les horaires démarrent fermés, se normalisent et se valident', () => {
    const hours = showcase.defaultHours() as Record<
      string,
      { open: boolean; from: string; to: string }
    >;
    expect(Object.values(hours).every((h) => !h.open)).toBe(true);
    expect(showcase.normaliseTime('9h')).toBe('09:00');
    expect(showcase.normaliseTime('9:5')).toBe('09:05');
    expect(showcase.normaliseTime('18')).toBe('18:00');

    hours.lundi = { open: true, from: '18:00', to: '09:00' };
    hours.mardi = { open: true, from: '9h', to: '18:00' };
    expect(Object.keys(showcase.validateHours(hours)).sort()).toEqual(['lundi', 'mardi']);
  });
});

describe('tableau de bord du grossiste', () => {
  it('la commission se prélève une seule fois, le net se déduit', () => {
    const t = b2b.b2bTotals(
      [
        { orders: 2, lotsSold: 10, grossCents: 10_000 },
        { orders: 1, lotsSold: 3, grossCents: 5_000 },
      ],
      5,
    );
    expect(t).toEqual({
      orders: 3,
      lotsSold: 13,
      grossCents: 15_000,
      commissionCents: 750,
      netCents: 14_250,
    });
  });
});
