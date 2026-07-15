import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { makeId } from '@/shared/lib/id';
// Cart/favorites/orders hold no secrets → the plaintext tier is correct.
import { asyncStorageBackend } from '@/shared/lib/storage';

import { getDeal } from './catalog';
import {
  PersistedShopSchema,
  type Address,
  type AddressDraft,
  type CartItem,
  type Deal,
  type MerchantApplication,
  type Order,
} from './schema';

const DELIVERY_FEE = 0; // Freedoo : livraison offerte pour l'utilisateur.
const POINTS_PER_EURO = 1;

export type CartLine = { deal: Deal; qty: number; lineTotal: number };

type ShopState = {
  cart: CartItem[];
  favorites: string[];
  orders: Order[];
  points: number;
  /** Exiger la biométrie à l'ouverture. L'empreinte elle-même n'est jamais stockée. */
  biometricEnabled: boolean;
  addresses: Address[];
  merchantApplication: MerchantApplication | null;

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

  /** Turn the cart into an order, award points, empty the cart. */
  checkout: () => { ok: false } | { ok: true; orderId: string };
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

      toggleFavorite: (dealId) =>
        set((state) => ({
          favorites: state.favorites.includes(dealId)
            ? state.favorites.filter((id) => id !== dealId)
            : [dealId, ...state.favorites],
        })),

      checkout: () => {
        const { cart } = get();
        const lines = cartLines(cart);
        if (lines.length === 0) return { ok: false as const };

        const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
        const pointsEarned = Math.round(total * POINTS_PER_EURO);
        const order: Order = {
          id: makeId(),
          createdAt: Date.now(),
          items: lines.map((l) => ({
            dealId: l.deal.id,
            title: l.deal.title,
            emoji: l.deal.emoji,
            qty: l.qty,
            price: l.deal.price,
          })),
          total,
          deliveryFee: DELIVERY_FEE,
          status: 'en_preparation',
          pointsEarned,
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
      }),
      // Corrupt storage must never crash the app — validate then fall back.
      merge: (persisted, current) => {
        const parsed = PersistedShopSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

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

export const selectCartCount = (s: ShopState) => s.cart.reduce((n, i) => n + i.qty, 0);
export const selectCartLines = (s: ShopState) => cartLines(s.cart);
export const selectCartSubtotal = (s: ShopState) =>
  cartLines(s.cart).reduce((sum, l) => sum + l.lineTotal, 0);

export const DELIVERY_FEE_EUR: number = DELIVERY_FEE;
