/**
 * Design tokens live HERE — this file is the single source of truth for
 * colors, spacing and typography used via className.
 *
 * Freedoo brand: warm paper + ink, one signal red, cream surfaces.
 * Display type is Unbounded; body/UI type is Manrope.
 *
 * If you need a token imperatively (rare), import it from
 * `src/shared/theme/colors.ts`, which mirrors this palette.
 * The "design-tokens" doc explains the sync rule:
 * docs/conventions/design-system.md
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FEEDEA',
          100: '#FCD9D3',
          200: '#F9B4A8',
          500: '#F5311D',
          600: '#DC2410',
          700: '#B21C0D',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F6F2EA',
          sunken: '#EFEAE0',
          inverse: '#17140F',
        },
        ink: {
          DEFAULT: '#17140F',
          muted: '#57524A',
          faint: '#8F887C',
          inverse: '#F6F2EA',
        },
        line: '#E7E2D8',
        danger: '#DC2626',
        success: '#16A34A',
      },
      fontFamily: {
        sans: ['Manrope_400Regular'],
        'sans-medium': ['Manrope_500Medium'],
        'sans-semibold': ['Manrope_600SemiBold'],
        'sans-bold': ['Manrope_700Bold'],
        display: ['Unbounded_700Bold'],
        'display-x': ['Unbounded_800ExtraBold'],
      },
      borderRadius: {
        card: '18px',
        control: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
