import palette from '../palette.json';
import { cssVarName, cssVarsFor, hexToRgbTriplet, PALETTES } from '../colors';
import { resolveScheme } from '../theme-provider';

// `jest.requireActual` : le fichier est du JavaScript CommonJS, lu par Tailwind.
const tailwindConfig = jest.requireActual('../../../../tailwind.config.js');

/** Luminance relative WCAG 2 d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('palette — la charte du client (03/10/2026)', () => {
  it('porte les couleurs de la charte', () => {
    for (const mode of ['day', 'night'] as const) {
      expect(PALETTES[mode].brand500).toBe('#FF1478'); // rose : Flash, prix, appels à l’action
      expect(PALETTES[mode].accent).toBe('#00B2FF'); // bleu : localisation, infos
    }
    expect(PALETTES.night.success).toBe('#22C55E'); // vert : validé, confirmé
  });

  it('définit les mêmes jetons en Jour et en Nuit, tous au format #RRGGBB', () => {
    expect(Object.keys(palette.night).sort()).toEqual(Object.keys(palette.day).sort());
    for (const mode of ['day', 'night'] as const) {
      for (const [token, hex] of Object.entries(PALETTES[mode])) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(token.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('lisibilité — dans les deux modes', () => {
  it.each(['day', 'night'] as const)('le texte reste lisible en %s (WCAG AA, 4,5:1)', (mode) => {
    const p = PALETTES[mode];
    expect(contrast(p.ink, p.surface)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.inkMuted, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.inkFaint, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.inkFaint, p.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    // Le texte d'accent posé sur le fond et sur sa pastille teintée.
    expect(contrast(p.brand600, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.brand600, p.brand50)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.danger, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.success, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accentDeep, p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('le blanc sur le rose de la charte passe pour du texte gras (3:1)', () => {
    // #FF1478 est la couleur imposée par le client ; ses boutons portent des
    // libellés gras, où le seuil WCAG est de 3:1.
    expect(contrast('#FFFFFF', PALETTES.night.brand500)).toBeGreaterThanOrEqual(3);
  });
});

describe('variables CSS', () => {
  it('convertit un hexadécimal en triplet RVB', () => {
    expect(hexToRgbTriplet('#FF1478')).toBe('255 20 120');
    expect(hexToRgbTriplet('#000000')).toBe('0 0 0');
  });

  it('expose un jeton par variable, dans chaque mode', () => {
    for (const mode of ['day', 'night'] as const) {
      const vars = cssVarsFor(mode);
      for (const token of Object.keys(PALETTES[mode])) {
        expect(vars[cssVarName(token as keyof typeof PALETTES.day)]).toMatch(/^\d+ \d+ \d+$/);
      }
    }
  });

  it('Tailwind ne référence que des jetons qui existent', () => {
    const used = new Set<string>();
    const walk = (node: unknown) => {
      if (typeof node === 'string') {
        const m = node.match(/var\(--c-(\w+)\)/);
        if (m) used.add(m[1]!);
      } else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(tailwindConfig.theme.extend.colors);

    expect(used.size).toBeGreaterThan(10);
    for (const token of used) expect(palette.day).toHaveProperty(token);
  });
});

describe('resolveScheme — Nuit, Jour, ou le réglage du téléphone', () => {
  it('respecte un choix explicite', () => {
    expect(resolveScheme('night', 'light')).toBe('night');
    expect(resolveScheme('day', 'dark')).toBe('day');
  });

  it('suit le téléphone en mode système, et tombe sur la Nuit sans information', () => {
    expect(resolveScheme('system', 'light')).toBe('day');
    expect(resolveScheme('system', 'dark')).toBe('night');
    expect(resolveScheme('system', null)).toBe('night');
  });
});
