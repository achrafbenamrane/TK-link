/**
 * Programmatic mirror of the Tailwind palette for the rare cases where a
 * color is needed outside className (e.g. native navigation options,
 * ActivityIndicator tint, tab bar).
 *
 * SOURCE OF TRUTH: tailwind.config.js — keep both in sync.
 * docs/conventions/design-system.md documents the sync rule.
 */
export const colors = {
  brand50: '#E8F7EC',
  brand100: '#C7EBD2',
  brand200: '#8FD5A8',
  brand500: '#0F8A4C',
  brand600: '#0B6C3B',
  brand700: '#08512C',
  forest: '#123A22',
  forestDeep: '#0B2415',
  lime: '#C3F53C',
  limeSoft: '#E6FBAE',
  limeDeep: '#7F9E14',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F7F0',
  surfaceSunken: '#E6EFE3',
  surfaceInverse: '#123A22',
  ink: '#0F1A12',
  inkMuted: '#4D5B50',
  inkFaint: '#84927F',
  inkInverse: '#F2F7F0',
  line: '#DCE6D7',
  danger: '#DC2626',
  success: '#16A34A',
} as const;
