import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { z } from 'zod';

import { isValidDeliveryCode, isValidPickupPin } from '@/shared/lib/handover';
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
  /** Le détail que montre l'écran Mission active. Absent = on ne l'affiche pas, on ne l'invente pas. */
  ref?: string;
  clientName?: string;
  clientPhone?: string;
  merchantPhone?: string;
  instructions?: string;
  bags?: number;
  /** Heure cible de livraison, « 12:45 ». */
  targetTime?: string;
  pickupGeo?: GeoPoint;
  dropoffGeo?: GeoPoint;
};

export type GeoPoint = { lat: number; lng: number };
const GeoSchema = z.object({ lat: z.number(), lng: z.number() });

const MissionSchema = z.object({
  orderId: z.string(),
  merchantName: z.string(),
  merchantArea: z.string().default(''),
  dropoff: z.string().default(''),
  itemCount: z.number().int().nonnegative().default(0),
  totalEur: z.number().nonnegative().default(0),
  distanceKm: z.number().nonnegative().nullable().default(null),
  etaMin: z.number().nonnegative().optional(),
  ref: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  merchantPhone: z.string().optional(),
  instructions: z.string().optional(),
  bags: z.number().int().nonnegative().optional(),
  targetTime: z.string().optional(),
  pickupGeo: GeoSchema.optional(),
  dropoffGeo: GeoSchema.optional(),
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
      /** Quand chaque étape a été franchie (ms) : la frise affiche les heures. */
      at: z.record(z.string(), z.number()).default({}),
      /**
       * Quand le livreur a confirmé son identité par empreinte (biométrie LOCALE : on ne garde
       * que l'heure, jamais l'empreinte). Le commerçant le lit sur son écran de remise.
       */
      identityAt: z.number().optional(),
    })
    .nullable()
    .default(null),
  declined: z.array(z.string()).default([]),
  history: z.array(DeliveredSchema).default([]),
});

export type CourierActive = {
  mission: Mission;
  step: MissionStep;
  at: Record<string, number>;
  identityAt?: number | undefined;
};

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
   * Le livreur a confirmé son identité par l'empreinte de SON téléphone (biométrie locale).
   * On ne retient que l'heure : le commerçant la voit s'afficher sur son écran de remise.
   */
  confirmIdentity: () => boolean;
  /**
   * Prise en charge chez le commerçant : l'identité doit être confirmée par empreinte, puis le
   * code (ou le QR) doit être celui de la commande.
   */
  confirmPickup: (
    pin: string,
  ) => { ok: true } | { ok: false; reason: 'pas_de_mission' | 'code' | 'biometrie' };
  /** Départ chez le client : la commande passe « en livraison ». */
  startDelivery: () => void;
  /**
   * Remise au client — le code de validation du client (ou son QR) est la preuve de remise ;
   * la mission se termine et s'inscrit au portefeuille.
   */
  confirmDelivery: (
    code: string,
  ) => { ok: true } | { ok: false; reason: 'pas_de_mission' | 'code' };
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
        set({ active: { mission, step: 'acceptee', at: { acceptee: Date.now() } } });
        return true;
      },

      declineMission: (orderId) =>
        set((s) => (s.declined.includes(orderId) ? s : { declined: [...s.declined, orderId] })),

      startRoute: () => {
        const a = get().active;
        if (a?.step === 'acceptee') {
          set({
            active: {
              ...a,
              step: 'en_route_commercant',
              at: { ...a.at, en_route_commercant: Date.now() },
            },
          });
        }
      },

      confirmIdentity: () => {
        const a = get().active;
        if (!a) return false;
        set({ active: { ...a, identityAt: Date.now() } });
        return true;
      },

      confirmPickup: (pin) => {
        const a = get().active;
        if (!a || a.step !== 'en_route_commercant') {
          return { ok: false as const, reason: 'pas_de_mission' as const };
        }
        // L'empreinte d'abord : on ne remet pas un colis à quelqu'un dont l'identité n'est pas confirmée.
        if (!a.identityAt) return { ok: false as const, reason: 'biometrie' as const };
        if (!isValidPickupPin(a.mission.orderId, pin)) {
          return { ok: false as const, reason: 'code' as const };
        }
        set({
          active: { ...a, step: 'prise_en_charge', at: { ...a.at, prise_en_charge: Date.now() } },
        });
        return { ok: true as const };
      },

      startDelivery: () => {
        const a = get().active;
        if (a?.step === 'prise_en_charge') {
          set({
            active: { ...a, step: 'en_livraison', at: { ...a.at, en_livraison: Date.now() } },
          });
        }
      },

      confirmDelivery: (code) => {
        const a = get().active;
        if (!a || a.step !== 'en_livraison') {
          return { ok: false as const, reason: 'pas_de_mission' as const };
        }
        // Pas de remise sans preuve (V1.1 : « remise avec preuve ») : le code du client en est une.
        if (!isValidDeliveryCode(a.mission.orderId, code)) {
          return { ok: false as const, reason: 'code' as const };
        }
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
              proofUri: `code:${code.trim()}`,
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
