import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
import { currentSettings } from '@/shared/lib/platform-overrides';
// Cart/favorites/orders hold no secrets → the plaintext tier is correct.
import { POSITION_ADDRESS_ID } from '../lib/destination';
import { routeIssue, type IssueKind } from '../lib/issues';
import { canTransition, isActive, type Fulfilment, type OrderStatus } from '../lib/order-status';
import { canRate, clampStars, type RatingTag } from '../lib/rating';
import { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { getDeal } from './catalog';
import { POINTS_PER_EURO } from './loyalty';
import {
  PersistedShopSchema,
  type Address,
  type Coord,
  type AddressDraft,
  type CartItem,
  type Deal,
  type MerchantApplication,
  type Order,
} from './schema';

// La règle des points (1 € TTC = 1 point) vit dans model/loyalty.ts.
export { POINTS_PER_EURO } from './loyalty';

export type CartLine = { deal: Deal; qty: number; lineTotal: number };

/** Arrondi aux centimes — évite la poussière flottante (24,9 − 4,98 = 19,92). */
const roundEur = (v: number): number => Math.round(v * 100) / 100;

type ShopState = {
  cart: CartItem[];
  favorites: string[];
  orders: Order[];
  /** Exiger la biométrie à l'ouverture. L'empreinte elle-même n'est jamais stockée. */
  biometricEnabled: boolean;
  addresses: Address[];
  merchantApplication: MerchantApplication | null;
  /** Position de l'utilisateur — éphémère, jamais persistée (elle change). */
  userCoord: Coord | null;
  /** « Ma Fan Zone » : mode de retrait, rayon, régimes. Filtre les résultats. */
  preferences: Preferences;

  setPreferences: (next: Preferences) => void;

  addToCart: (dealId: string, qty?: number) => void;
  decrement: (dealId: string) => void;
  setQty: (dealId: string, qty: number) => void;
  removeFromCart: (dealId: string) => void;
  clearCart: () => void;

  toggleFavorite: (dealId: string) => void;
  setBiometricEnabled: (value: boolean) => void;

  addAddress: (draft: AddressDraft) => string;
  updateAddress: (id: string, draft: AddressDraft) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  submitMerchantApplication: (application: MerchantApplication) => void;
  setUserCoord: (coord: Coord | null) => void;

  /**
   * Le commerçant fait avancer une commande — CDC §11. Refuse toute transition
   * que la machine à états n'autorise pas.
   */
  setOrderStatus: (
    orderId: string,
    status: OrderStatus,
  ) => { ok: true } | { ok: false; reason: 'introuvable' | 'transition' };
  /** DÉMO : aligne les statuts sur le temps écoulé (voir demoStatusFor). */
  syncOrderStatuses: () => void;

  /**
   * Signale un problème sur une commande — point d'entrée unique, CDC V1.1.
   * La route (remboursement ou file Super Admin) est décidée par `routeIssue`.
   * Un seul signalement par commande.
   */
  reportIssue: (
    orderId: string,
    kind: IssueKind,
  ) =>
    | { ok: true; route: 'remboursement' | 'admin' }
    | { ok: false; reason: 'introuvable' | 'deja_signale' };
  /** Note le commerçant d'une commande terminée — étoiles + tags, sans texte libre. */
  rateOrder: (
    orderId: string,
    stars: number,
    tags: RatingTag[],
  ) => { ok: true } | { ok: false; reason: 'introuvable' | 'non_terminee' | 'deja_notee' };

  /**
   * Turn the cart into an order, award points, empty the cart.
   */
  checkout: (
    addressId?: string | null,
    /** Touch & Collect ou livraison — CDC §12. */
    fulfilment?: Fulfilment,
    /**
     * Réduction financée par TK LINK (crédit de parrainage — CDC V1.1), en euros.
     * Bornée au sous-total : on ne rembourse jamais plus que les articles.
     */
    discountEur?: number,
    /**
     * Livraison à la position actuelle (« Ma position actuelle »). Remplace
     * l'adresse : la commande porte alors `addressId: 'position'` et les
     * coordonnées, et RIEN n'est ajouté au carnet d'adresses. Ignoré en
     * Touch & Collect.
     */
    position?: Coord | null,
  ) => { ok: false } | { ok: true; orderId: string };
};

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      cart: [],
      favorites: [],
      orders: [],
      biometricEnabled: false,
      addresses: [],
      merchantApplication: null,
      preferences: DEFAULT_PREFERENCES,
      userCoord: null,

      setPreferences: (next) => set({ preferences: next }),

      addToCart: (dealId, qty = 1) =>
        set((state) => {
          const existing = state.cart.find((i) => i.dealId === dealId);
          if (existing) {
            return {
              cart: state.cart.map((i) => (i.dealId === dealId ? { ...i, qty: i.qty + qty } : i)),
            };
          }
          return { cart: [...state.cart, { dealId, qty }] };
        }),

      decrement: (dealId) =>
        set((state) => ({
          cart: state.cart
            .map((i) => (i.dealId === dealId ? { ...i, qty: i.qty - 1 } : i))
            .filter((i) => i.qty > 0),
        })),

      setQty: (dealId, qty) =>
        set((state) => ({
          cart:
            qty <= 0
              ? state.cart.filter((i) => i.dealId !== dealId)
              : state.cart.map((i) => (i.dealId === dealId ? { ...i, qty } : i)),
        })),

      removeFromCart: (dealId) =>
        set((state) => ({ cart: state.cart.filter((i) => i.dealId !== dealId) })),

      clearCart: () => set({ cart: [] }),

      setBiometricEnabled: (value) => set({ biometricEnabled: value }),

      addAddress: (draft) => {
        const id = makeId();
        set((state) => ({
          // La première adresse enregistrée devient le défaut : sans ça,
          // l'utilisateur aurait une adresse et toujours rien de sélectionné.
          addresses: [
            ...state.addresses,
            { ...draft, id, isDefault: state.addresses.length === 0 },
          ],
        }));
        return id;
      },

      updateAddress: (id, draft) =>
        set((state) => ({
          addresses: state.addresses.map((a) => (a.id === id ? { ...a, ...draft } : a)),
        })),

      removeAddress: (id) =>
        set((state) => {
          const rest = state.addresses.filter((a) => a.id !== id);
          // Supprimer l'adresse par défaut promeut la suivante — sinon plus
          // aucune adresse n'est sélectionnée et la commande n'a pas de cible.
          if (rest.length > 0 && !rest.some((a) => a.isDefault)) {
            return { addresses: rest.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a)) };
          }
          return { addresses: rest };
        }),

      setDefaultAddress: (id) =>
        set((state) => ({
          addresses: state.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
        })),

      submitMerchantApplication: (application) => set({ merchantApplication: application }),

      setUserCoord: (coord) => set({ userCoord: coord }),

      setOrderStatus: (orderId, status) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false as const, reason: 'introuvable' as const };
        // La machine à états du §11 tranche : sans elle, un bug d'affichage
        // deviendrait un bug comptable (« remboursée » → « en préparation »).
        if (!canTransition(order.status, status, order.fulfilment)) {
          return { ok: false as const, reason: 'transition' as const };
        }
        set((state) => ({
          orders: state.orders.map((o) => (o.id === orderId ? { ...o, status, managed: true } : o)),
        }));
        return { ok: true as const };
      },

      syncOrderStatuses: () =>
        set((state) => {
          const next = state.orders.map((o) => {
            // Commande reprise en main par le commerçant : l'horloge se tait.
            if (o.managed) return o;
            const status = demoStatusFor(o);
            return status === o.status ? o : { ...o, status };
          });
          // Ne remplacer le tableau que s'il change vraiment, sinon chaque appel
          // notifie les abonnés et relance le rendu en boucle.
          return next.some((o, i) => o !== state.orders[i]) ? { orders: next } : state;
        }),

      reportIssue: (orderId, kind) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false as const, reason: 'introuvable' as const };
        if (order.issue) return { ok: false as const, reason: 'deja_signale' as const };
        const decision = routeIssue(kind, order.status, order.fulfilment);
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  issue: { kind, route: decision.route, at: Date.now() },
                  // Une commande en litige ou en remboursement ne doit plus être
                  // réécrasée par la démo : on la reprend en main.
                  ...(decision.status ? { status: decision.status, managed: true } : {}),
                }
              : o,
          ),
        }));
        return { ok: true as const, route: decision.route };
      },

      rateOrder: (orderId, stars, tags) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return { ok: false as const, reason: 'introuvable' as const };
        if (!canRate(order.status)) return { ok: false as const, reason: 'non_terminee' as const };
        if (order.rating) return { ok: false as const, reason: 'deja_notee' as const };
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, rating: { stars: clampStars(stars), tags, at: Date.now() } }
              : o,
          ),
        }));
        return { ok: true as const };
      },

      toggleFavorite: (dealId) =>
        set((state) => ({
          favorites: state.favorites.includes(dealId)
            ? state.favorites.filter((id) => id !== dealId)
            : [dealId, ...state.favorites],
        })),

      checkout: (addressId = null, fulfilment = 'livraison', discountEur = 0, position = null) => {
        const { cart } = get();
        const lines = cartLines(cart);
        if (lines.length === 0) return { ok: false as const };

        const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
        // Le CDC V1.1 ne connaît que des réductions financées par TK Link (crédit de
        // parrainage, Flash boosté). Le serveur les calculera ; en attendant, la
        // route passe le crédit de parrainage, borné au sous-total.
        const discount = roundEur(Math.min(Math.max(0, discountEur), subtotal));
        const total = roundEur(subtotal - discount);
        // Les points récompensent ce qui est réellement payé (1 € TTC = 1 point).
        const pointsEarned = Math.round(total * POINTS_PER_EURO);
        // La position ne vaut que pour une livraison, et la commande est son seul
        // lieu de conservation.
        const here = fulfilment === 'livraison' && position ? position : null;
        const order: Order = {
          id: makeId(),
          createdAt: Date.now(),
          addressId: here ? POSITION_ADDRESS_ID : addressId,
          ...(here ? { position: { lat: here.lat, lng: here.lng } } : {}),
          items: lines.map((l) => ({
            dealId: l.deal.id,
            title: l.deal.title,
            emoji: l.deal.emoji,
            qty: l.qty,
            price: l.deal.price,
          })),
          total,
          discount,
          // Pas de frais de livraison quand le client vient chercher — CDC §12.
          deliveryFee: fulfilment === 'touch-collect' ? 0 : currentSettings().deliveryFeeEur,
          fulfilment,
          status: 'creee',
          pointsEarned,
          managed: false,
          rating: null,
          issue: null,
        };

        set((state) => ({
          orders: [order, ...state.orders],
          cart: [],
        }));
        return { ok: true as const, orderId: order.id };
      },
    }),
    {
      // Clé renommée avec la marque. Elle porte de VRAIES données — changer
      // une clé de persistance les efface d'ordinaire. Ici c'est sans coût :
      // le `package` Android change en même temps, et Android donne alors
      // à l'app un espace de stockage NEUF de toute façon. C'est le seul
      // moment où ce renommage est gratuit ; après publication, il
      // faudrait une migration.
      name: 'tklink-shop-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        cart: s.cart,
        favorites: s.favorites,
        orders: s.orders,
        biometricEnabled: s.biometricEnabled,
        addresses: s.addresses,
        merchantApplication: s.merchantApplication,
        preferences: s.preferences,
      }),
      // Corrupt storage must never crash the app — validate then fall back.
      merge: (persisted, current) => {
        const parsed = PersistedShopSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

/**
 * DÉMO — progression d'une commande dans le temps.
 *
 * Sans back-end, une commande resterait « en préparation » indéfiniment et le
 * suivi n'aurait rien à montrer. Le statut est DÉRIVÉ de l'heure de commande
 * plutôt que planifié par un minuteur : ça survit à la fermeture de l'app, là
 * où un setTimeout serait perdu.
 *
 * À SUPPRIMER quand le back-end poussera les vrais statuts.
 */
export const DEMO_PAID_AFTER_S = 10;
export const DEMO_PREPARING_AFTER_S = 25;
export const DEMO_SHIPPING_AFTER_S = 60;
export const DEMO_DELIVERED_AFTER_S = 240;

export function demoStatusFor(order: Order): Order['status'] {
  // Une commande close ne bouge plus : sans cette garde, une annulation ou un
  // remboursement seraient écrasés à la seconde suivante par la démo.
  if (!isActive(order.status)) return order.status;

  const elapsed = (Date.now() - order.createdAt) / 1000;
  // La fin du parcours dépend du mode de retrait — CDC §12.
  if (elapsed >= DEMO_DELIVERED_AFTER_S) {
    return order.fulfilment === 'touch-collect' ? 'recuperee' : 'livree';
  }
  if (elapsed >= DEMO_SHIPPING_AFTER_S) return 'prete';
  if (elapsed >= DEMO_PREPARING_AFTER_S) return 'preparation';
  if (elapsed >= DEMO_PAID_AFTER_S) return 'payee';
  return 'creee';
}

/* ---- pure helpers + selectors (subscribe to slices, never the whole store) ---- */

export function cartLines(cart: CartItem[]): CartLine[] {
  return cart
    .map((item) => {
      const deal = getDeal(item.dealId);
      if (!deal) return null;
      return { deal, qty: item.qty, lineTotal: deal.price * item.qty };
    })
    .filter((l): l is CartLine => l !== null);
}

export const selectCart = (s: ShopState) => s.cart;
export const selectFavorites = (s: ShopState) => s.favorites;
export const selectOrders = (s: ShopState) => s.orders;

export const selectCartCount = (s: ShopState) => s.cart.reduce((n, i) => n + i.qty, 0);
export const selectCartLines = (s: ShopState) => cartLines(s.cart);
export const selectCartSubtotal = (s: ShopState) =>
  cartLines(s.cart).reduce((sum, l) => sum + l.lineTotal, 0);
