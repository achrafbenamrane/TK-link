/**
 * Design tokens live HERE — this file is the single source of truth for
 * colors, spacing and typography used via className.
 *
 * TK LINK brand: le ticket papier disparaît — d'où le vert. Vert forêt du logo
 * pour les fonds sombres, vert vif pour l'action, citron pour l'accent (repris
 * de la vidéo de marque), surfaces papier très légèrement teintées de vert.
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
          50: '#E8F7EC',
          100: '#C7EBD2',
          200: '#8FD5A8',
          500: '#0F8A4C',
          600: '#0B6C3B',
          700: '#08512C',
        },
        // Vert forêt du logo — fonds sombres, cartes « affiche », en-têtes.
        forest: {
          DEFAULT: '#123A22',
          deep: '#0B2415',
        },
        // Citron TK — accent vif (jamais en texte sur fond clair : contraste trop faible).
        lime: {
          DEFAULT: '#C3F53C',
          soft: '#E6FBAE',
          deep: '#7F9E14',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F2F7F0',
          sunken: '#E6EFE3',
          inverse: '#123A22',
        },
        ink: {
          DEFAULT: '#0F1A12',
          muted: '#4D5B50',
          faint: '#84927F',
          inverse: '#F2F7F0',
        },
        line: '#DCE6D7',
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
