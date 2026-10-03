import { vars } from 'nativewind';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { cssVarsFor, PALETTES, type Palette, type ThemeScheme } from './colors';
import { selectThemeMode, useThemeStore, type ThemeMode } from './theme-store';

/**
 * Le mode réellement affiché : « Nuit » ou « Jour ». `system` suit le téléphone.
 * Fonction pure, testée seule.
 */
export function resolveScheme(
  mode: ThemeMode,
  system: 'light' | 'dark' | 'unspecified' | null | undefined,
): ThemeScheme {
  if (mode === 'night' || mode === 'day') return mode;
  return system === 'light' ? 'day' : 'night';
}

type ThemeValue = { scheme: ThemeScheme; colors: Palette };

const ThemeContext = createContext<ThemeValue>({ scheme: 'night', colors: PALETTES.night });

/**
 * Pose les couleurs du mode choisi sur toute l'arborescence.
 *
 * Les classes (`bg-surface`, `text-ink`, `bg-brand-500`…) lisent des variables
 * CSS : les redéfinir ici, à la racine, repeint chaque écran sans qu'aucun ait
 * à connaître le mode. Seules les couleurs passées HORS className (icônes…)
 * lisent le contexte, via `useColors()`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore(selectThemeMode);
  const system = useColorScheme();
  const scheme = resolveScheme(mode, system);

  const value = useMemo<ThemeValue>(() => ({ scheme, colors: PALETTES[scheme] }), [scheme]);
  const themeVars = useMemo(() => vars(cssVarsFor(scheme)), [scheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View testID="theme-root" style={[{ flex: 1 }, themeVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/** Les couleurs du mode courant, pour ce qui ne passe pas par une classe. */
export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

/** « night » ou « day » — pour le style de la barre d'état, par exemple. */
export function useScheme(): ThemeScheme {
  return useContext(ThemeContext).scheme;
}

/**
 * Fige un sous-arbre dans un mode, quel que soit le choix de l'utilisateur.
 *
 * Pour les écrans conçus pour un seul éclairage — l'introduction, cinématique,
 * reste sombre en Jour comme en Nuit. Les classes ET `useColors()` y voient le
 * mode imposé.
 */
export function ThemeScope({ scheme, children }: { scheme: ThemeScheme; children: ReactNode }) {
  const value = useMemo<ThemeValue>(() => ({ scheme, colors: PALETTES[scheme] }), [scheme]);
  const themeVars = useMemo(() => vars(cssVarsFor(scheme)), [scheme]);
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
}
