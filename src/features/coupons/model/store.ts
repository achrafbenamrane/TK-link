import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { evaluatePromo, generateCode, normalizeCode } from '../lib/coupons';
import {
  PersistedCouponsSchema,
  type Discount,
  type HeldCoupon,
  type PromoCode,
  type PromoDraft,
  type RedeemFailure,
} from './schema';

/**
 * Deux codes de démonstration, pour que la saisie et l'espace admin aient de la
 * matière dès l'ouverture. En production ils viendraient du serveur.
 * Horodatages relatifs au lancement : figer des dates ferait vieillir la démo.
 */
const seedPromos = (): PromoCode[] => [
  {
    id: 'promo_bienvenue',
    code: 'BIENVENUE',
    discount: { kind: 'amount', cents: 500 },
    label: 'Offre de bienvenue',
    createdAt: Date.now(),
    expiresAt: null,
    active: true,
    maxRedemptions: null,
    redeemedCount: 0,
  },
  {
    id: 'promo_insta',
    code: 'INSTA20',
    discount: { kind: 'percent', pct: 20 },
    label: 'Story Instagram',
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
    active: true,
    maxRedemptions: 100,
    redeemedCount: 12,
  },
];

type CreateResult = { ok: true; promo: PromoCode } | { ok: false; error: string };
type RedeemResult = { ok: true; coupon: HeldCoupon } | { ok: false; reason: RedeemFailure };

type CouponsState = {
  wallet: HeldCoupon[];
  promoCatalog: PromoCode[];

  /** SOURCE 1 — appelée quand un jeu est gagné. Les jeux ne sont pas encore faits. */
  grantEarnedCoupon: (discount: Discount, label: string) => HeldCoupon;
  /** SOURCE 2 — l'utilisateur saisit un code promo vu sur les réseaux. */
  redeemPromo: (rawCode: string) => RedeemResult;
  /** Marque un coupon comme consommé (à la commande). */
  useCoupon: (id: string) => void;

  /** ADMIN — génère un code promo (code choisi ou auto). */
  createPromo: (draft: PromoDraft) => CreateResult;
  /** ADMIN — coupe / réactive un code sans le supprimer. */
  setPromoActive: (id: string, active: boolean) => void;
  /** ADMIN — fixe (ou retire) une date d'expiration. */
  setPromoExpiry: (id: string, expiresAt: number | null) => void;
};

export const useCouponsStore = create<CouponsState>()(
  persist(
    (set, get) => ({
      wallet: [],
      promoCatalog: seedPromos(),

      grantEarnedCoupon: (discount, label) => {
        const coupon: HeldCoupon = {
          id: makeId(),
          code: generateCode(),
          source: 'game',
          discount,
          label,
          createdAt: Date.now(),
          usedAt: null,
        };
        set((s) => ({ wallet: [coupon, ...s.wallet] }));
        return coupon;
      },

      redeemPromo: (rawCode) => {
        const { promoCatalog, wallet } = get();
        const res = evaluatePromo(rawCode, promoCatalog, wallet, Date.now());
        if (!res.ok) return res;

        const coupon: HeldCoupon = {
          id: makeId(),
          code: res.promo.code,
          source: 'promo',
          discount: res.promo.discount,
          label: res.promo.label,
          createdAt: Date.now(),
          usedAt: null,
        };
        set((s) => ({
          wallet: [coupon, ...s.wallet],
          // Le compteur global monte : c'est ce plafond qui protège une offre
          // partagée publiquement d'un usage sans fin.
          promoCatalog: s.promoCatalog.map((p) =>
            p.id === res.promo.id ? { ...p, redeemedCount: p.redeemedCount + 1 } : p,
          ),
        }));
        return { ok: true, coupon };
      },

      useCoupon: (id) =>
        set((s) => ({
          wallet: s.wallet.map((c) =>
            c.id === id && !c.usedAt ? { ...c, usedAt: Date.now() } : c,
          ),
        })),

      createPromo: (draft) => {
        const code = draft.code ? normalizeCode(draft.code) : generateCode(6);
        if (get().promoCatalog.some((p) => p.code === code)) {
          return { ok: false as const, error: 'Ce code existe déjà.' };
        }
        const promo: PromoCode = {
          id: makeId(),
          code,
          discount: draft.discount,
          label: draft.label ?? '',
          createdAt: Date.now(),
          expiresAt: draft.expiresAt ?? null,
          active: true,
          maxRedemptions: draft.maxRedemptions ?? null,
          redeemedCount: 0,
        };
        set((s) => ({ promoCatalog: [promo, ...s.promoCatalog] }));
        return { ok: true as const, promo };
      },

      setPromoActive: (id, active) =>
        set((s) => ({
          promoCatalog: s.promoCatalog.map((p) => (p.id === id ? { ...p, active } : p)),
        })),

      setPromoExpiry: (id, expiresAt) =>
        set((s) => ({
          promoCatalog: s.promoCatalog.map((p) => (p.id === id ? { ...p, expiresAt } : p)),
        })),
    }),
    {
      // Clé renommée avec la marque. Elle porte de VRAIES données — changer
      // une clé de persistance les efface d'ordinaire. Ici c'est sans coût :
      // le `package` Android change en même temps, et Android donne alors
      // à l'app un espace de stockage NEUF de toute façon. C'est le seul
      // moment où ce renommage est gratuit ; après publication, il
      // faudrait une migration.
      name: 'tklink-coupons-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({ wallet: s.wallet, promoCatalog: s.promoCatalog }),
      merge: (persisted, current) => {
        const parsed = PersistedCouponsSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs (s'abonner à des tranches, jamais au store entier) ---- */

export const selectWallet = (s: CouponsState) => s.wallet;
export const selectAvailableCoupons = (s: CouponsState) =>
  s.wallet.filter((c) => c.usedAt === null);
export const selectPromoCatalog = (s: CouponsState) => s.promoCatalog;
