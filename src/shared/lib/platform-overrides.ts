import { useMemo } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isDemoBuild } from './env';
import { PLATFORM_SETTINGS, type PlatformSettings } from './platform-settings';
import { asyncStorageBackend } from './storage';

/**
 * LES RÉGLAGES DE DÉMONSTRATION — pour montrer au client l'effet d'une valeur que le CDC ne
 * chiffre pas, sans toucher au code : le forfait de livraison payé par le client et la zone de base
 * au-delà de laquelle chaque km se paie.
 *
 * Ce n'est PAS une décision : `PLATFORM_SETTINGS` reste la source (et reste `null` là où le CDC ne
 * tranche pas). Ces ajustements se posent par-dessus, sur cet appareil seulement, et ne sont
 * proposés que dans les builds de démonstration (voir `isDemoBuild`). Le jour où le client tranche,
 * la valeur va dans `PLATFORM_SETTINGS` et ces réglages n'ont plus lieu d'être.
 */
export const OVERRIDABLE = ['deliveryFeeEur', 'deliveryBaseZoneKm'] as const;
export type OverridableKey = (typeof OVERRIDABLE)[number];

/**
 * Les clés retirées le 13/11/2026 avec les livreurs (`courierBaseZoneKm`, `importantParcelMinEur`)
 * peuvent rester sur un téléphone : Zod ignore les clés inconnues, la relecture ne les garde pas et
 * n'échoue pas pour autant — les autres ajustements survivent.
 */
const OverridesSchema = z.object({
  deliveryFeeEur: z.number().nonnegative().optional(),
  deliveryBaseZoneKm: z.number().positive().optional(),
});
export type Overrides = z.infer<typeof OverridesSchema>;

/**
 * CE QUE LE SERVEUR APPLIQUE (migration 0022, `platform_public_settings`) : la commission et le
 * crédit de parrainage que le Super Admin règle dans le back-office. Le panier estime donc la même
 * chose que ce que le serveur calculera. Absent (démonstration, migration pas appliquée, hors ligne) : les
 * valeurs du CDC restent. Bornes = celles que le serveur accepte.
 */
export const ServerSettingsSchema = z.object({
  commission_bps: z.number().int().min(0).max(3000).nullish(),
  referral_credit_cents: z.number().int().min(0).max(10000).nullish(),
});
export type ServerSettings = Partial<
  Pick<PlatformSettings, 'commissionB2cPct' | 'referralRewardEur'>
>;

/** La réponse du serveur, en valeurs de l'app ; une réponse illisible ne change rien. */
export function fromServer(raw: unknown): ServerSettings {
  const parsed = ServerSettingsSchema.safeParse(raw);
  if (!parsed.success) return {};
  const out: ServerSettings = {};
  const { commission_bps: bps, referral_credit_cents: cents } = parsed.data;
  if (typeof bps === 'number') out.commissionB2cPct = bps / 100;
  if (typeof cents === 'number') out.referralRewardEur = cents / 100;
  return out;
}

/** Ce qui est conservé d'un lancement à l'autre (exporté pour le test de relecture). */
export const PersistedOverridesSchema = z.object({ overrides: OverridesSchema.default({}) });

type State = {
  overrides: Overrides;
  /** Les réglages du serveur, relus à chaque lancement (jamais conservés : le serveur fait foi). */
  server: ServerSettings;
  setServer: (server: ServerSettings) => void;
  /** Pose un ajustement ; `null` le retire (la valeur du CDC, ou « à définir », revient). */
  setOverride: (key: OverridableKey, value: number | null) => void;
  reset: () => void;
};

export const usePlatformOverrides = create<State>()(
  persist(
    (set) => ({
      overrides: {},
      server: {},
      setServer: (server) => set({ server }),
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
        const parsed = PersistedOverridesSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/**
 * Les valeurs en vigueur : celles du CDC, celles du serveur par-dessus, puis les ajustements de
 * démonstration (qui ne touchent que la livraison : rien ne se chevauche).
 */
export function mergeSettings(overrides: Overrides, server: ServerSettings = {}): PlatformSettings {
  // Une build de production n'applique jamais d'ajustement de démonstration.
  return isDemoBuild
    ? { ...PLATFORM_SETTINGS, ...server, ...overrides }
    : { ...PLATFORM_SETTINGS, ...server };
}

/** Pour le code qui n'est pas un composant (stores, règles pures) : lu au moment de l'appel. */
export function currentSettings(): PlatformSettings {
  const { overrides, server } = usePlatformOverrides.getState();
  return mergeSettings(overrides, server);
}

/** Pour les écrans : se met à jour quand un réglage change. */
export function usePlatformSettings(): PlatformSettings {
  const overrides = usePlatformOverrides((s) => s.overrides);
  const server = usePlatformOverrides((s) => s.server);
  return useMemo(() => mergeSettings(overrides, server), [overrides, server]);
}
