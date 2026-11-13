import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isSupabaseConfigured } from '@/shared/lib/env';
import { geocodeAddress } from '@/shared/lib/geocode';
import { makeId } from '@/shared/lib/id';
import { asyncStorageBackend, secureStorage } from '@/shared/lib/storage';

import { canPublish } from '../lib/billing';
import { dueOccurrence, recurrencePeriodMs } from '../lib/recurrence';
import { startOf } from '../lib/offers';
import { scheduledStartMs } from '../lib/schedule';
import { fetchMyFlashes, publishFlash, withdrawFlash, type FlashApiError } from '../lib/flash-api';
import { fetchMyShop, fileMyShop, type ShopApiError, type ShopFiling } from '../lib/shop-api';
import {
  maskIban,
  missingSupplierFields,
  normalizeIban,
  type SupplierDraft,
} from '../lib/supplier';
import { PREP_STEPS, nextWholesaleStatus, type PrepStep } from '../lib/wholesale-orders';
import { seedWholesaleLots } from './seed';
import {
  EMPTY_PROFILE,
  EMPTY_SUPPLIER,
  OfferDraftSchema,
  PersistedMerchantSchema,
  type Supplier,
  type OfferDraftInput,
  type ShopProfile,
  type PublishedOffer,
  type WholesaleOrder,
} from './schema';

/**
 * L'espace professionnel : les offres publiées, le quota, les packs (CDC §9),
 * et les commandes passées aux grossistes (CDC §20).
 *
 * ⚠️ ZUSTAND v5 : les sélecteurs abonnés renvoient une tranche brute ou une
 * primitive, jamais un tableau recalculé (sinon boucle infinie → plantage).
 *
 * Le quota est tenu ICI, pas dans l'écran : une garde côté UI se contournerait
 * en revenant sur la page, et le CDC §9 en fait une règle commerciale, pas une
 * suggestion d'interface.
 */

/** La clé du coffre sécurisé où se range l'IBAN du fournisseur. */
const SUPPLIER_IBAN_KEY = 'tklink-supplier-iban';

/** Ce que le dossier dit du commerce lui-même (inscription), en plus des pièces. */
export type ShopDetails = Omit<ShopFiling, 'siret' | 'address'>;

export type FileShopResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> }
  /** `incomplete` : le nom ou la catégorie du commerce manque sur cet appareil. */
  | { ok: false; code: ShopApiError | 'incomplete' };

type PublishResult = { ok: true; offer: PublishedOffer } | { ok: false; reason: 'quota' };

/** Avec un serveur, la publication peut aussi échouer pour d'autres raisons que le quota. */
export type PublishOnlineResult =
  PublishResult | { ok: false; reason: Exclude<FlashApiError, 'quota'> };

type OrderResult =
  { ok: true; order: WholesaleOrder } | { ok: false; reason: 'introuvable' | 'stock' | 'minimum' };

