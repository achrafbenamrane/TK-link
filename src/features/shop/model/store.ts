import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
// Cart/favorites/orders hold no secrets → the plaintext tier is correct.
import { canTransition, isActive, type Fulfilment, type OrderStatus } from '../lib/order-status';
import { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
import { asyncStorageBackend } from '@/shared/lib/storage';

import { getDeal } from './catalog';
import { POINTS_PER_EURO, REWARD_POINTS, REWARD_VALUE_EUR } from './loyalty';
import { CHAT_SEED } from './chat-seed';
import {
  ME,
  PersistedShopSchema,
  type Address,
  type ChatMessage,
  type Conversation,
  type Coord,
  type AddressDraft,
  type CartItem,
  type Deal,
  type MerchantApplication,
  type Order,
  type Voucher,
} from './schema';

const DELIVERY_FEE = 0; // Freedoo : livraison offerte pour l'utilisateur.

// L'économie du programme vit dans model/loyalty.ts — un seul endroit à régler
// avec le client, et un test qui refuse un taux plus cher que la commission.
export { POINTS_PER_EURO, REWARD_POINTS, REWARD_VALUE_EUR } from './loyalty';

/** Code lisible à voix haute : ni 0/O ni 1/I, qu'on confond au téléphone. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (i === 3) out += '-';
  }
  return out;
}

export type CartLine = { deal: Deal; qty: number; lineTotal: number };

/**
 * Remise coupon transmise à la commande. Le coupon lui-même vit dans la feature
 * `coupons` : le shop n'en connaît que le montant déjà calculé et le code, pour
 * ne pas créer de dépendance croisée. La composition se fait dans la route.
 */
export type AppliedDiscount = { discountEur: number; couponCode: string };

/** Arrondi aux centimes — évite la poussière flottante (24,9 − 4,98 = 19,92). */
const roundEur = (v: number): number => Math.round(v * 100) / 100;

type ShopState = {
  cart: CartItem[];
  favorites: string[];
  orders: Order[];
  points: number;
  /** Exiger la biométrie à l'ouverture. L'empreinte elle-même n'est jamais stockée. */
  biometricEnabled: boolean;
  addresses: Address[];
  merchantApplication: MerchantApplication | null;
  vouchers: Voucher[];
  /** Position de l'utilisateur — éphémère, jamais persistée (elle change). */
  userCoord: Coord | null;
  conversations: Conversation[];
  messages: ChatMessage[];
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

  /** Échange REWARD_POINTS contre un bon d'achat. Refuse si le solde est court. */
  claimReward: () => { ok: false } | { ok: true; voucher: Voucher };
  /** Offre des points à un proche. Renvoie le code à partager. */
  sharePoints: (amount: number) => { ok: false } | { ok: true; code: string };

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

  sendMessage: (conversationId: string, body: string) => void;
  receiveMessage: (conversationId: string, senderId: string, body: string) => void;
  markConversationRead: (conversationId: string) => void;

  /**
   * Turn the cart into an order, award points, empty the cart. `applied` porte
   * une remise coupon (déjà calculée et bornée par l'appelant) ; le shop la
   * réapplique et l'enregistre, sans jamais toucher le portefeuille de coupons.
   */
  checkout: (
    addressId?: string | null,
    applied?: AppliedDiscount | null,
    /** Click & Collect ou livraison — CDC §12. */
    fulfilment?: Fulfilment,
  ) => { ok: false } | { ok: true; orderId: string };
};

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      cart: [],
      favorites: [],
      orders: [],
      points: 120, // solde de démarrage — donne vie à l'écran fidélité
      biometricEnabled: false,
      addresses: [],
      merchantApplication: null,
      vouchers: [],
      preferences: DEFAULT_PREFERENCES,
      userCoord: null,
      conversations: CHAT_SEED.conversations,
      messages: CHAT_SEED.messages,

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

      claimReward: () => {
        if (get().points < REWARD_POINTS) return { ok: false as const };
        const voucher: Voucher = {
          id: makeId(),
          code: makeCode(),
          value: REWARD_VALUE_EUR,
          createdAt: Date.now(),
          usedAt: null,
        };
        set((state) => ({
          points: state.points - REWARD_POINTS,
          vouchers: [voucher, ...state.vouchers],
        }));
        return { ok: true as const, voucher };
      },

      sharePoints: (amount) => {
        // On ne crée pas de points à partir de rien, et on n'en retire pas
        // plus qu'il n'y en a : le solde est la seule source de vérité.
        if (!Number.isInteger(amount) || amount <= 0 || amount > get().points) {
          return { ok: false as const };
        }
        set((state) => ({ points: state.points - amount }));
        return { ok: true as const, code: makeCode() };
      },

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

      sendMessage: (conversationId, body) => {
        const text = body.trim();
        if (!text) return; // pas de bulle vide
        const id = makeId();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              conversation_id: conversationId,
              sender_id: ME,
              body: text,
              created_at: new Date().toISOString(),
            },
          ],
          // Ce qu'on vient d'écrire est lu par définition.
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, lastReadMessageId: id } : c,
          ),
        }));
      },

      receiveMessage: (conversationId, senderId, body) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: makeId(),
              conversation_id: conversationId,
              sender_id: senderId,
              body,
              created_at: new Date().toISOString(),
            },
          ],
        })),

      markConversationRead: (conversationId) =>
        set((state) => {
          const thread = state.messages.filter((m) => m.conversation_id === conversationId);
          const last = thread[thread.length - 1];
          if (!last) return state;
          return {
            conversations: state.conversations.map((c) =>
              c.id === conversationId ? { ...c, lastReadMessageId: last.id } : c,
            ),
          };
        }),

      toggleFavorite: (dealId) =>
        set((state) => ({
          favorites: state.favorites.includes(dealId)
            ? state.favorites.filter((id) => id !== dealId)
            : [dealId, ...state.favorites],
        })),

      checkout: (addressId = null, applied = null, fulfilment = 'livraison') => {
        const { cart } = get();
        const lines = cartLines(cart);
        if (lines.length === 0) return { ok: false as const };

        const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
        // La remise ne dépasse jamais le sous-total : l'appelant la borne déjà,
        // on la reborne ici par sûreté (le montant vient du client en démo).
        const discount = applied
          ? roundEur(Math.min(Math.max(applied.discountEur, 0), subtotal))
          : 0;
        const total = roundEur(subtotal - discount);
        // Les points récompensent ce qui est réellement payé, pas la remise.
        const pointsEarned = Math.round(total * POINTS_PER_EURO);
        const order: Order = {
          id: makeId(),
          createdAt: Date.now(),
          addressId,
          items: lines.map((l) => ({
            dealId: l.deal.id,
            title: l.deal.title,
            emoji: l.deal.emoji,
            qty: l.qty,
            price: l.deal.price,
          })),
          total,
          discount,
          couponCode: applied?.couponCode ?? null,
          // Pas de frais de livraison quand le client vient chercher — CDC §12.
          deliveryFee: fulfilment === 'click-collect' ? 0 : DELIVERY_FEE,
          fulfilment,
          status: 'creee',
          pointsEarned,
          managed: false,
        };

        set((state) => ({
          orders: [order, ...state.orders],
          points: state.points + pointsEarned,
          cart: [],
        }));
        return { ok: true as const, orderId: order.id };
      },
    }),
    {
      name: 'freedoo-shop-v1',
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (s) => ({
        cart: s.cart,
        favorites: s.favorites,
        orders: s.orders,
        points: s.points,
        biometricEnabled: s.biometricEnabled,
        addresses: s.addresses,
        merchantApplication: s.merchantApplication,
        vouchers: s.vouchers,
        conversations: s.conversations,
        messages: s.messages,
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
    return order.fulfilment === 'click-collect' ? 'recuperee' : 'livree';
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
export const selectPoints = (s: ShopState) => s.points;
export const selectVouchers = (s: ShopState) => s.vouchers;
export const selectUnusedVouchers = (s: ShopState) => s.vouchers.filter((v) => v.usedAt === null);

export const selectCartCount = (s: ShopState) => s.cart.reduce((n, i) => n + i.qty, 0);
export const selectCartLines = (s: ShopState) => cartLines(s.cart);
export const selectCartSubtotal = (s: ShopState) =>
  cartLines(s.cart).reduce((sum, l) => sum + l.lineTotal, 0);

export const DELIVERY_FEE_EUR: number = DELIVERY_FEE;

/* ---- messagerie ---- */

export const selectConversations = (s: ShopState) => s.conversations;

export function messagesOf(state: ShopState, conversationId: string): ChatMessage[] {
  return state.messages.filter((m) => m.conversation_id === conversationId);
}

export function lastMessageOf(state: ShopState, conversationId: string): ChatMessage | undefined {
  const list = messagesOf(state, conversationId);
  return list[list.length - 1];
}

/**
 * Non lus = messages des autres situés APRÈS le dernier message vu.
 *
 * Compté par position, pas par date : deux messages peuvent partager la même
 * milliseconde, leur ordre non.
 */
export function unreadCount(state: ShopState, conversationId: string): number {
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return 0;
  const thread = messagesOf(state, conversationId);
  const seen = conv.lastReadMessageId
    ? thread.findIndex((m) => m.id === conv.lastReadMessageId)
    : -1;
  return thread.slice(seen + 1).filter((m) => m.sender_id !== ME).length;
}

export const selectTotalUnread = (s: ShopState) =>
  s.conversations.reduce((n, c) => n + unreadCount(s, c.id), 0);
