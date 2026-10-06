import { useMemo } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isDemoBuild } from './env';
import { PLATFORM_SETTINGS, type PlatformSettings } from './platform-settings';
import { asyncStorageBackend } from './storage';

/**
 * LES RÉGLAGES DE DÉMONSTRATION — pour montrer au client l'effet d'une valeur que le CDC ne
 * chiffre pas, sans toucher au code : ce que paie le client à la livraison, la zone de base du
 * livreur, le montant d'un « colis important ».
 *
 * Ce n'est PAS une décision : `PLATFORM_SETTINGS` reste la source (et reste `null` là où le CDC ne
 * tranche pas). Ces ajustements se posent par-dessus, sur cet appareil seulement, et ne sont
 * proposés que dans les builds de démonstration (voir `isDemoBuild`). Le jour où le client tranche,
 * la valeur va dans `PLATFORM_SETTINGS` et ces réglages n'ont plus lieu d'être.
 */
export const OVERRIDABLE = [
  'deliveryFeeEur',
  'courierBaseZoneKm',
  'importantParcelMinEur',
] as const;
export type OverridableKey = (typeof OVERRIDABLE)[number];

const OverridesSchema = z.object({
  deliveryFeeEur: z.number().nonnegative().optional(),
  courierBaseZoneKm: z.number().positive().optional(),
  importantParcelMinEur: z.number().positive().optional(),
});
export type Overrides = z.infer<typeof OverridesSchema>;

type State = {
  overrides: Overrides;
  /** Pose un ajustement ; `null` le retire (la valeur du CDC, ou « à définir », revient). */
  setOverride: (key: OverridableKey, value: number | null) => void;
  reset: () => void;
};

export const usePlatformOverrides = create<State>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (key, value) =>
        set((s) => {
          const next = { ...s.overrides };
          if (value === null || !Number.isFinite(value)) delete next[key];
          else next[key] = value;
          return { overrides: next };
        }),
      reset: () => set({ overrides: {} }),
    }),
    {
      name: 'tklink-platform-overrides-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ overrides: s.overrides }),
      merge: (persisted, current) => {
        const parsed = z.object({ overrides: OverridesSchema }).safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/** Les valeurs en vigueur : celles du CDC, avec les ajustements de démonstration par-dessus. */
export function mergeSettings(overrides: Overrides): PlatformSettings {
  // Une build de production n'applique jamais d'ajustement de démonstration.
  return isDemoBuild ? { ...PLATFORM_SETTINGS, ...overrides } : { ...PLATFORM_SETTINGS };
}

/** Pour le code qui n'est pas un composant (stores, règles pures) : lu au moment de l'appel. */
export function currentSettings(): PlatformSettings {
  return mergeSettings(usePlatformOverrides.getState().overrides);
}

/** Pour les écrans : se met à jour quand un réglage change. */
export function usePlatformSettings(): PlatformSettings {
  const overrides = usePlatformOverrides((s) => s.overrides);
  return useMemo(() => mergeSettings(overrides), [overrides]);
}
