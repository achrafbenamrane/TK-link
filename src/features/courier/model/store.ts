import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { isImportantParcel, isValidPickupPin } from '@/shared/lib/handover';
import { PLATFORM_SETTINGS } from '@/shared/lib/platform-settings';
import { asyncStorageBackend } from '@/shared/lib/storage';

import {
  canReceiveMissions,
  courierGain,
  missingProfileFields,
  nextStep,
  VEHICLES,
  type MissionStep,
  type ProfileDraft,
} from '../lib/courier';

/**
 * L'état du livreur — compte, disponibilité, mission en cours, historique.
 *
 * ⚠️ Sans back-end, ce qu'un serveur décide est SIMULÉ et signalé comme tel :
 * la vérification d'identité par TK LINK (`validateAccount`, démo) et l'offre de
 * missions (venues des commandes prêtes de cet appareil, passées par la route).
 * Aucune empreinte n'est stockée : la biométrie reste LOCALE (V1.1).
 */

/** Une offre de mission, telle que la route la fabrique à partir d'une commande prête. */
export type Mission = {
  orderId: string;
  merchantName: string;
  merchantArea: string;
  /** Où livrer, en une ligne. */
  dropoff: string;
  itemCount: number;
  totalEur: number;
  /** Absente quand on ne la connaît pas : on n'invente pas de kilomètres. */
  distanceKm: number | null;
  /** Délai estimé en minutes — renseigné seulement par les missions d'exemple. */
  etaMin?: number;
};

const MissionSchema = z.object({
  orderId: z.string(),
  merchantName: z.string(),
  merchantArea: z.string().default(''),
  dropoff: z.string().default(''),
  itemCount: z.number().int().nonnegative().default(0),
  totalEur: z.number().nonnegative().default(0),
  distanceKm: z.number().nonnegative().nullable().default(null),
  etaMin: z.number().nonnegative().optional(),
});

const DeliveredSchema = z.object({
  orderId: z.string(),
  merchantName: z.string(),
  at: z.number().int().positive(),
  distanceKm: z.number().nullable().default(null),
  gainEur: z.number(),
  /** Le forfait seul, faute de zone de base ou de distance (voir `courierGain`). */
  gainComplet: z.boolean().default(false),
  proofUri: z.string().default(''),
});
export type Delivered = z.infer<typeof DeliveredSchema>;

const PersistedSchema = z.object({
  status: z.enum(['brouillon', 'en_verification', 'valide']).default('brouillon'),
  vehicle: z.enum(VEHICLES).nullable().default(null),
  zone: z.string().default(''),
  idUri: z.string().default(''),
  selfieUri: z.string().default(''),
  /** L'appareil est-il enrôlé avec une biométrie locale ? Un drapeau, jamais l'empreinte. */
  deviceEnrolled: z.boolean().default(false),
  online: z.boolean().default(false),
  active: z
    .object({
      mission: MissionSchema,
      step: z.enum([
        'acceptee',
        'en_route_commercant',
        'prise_en_charge',
        'en_livraison',
        'livree',
      ]),
    })
    .nullable()
    .default(null),
  declined: z.array(z.string()).default([]),
  history: z.array(DeliveredSchema).default([]),
});

export type CourierActive = { mission: Mission; step: MissionStep };

type State = z.infer<typeof PersistedSchema> & {
  /** Dépose le dossier (étape 3) : il part en vérification. */
  submitProfile: (
    draft: ProfileDraft,
  ) => { ok: true } | { ok: false; errors: Record<string, string> };
  /** DÉMO — simule la validation par TK LINK (étape 4 → 6 du parcours). */
  validateAccount: () => void;
  setDeviceEnrolled: (enrolled: boolean) => void;
  setOnline: (online: boolean) => boolean;
  acceptMission: (mission: Mission) => boolean;
  declineMission: (orderId: string) => void;
  /** « Je pars chez le commerçant ». */
  startRoute: () => void;
  /**
   * Prise en charge chez le commerçant : le code (ou QR) doit être celui de la
   * commande. Un colis « important » exige en plus la biométrie — `biometricOk`.
   */
  confirmPickup: (
    pin: string,
    biometricOk: boolean,
  ) => { ok: true } | { ok: false; reason: 'pas_de_mission' | 'code' | 'biometrie' };
  /** Départ chez le client : la commande passe « en livraison ». */
  startDelivery: () => void;
  /** Remise au client, avec preuve — termine la mission et l'inscrit au portefeuille. */
  confirmDelivery: (
    proofUri: string,
  ) => { ok: true } | { ok: false; reason: 'pas_de_mission' | 'preuve' };
  reset: () => void;
};