type MerchantState = {
  /** MES publications, tous publics confondus. */
  offers: PublishedOffer[];
  /**
   * LE MARCHÉ des grossistes — CDC §20. Deux tableaux et non un seul : « ce
   * que j'ai publié » et « ce que je peux acheter » ne se filtrent pas l'un
   * dans l'autre sans confusion, et l'un viendra du serveur bien avant l'autre.
   */
  lots: PublishedOffer[];
  used: number;
  purchased: number;
  wholesaleOrders: WholesaleOrder[];
  /** La boutique : présentation, horaires, photos, vidéos (CDC V1.1). */
  profile: ShopProfile;
  saveProfile: (profile: ShopProfile) => void;

  /** Le dossier fournisseur : pièces déposées, contrôle TK LINK, sécurisation. */
  supplier: Supplier;
  /** Étape 3 : dépose le dossier, qui part en vérification. */
  submitSupplier: (draft: {
    siret: string;
    address: string;
    iban: string;
    idUri: string;
  }) => { ok: true } | { ok: false; errors: Record<string, string> };
  /**
   * Étape 3, avec un serveur : le dossier part à TK LINK (table `shops`), qui seul le valide. Sans
   * serveur (démonstration), revient à `submitSupplier`.
   */
  fileShop: (draft: SupplierDraft, shop: ShopDetails) => Promise<FileShopResult>;
  /**
   * Relit le statut du dossier sur le serveur (validé, refusé…) : le serveur fait foi. Sans serveur
   * ou sans réseau, rien ne change.
   */
  refreshShop: () => Promise<void>;
  /** DÉMO — simule le contrôle par TK LINK (étape 4 → 6). Disparaît avec le serveur. */
  validateSupplier: () => void;
  setSupplierDevice: (enrolled: boolean) => void;

  /**
   * Publie une offre — sur le SERVEUR quand il y en a un (le quota, le stock et l'heure de fin y sont
   * tenus, et les clients la voient), sinon comme `publish`. Un brouillon reste sur le téléphone.
   */
  publishOnline: (
    draft: OfferDraftInput,
    seller?: string,
    nowMs?: number,
  ) => Promise<PublishOnlineResult>;
  /**
   * Relit SES offres publiées sur le serveur (et le quota consommé) ; les brouillons du téléphone
   * restent. Sans serveur ou sans réseau, rien ne change.
   */
  refreshMyOffers: () => Promise<void>;
  /** Publie une offre flash. Échoue si le quota est épuisé — CDC §9. */
  publish: (draft: OfferDraftInput, seller?: string, nowMs?: number) => PublishResult;
  /**
   * Commande un lot chez un grossiste — CDC §20.
   *
   * ⚠️ Le droit de commander (rôle + SIRET, CDC §5) se vérifie AVANT, dans la
   * route : lui seul connaît le profil. Ici on ne garde que ce qui touche au
   * lot lui-même — existe-t-il, et reste-t-il assez de stock.
   */
  orderLot: (offerId: string, qty: number, nowMs?: number) => OrderResult;
  /** Retire une offre avant son terme. */
  takeOffline: (id: string) => void;
  /**
   * Republie les offres récurrentes dont l'occurrence suivante est échue — CDC V1.1, Grossiste.
   * Renvoie le nombre d'offres republiées. Idempotent : rappeler tout de suite ne republie rien.
   */
  republishDue: (nowMs?: number) => number;
  /** Le grossiste règle le stock d'un lot (paramétrage du catalogue). Jamais sous zéro. */
  adjustStock: (id: string, delta: number) => void;
  /** Le grossiste fait avancer une commande reçue d'un cran — jamais en arrière, jamais deux fois. */
  advanceWholesaleOrder: (orderId: string) => boolean;
  /** Coche ou décoche un geste du bon de préparation (prélevé, emballé, étiqueté). */
  togglePrep: (orderId: string, step: PrepStep) => void;
  /** Simule une vente : décrémente le stock (le vrai flux viendra du serveur). */
  sellOne: (id: string) => void;
  resetDemo: () => void;
};

