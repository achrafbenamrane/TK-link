/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */

/**
 * Les réglages du SERVEUR (migration 0022) vus du back-office : l'écran parle en %, en € et en
 * minutes ; le serveur garde des entiers (points de base, centimes). Une saisie que le serveur
 * refuserait est refusée ici, jamais arrondie en silence.
 */
type Def = { key: string; unit: string; scale: number; min: number; max: number };

const { SERVER_SETTINGS, toDisplay, parseInput } = require('../app/admin/server-settings') as {
  SERVER_SETTINGS: Def[];
  toDisplay: (def: Def, serverValue: unknown) => string;
  parseInput: (def: Def, raw: unknown) => { value?: number; error?: string };
};

const def = (key: string): Def => {
  const found = SERVER_SETTINGS.find((s) => s.key === key);
  if (!found) throw new Error(`réglage inconnu : ${key}`);
  return found;
};

describe('les réglages du serveur', () => {
  it('reprend exactement les clés et les bornes de admin_set_platform_setting (0022)', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const sql = fs.readFileSync(
      path.join(__dirname, '../../supabase/migrations/0022_platform_settings.sql'),
      'utf8',
    );
    for (const s of SERVER_SETTINGS) {
      const row = new RegExp(`\\('${s.key}', (\\d+), (\\d+)\\)`).exec(sql);
      expect(row).not.toBeNull();
      expect(Number(row?.[1])).toBe(s.min * s.scale);
      expect(Number(row?.[2])).toBe(s.max * s.scale);
    }
    // Aucune clé réglable côté serveur n'est oubliée par l'écran.
    const sqlKeys = [...sql.matchAll(/\('([a-z_]+)', \d+, \d+\)/g)].map((m) => m[1]);
    expect(sqlKeys.sort()).toEqual(SERVER_SETTINGS.map((s) => s.key).sort());
  });

  it('affiche la commission en % et le crédit en €, à la française', () => {
    expect(toDisplay(def('commission_bps'), 500)).toBe('5');
    expect(toDisplay(def('commission_bps'), 750)).toBe('7,5');
    expect(toDisplay(def('referral_credit_cents'), 500)).toBe('5');
    expect(toDisplay(def('referral_credit_cents'), 250)).toBe('2,5');
    expect(toDisplay(def('reservation_minutes'), 15)).toBe('15');
    expect(toDisplay(def('commission_bps'), null)).toBe('');
  });

  it('convertit la saisie vers l’entier du serveur, virgule comprise', () => {
    expect(parseInput(def('commission_bps'), '5')).toEqual({ value: 500 });
    expect(parseInput(def('commission_bps'), '7,5')).toEqual({ value: 750 });
    expect(parseInput(def('commission_bps'), ' 2.25 ')).toEqual({ value: 225 });
    expect(parseInput(def('referral_credit_cents'), '4,99')).toEqual({ value: 499 });
    expect(parseInput(def('reservation_minutes'), '20')).toEqual({ value: 20 });
  });

  it('refuse ce que le serveur refuserait', () => {
    expect(parseInput(def('commission_bps'), '31').error).toMatch(/Entre 0 et 30/);
    expect(parseInput(def('commission_bps'), '-1').error).toBeDefined();
    expect(parseInput(def('commission_bps'), '5,125').error).toMatch(/Deux décimales/);
    expect(parseInput(def('reservation_minutes'), '4').error).toMatch(/Entre 5 et 60/);
    expect(parseInput(def('reservation_minutes'), '12,5').error).toMatch(/entier/);
    expect(parseInput(def('max_pending_orders'), '').error).toBeDefined();
    expect(parseInput(def('ai_videos_per_day'), 'abc').error).toBeDefined();
  });
});
