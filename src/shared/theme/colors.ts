/**
 * Programmatic mirror of the Tailwind palette for the rare cases where a
 * color is needed outside className (e.g. native navigation options,
 * ActivityIndicator tint, tab bar).
 *
 * SOURCE OF TRUTH: tailwind.config.js — keep both in sync.
 * docs/conventions/design-system.md documents the sync rule.
 */
export const colors = {
  brand50: '#FEEDEA',
  brand100: '#FCD9D3',
  brand200: '#F9B4A8',
  brand500: '#F5311D',
  brand600: '#DC2410',
  brand700: '#B21C0D',
  surface: '#FFFFFF',
  surfaceMuted: '#F6F2EA',
  surfaceSunken: '#EFEAE0',
  surfaceInverse: '#17140F',
  ink: '#17140F',
  inkMuted: '#57524A',
  inkFaint: '#8F887C',
  inkInverse: '#F6F2EA',
  line: '#E7E2D8',
  danger: '#DC2626',
  success: '#16A34A',
} as const;