export const useMerchantStore = create<MerchantState>()(
  persist(
    (set, get) => {
      /**
       * Ce que l'appareil garde du dossier : l'IBAN entier dans le coffre sécurisé (échec silencieux
       * sous Jest et sur le web, où il n'y a pas de coffre), un repère masqué et la pièce d'identité
       * dans l'état, avec le statut.
       */
      const keepPieces = (draft: SupplierDraft, status: Supplier['status'], reviewNote: string) => {
        void secureStorage
          .set(SUPPLIER_IBAN_KEY, normalizeIban(draft.iban), { deviceOnly: true })
          .catch(() => undefined);
        set((s) => ({
          supplier: {
            ...s.supplier,
            ibanHint: maskIban(draft.iban),
            idUri: draft.idUri,
            status,
            reviewNote,
          },
        }));
      };

      return {
        offers: [],
        lots: seedWholesaleLots(),
        used: 0,
        purchased: 0,
        wholesaleOrders: [],
        profile: EMPTY_PROFILE,
        saveProfile: (profile) => set({ profile }),

        supplier: EMPTY_SUPPLIER,
        submitSupplier: (draft) => {
          const errors = missingSupplierFields(draft);
          if (Object.keys(errors).length > 0) return { ok: false as const, errors };
          keepPieces(draft, 'en_verification', '');
          return { ok: true as const };
        },
        fileShop: async (draft, shop) => {
          if (!isSupabaseConfigured) return get().submitSupplier(draft);
          const errors = missingSupplierFields(draft);
          if (Object.keys(errors).length > 0) return { ok: false, errors };
          if (shop.name.trim().length < 2 || !shop.category)
            return { ok: false, code: 'incomplete' };
          // L'adresse en coordonnées : sans elles, le commerce n'apparaît ni sur la carte ni « autour
          // de vous ». Un échec n'empêche pas le dépôt.
          const coord = await geocodeAddress(draft.address);
          const filed = await fileMyShop({
            ...shop,
            siret: draft.siret,
            address: draft.address,
            coord,
          });
          if (!filed.ok) return { ok: false, code: filed.code };
          keepPieces(draft, filed.value.status, filed.value.reviewNote);
          return { ok: true };
        },
        refreshShop: async () => {
          if (!isSupabaseConfigured) return;
          const res = await fetchMyShop();
          if (!res.ok) return;
          // Aucun dossier sur le serveur : ce que l'appareil croyait déposé ne l'a pas été (dossier
          // d'avant le serveur, ou d'un autre compte). On repart du dépôt.
          set((s) => ({
            supplier: {
              ...s.supplier,
              status: res.value?.status ?? 'brouillon',
              reviewNote: res.value?.reviewNote ?? '',
            },
          }));
        },
        validateSupplier: () => {
          if (get().supplier.status === 'en_verification') {
            set((s) => ({ supplier: { ...s.supplier, status: 'valide' } }));
          }
        },
        setSupplierDevice: (enrolled) =>
          set((s) => ({ supplier: { ...s.supplier, deviceEnrolled: enrolled } })),

        publish: (draft, seller = '', nowMs = Date.now()) => {
          const s = get();
          // Un BROUILLON ne consomme rien et ne bute sur aucun quota : enregistrer
          // une idée n'est pas la publier. Facturer le brouillon découragerait de
          // préparer ses ventes à l'avance — exactement ce qu'on veut encourager.
          const brouillon = draft.state === 'brouillon';
          // Le quota d'opérations est celui des FLASH du commerçant (CDC §9). Une offre pro de
          // grossiste n'est pas un Flash : elle ne le consomme pas et n'en dépend pas.
          const b2b = draft.audience === 'commercants';
          const counted = !brouillon && !b2b;
          if (counted && !canPublish(s.used, s.purchased)) return { ok: false, reason: 'quota' };

          const offer: PublishedOffer = {
            id: makeId(),
            title: draft.title,
            category: draft.category,
            priceCents: draft.priceCents,
            oldPriceCents: draft.oldPriceCents,
            stock: draft.stock,
            stockLeft: draft.stock,
            durationMinutes: draft.durationMinutes,
            description: draft.description ?? '',
            publishedAt: nowMs,
            // Le brouillon dit « dans 1 h », le store dit à quelle heure. Zéro
            // reste zéro : « tout de suite » n'a pas besoin d'être daté, et le
            // laisser à zéro garde le comportement des offres d'avant le §4.2.
            startsAt: draft.startInMinutes ? scheduledStartMs(nowMs, draft.startInMinutes) : 0,
            state: draft.state ?? 'publiee',
            offline: false,
            audience: draft.audience ?? 'clients',
            photoUri: draft.photoUri ?? '',
            modes: draft.modes ?? ['touch-collect', 'livraison'],
            seller,
            minQty: draft.minQty ?? 1,
            recurrence: draft.recurrence ?? 'aucune',
          };

          set({ offers: [offer, ...s.offers], used: counted ? s.used + 1 : s.used });
          return { ok: true, offer };
        },

        publishOnline: async (draft, seller = '', nowMs = Date.now()) => {
          if (!isSupabaseConfigured || draft.state === 'brouillon') {
            return get().publish(draft, seller, nowMs);
          }
          const parsed = OfferDraftSchema.safeParse(draft);
          if (!parsed.success) return { ok: false, reason: 'invalid' };
          const res = await publishFlash(parsed.data, nowMs);
          if (!res.ok) return { ok: false, reason: res.code };
          const offer = { ...res.value, seller };
          set((s) => ({
            offers: [offer, ...s.offers],
            used: offer.audience === 'clients' ? s.used + 1 : s.used,
          }));
          return { ok: true, offer };
        },

        refreshMyOffers: async () => {
          if (!isSupabaseConfigured) return;
          const res = await fetchMyFlashes();
          if (!res.ok) return;
          set((s) => ({
            // Le serveur fait foi pour ce qui est publié ; les brouillons ne vivent qu'ici.
            offers: [...res.value, ...s.offers.filter((o) => o.state === 'brouillon')],
            // Les opérations consommées : les Flash publiées, comptées par le serveur comme lui.
            used: res.value.filter((o) => o.audience === 'clients').length,
          }));
        },

        takeOffline: (id) => {
          set((s) => ({
            offers: s.offers.map((o) => (o.id === id ? { ...o, offline: true } : o)),
          }));
          const offer = get().offers.find((o) => o.id === id);
          if (isSupabaseConfigured && offer?.state === 'publiee') {
            // Le retrait part au serveur ; s'il échoue (réseau), on relit l'état réel plutôt que de
            // laisser croire au commerçant que les clients ne la voient plus.
            void withdrawFlash(id).then((res) => {
              if (!res.ok) void get().refreshMyOffers();
            });
          }
        },

        republishDue: (nowMs = Date.now()) => {
          const created: PublishedOffer[] = [];
          const offers = get().offers.map((o) => {
            if (o.state !== 'publiee' || o.offline || o.recurrence === 'aucune') return o;
            let at = dueOccurrence(startOf(o), o.recurrence, nowMs);
            if (at === null) return o;
            // Un téléphone resté fermé : si la créneau dû est déjà passé en entier, la republier la
            // ferait naître terminée. On programme alors le créneau suivant, à venir.
            const period = recurrencePeriodMs(o.recurrence) ?? 0;
            if (at + o.durationMinutes * 60_000 <= nowMs) at += period;
            // La nouvelle occurrence reprend l'offre à neuf (stock plein) et porte la récurrence ;
            // l'ancienne reste dans l'historique, ponctuelle : une seule chaîne vivante.
            created.push({
              ...o,
              id: makeId(),
              publishedAt: at,
              startsAt: at,
              stockLeft: o.stock,
              offline: false,
            });
            return { ...o, recurrence: 'aucune' as const };
          });
          if (created.length === 0) return 0;
          set({ offers: [...created, ...offers] });
          return created.length;
        },

        adjustStock: (id, delta) =>
          set((s) => ({
            offers: s.offers.map((o) =>
              o.id === id
                ? {
                    ...o,
                    stock: Math.max(o.stock + delta, 0),
                    stockLeft: Math.max(o.stockLeft + delta, 0),
                  }
                : o,
            ),
          })),

        sellOne: (id) =>
          set((s) => ({
            offers: s.offers.map((o) =>
              o.id === id ? { ...o, stockLeft: Math.max(0, o.stockLeft - 1) } : o,
            ),
          })),

        orderLot: (offerId, qty, nowMs = Date.now()) => {
          const s = get();
          // Le lot peut venir du marché OU de mes propres publications B2B (un
          // grossiste qui teste son annonce depuis le même appareil).
          const lot =
            s.lots.find((o) => o.id === offerId) ?? s.offers.find((o) => o.id === offerId);
          if (!lot) return { ok: false, reason: 'introuvable' };
          // Le minimum du grossiste (V1.1) : on ne valide pas en dessous.
          if (qty < (lot.minQty ?? 1)) return { ok: false, reason: 'minimum' };
          if (qty <= 0 || lot.stockLeft < qty) return { ok: false, reason: 'stock' };

          const order: WholesaleOrder = {
            id: makeId(),
            offerId: lot.id,
            title: lot.title,
            seller: lot.seller,
            qty,
            // Prix figé à la commande : un lot dont le prix bouge ne doit pas
            // réécrire ce qui a déjà été commandé.
            unitCents: lot.priceCents,
            totalCents: lot.priceCents * qty,
            at: nowMs,
            status: 'recue',
            buyer: '',
            prep: [],
          };

          const take = (list: PublishedOffer[]) =>
            list.map((o) => (o.id === offerId ? { ...o, stockLeft: o.stockLeft - qty } : o));

          set({
            lots: take(s.lots),
            offers: take(s.offers),
            wholesaleOrders: [order, ...s.wholesaleOrders],
          });
          return { ok: true, order };
        },

        advanceWholesaleOrder: (orderId) => {
          const order = get().wholesaleOrders.find((o) => o.id === orderId);
          const next = order ? nextWholesaleStatus(order.status) : null;
          if (!order || !next) return false;
          // Le bon de préparation se remplit AVANT l'expédition : on n'envoie pas un colis
          // dont on n'a pas coché le contenu.
          if (
            order.status === 'preparation' &&
            !PREP_STEPS.every((p) => order.prep.includes(p.key))
          ) {
            return false;
          }
          set((s) => ({
            wholesaleOrders: s.wholesaleOrders.map((o) =>
              o.id === orderId ? { ...o, status: next } : o,
            ),
          }));
          return true;
        },

        togglePrep: (orderId, step) =>
          set((s) => ({
            wholesaleOrders: s.wholesaleOrders.map((o) =>
              o.id === orderId && o.status === 'preparation'
                ? {
                    ...o,
                    prep: o.prep.includes(step)
                      ? o.prep.filter((p) => p !== step)
                      : [...o.prep, step],
                  }
                : o,
            ),
          })),

        resetDemo: () =>
          set({
            supplier: EMPTY_SUPPLIER,
            offers: [],
            lots: seedWholesaleLots(),
            used: 0,
            purchased: 0,
            wholesaleOrders: [],
            profile: EMPTY_PROFILE,
          }),
      };
    },
    {
      name: 'tklink-merchant-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        offers: s.offers,
        lots: s.lots,
        used: s.used,
        purchased: s.purchased,
        wholesaleOrders: s.wholesaleOrders,
        profile: s.profile,
        supplier: s.supplier,
      }),
      merge: (persisted, current) => {
        const parsed = PersistedMerchantSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/* ---- sélecteurs : tranches brutes ou primitives uniquement ---- */
export const selectOffers = (s: MerchantState) => s.offers;
export const selectLots = (s: MerchantState) => s.lots;
export const selectUsed = (s: MerchantState) => s.used;
export const selectPurchased = (s: MerchantState) => s.purchased;
export const selectWholesaleOrders = (s: MerchantState) => s.wholesaleOrders;
export const selectProfile = (s: MerchantState) => s.profile;
export const selectSupplier = (s: MerchantState) => s.supplier;
