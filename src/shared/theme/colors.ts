import palette from './palette.json';

/**
 * Les couleurs de TK LINK, en Jour et en Nuit.
 *
 * SOURCE UNIQUE : `palette.json`. Tailwind en tire ses classes (`bg-brand-500`,
 * `text-ink`…) sous forme de variables CSS ; ce module sert aux rares endroits
 * où une couleur est exigée HORS className — icône, indicateur d'activité,
 * barre d'onglets. Ceux-là passent par `useColors()` (theme-provider.tsx), qui
 * suit le mode choisi.
 */

export type ThemeScheme = 'day' | 'night';

type RawPalette = typeof palette.day;
export type Palette = { [K in keyof RawPalette]: string };

export const PALETTES: Record<ThemeScheme, Palette> = {
  day: palette.day,
  night: palette.night,
};

/** `#FF1478` → `255 20 120` : le format que Tailwind compose avec l'opacité. */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Le nom de la variable CSS portant un jeton (`brand500` → `--c-brand500`). */
export const cssVarName = (token: keyof Palette) => `--c-${token}` as const;

/** Toutes les variables d'un mode, prêtes pour `vars()` de NativeWind. */
export function cssVarsFor(scheme: ThemeScheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [token, hex] of Object.entries(PALETTES[scheme])) {
    out[cssVarName(token as keyof Palette)] = hexToRgbTriplet(hex);
  }
  return out;
}
