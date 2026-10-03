/**
 * Design tokens — la charte du client (03/10/2026) : rose #FF1478 pour l'énergie
 * (Flash, prix, appels à l'action), bleu #00B2FF pour l'appui (localisation,
 * infos), vert #22C55E pour ce qui est validé. Deux modes, Nuit et Jour.
 *
 * Les VALEURS vivent dans `src/shared/theme/palette.json` ; ici on ne déclare
 * que des RÔLES, adossés à des variables CSS que le `ThemeProvider` redéfinit
 * selon le mode. `rgb(var(--c-x) / <alpha-value>)` garde les opacités (`bg-ink/10`).
 *
 * Display type et body type : Manrope.
 *
 * La règle et son contexte : docs/conventions/design-system.md
 *
 * @type {import('tailwindcss').Config}
 */
const v = (token) => `rgb(var(--c-${token}) / <alpha-value>)`;

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  // Mode Nuit / Jour choisi par l'utilisateur (maquettes du client, 03/10/2026) :
  // « class » permet de le basculer à la main, ce que « media » interdit.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: v('brand50'),
          100: v('brand100'),
          200: v('brand200'),
          500: v('brand500'),
          600: v('brand600'),
          700: v('brand700'),
          // Le socle du bouton 3D : plus profond que la calotte, dans les deux modes.
          deep: v('brandDeep'),
        },
        // Bleu électrique — appui : localisation, boutique, infos, navigation.
        accent: {
          DEFAULT: v('accent'),
          soft: v('accentSoft'),
          deep: v('accentDeep'),
        },
        surface: {
          DEFAULT: v('surface'),
          muted: v('surfaceMuted'),
          sunken: v('surfaceSunken'),
          inverse: v('surfaceInverse'),
        },
        ink: {
          DEFAULT: v('ink'),
          muted: v('inkMuted'),
          faint: v('inkFaint'),
          // Blanc dans les deux modes : le texte posé sur le rose ou sur un bloc sombre.
          inverse: v('inkInverse'),
        },
        line: v('line'),
        danger: v('danger'),
        success: v('success'),
      },
      fontFamily: {
        sans: ['Manrope_400Regular'],
        'sans-medium': ['Manrope_500Medium'],
        'sans-semibold': ['Manrope_600SemiBold'],
        'sans-bold': ['Manrope_700Bold'],
        display: ['Manrope_800ExtraBold'],
        'display-x': ['Manrope_800ExtraBold'],
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