const INITIAL = {
  status: 'brouillon' as const,
  vehicle: null,
  zone: '',
  idUri: '',
  selfieUri: '',
  deviceEnrolled: false,
  online: false,
  active: null,
  declined: [] as string[],
  history: [] as Delivered[],
};

export const useCourierStore = create<State>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      submitProfile: (draft) => {
        const errors = missingProfileFields(draft);
        if (Object.keys(errors).length > 0) return { ok: false as const, errors };
        set({
          vehicle: draft.vehicle,
          zone: draft.zone.trim(),
          idUri: draft.idUri,
          selfieUri: draft.selfieUri,
          status: 'en_verification',
        });
        return { ok: true as const };
      },

      validateAccount: () => {
        if (get().status === 'en_verification') set({ status: 'valide' });
      },

      setDeviceEnrolled: (enrolled) => set({ deviceEnrolled: enrolled }),

      setOnline: (online) => {
        // Une mission en cours ne se quitte pas en se mettant hors ligne.
        if (!online && get().active) return false;
        if (online && get().status !== 'valide') return false;
        set({ online });
        return true;
      },

      acceptMission: (mission) => {
        const s = get();
        if (!canReceiveMissions(s.status, s.online) || s.active) return false;
        set({ active: { mission, step: 'acceptee' } });
        return true;
      },

      declineMission: (orderId) =>
        set((s) => (s.declined.includes(orderId) ? s : { declined: [...s.declined, orderId] })),

      startRoute: () => {
        const a = get().active;
        if (a?.step === 'acceptee') set({ active: { ...a, step: 'en_route_commercant' } });
      },

      confirmPickup: (pin, biometricOk) => {
        const a = get().active;
        if (!a || a.step !== 'en_route_commercant') {
          return { ok: false as const, reason: 'pas_de_mission' as const };
        }
        if (!isValidPickupPin(a.mission.orderId, pin)) {
          return { ok: false as const, reason: 'code' as const };
        }
        if (
          isImportantParcel(a.mission.totalEur, PLATFORM_SETTINGS.importantParcelMinEur) &&
          !biometricOk
        ) {
          return { ok: false as const, reason: 'biometrie' as const };
        }
        set({ active: { ...a, step: 'prise_en_charge' } });
        return { ok: true as const };
      },

      startDelivery: () => {
        const a = get().active;
        if (a?.step === 'prise_en_charge') set({ active: { ...a, step: 'en_livraison' } });
      },

      confirmDelivery: (proofUri) => {
        const a = get().active;
        if (!a || a.step !== 'en_livraison') {
          return { ok: false as const, reason: 'pas_de_mission' as const };
        }
        // Pas de remise sans preuve (V1.1 : « remise avec preuve »).
        if (!proofUri) return { ok: false as const, reason: 'preuve' as const };
        const gain = courierGain(a.mission.distanceKm);
        set((s) => ({
          active: null,
          history: [
            {
              orderId: a.mission.orderId,
              merchantName: a.mission.merchantName,
              at: Date.now(),
              distanceKm: a.mission.distanceKm,
              gainEur: gain.eur,
              gainComplet: gain.complet,
              proofUri,
            },
            ...s.history,
          ],
        }));
        return { ok: true as const };
      },

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: 'tklink-courier-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        status: s.status,
        vehicle: s.vehicle,
        zone: s.zone,
        idUri: s.idUri,
        selfieUri: s.selfieUri,
        deviceEnrolled: s.deviceEnrolled,
        online: s.online,
        active: s.active,
        declined: s.declined,
        history: s.history,
      }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/** Les prochaines étapes d'une mission, pour l'écran. */
export { nextStep };

export const selectHistory = (s: State) => s.history;
export const selectActive = (s: State) => s.active;
