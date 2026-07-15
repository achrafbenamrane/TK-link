import { z } from 'zod';

/**
 * Domain contract for the Freedoo shop (flash sales, cart, orders).
 *
 * Static catalog data (merchants/deals) is authored in-code (`catalog.ts`)
 * and typed here. State that crosses the storage edge (cart, favorites,
 * orders) is validated with Zod on rehydration — see model/store.ts.
 */

export const CATEGORIES = ['restos', 'artisans', 'courses', 'shopping'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  restos: 'Restos',
  artisans: 'Artisans',
  courses: 'Courses',
  shopping: 'Shopping',
};

/** WGS84 point — what Mapbox and the geo helpers speak. */
export type Coord = { lat: number; lng: number };

export type Merchant = {
  id: string;
  name: string;
  area: string; // quartier de Toulouse
  coord: Coord; // position réelle du commerçant (vue carte)
  rating: number;
  halal: boolean;
  emoji: string;
};

export type Deal = {
  id: string;
  title: string;
  merchantId: string;
  category: Category;
  emoji: string; // placeholder produit (remplacé par une vraie photo plus tard)
  tint: string; // couleur de fond de la vignette
  price: number; // prix flash (€)
  oldPrice?: number;
  unit?: string; // « la pièce », « les 500 g »…
  rating: number;
  stockTotal: number;
  stockLeft: number;
  endsInSeconds: number; // amorce du compte à rebours
  description: string;
  perk?: string; // « 50 % sur le 2ᵉ »
  origin?: string;
  flag?: string;
};

/* ---- State that hits storage → validated with Zod ---- */

export const CartItemSchema = z.object({
  dealId: z.string().min(1),
  qty: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const OrderStatusSchema = z.enum(['en_preparation', 'en_livraison', 'livree']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderLineSchema = z.object({
  dealId: z.string(),
  title: z.string(),
  emoji: z.string(),
  qty: z.number().int().positive(),
  price: z.number(),
});

export const OrderSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().positive(),
  items: z.array(OrderLineSchema),
  total: z.number(),
  deliveryFee: z.number(),
  status: OrderStatusSchema,
  pointsEarned: z.number().int().nonnegative(),
});
export type Order = z.infer<typeof OrderSchema>;

/** Shape persisted to storage — the merge guard validates against this. */
export const PersistedShopSchema = z.object({
  cart: z.array(CartItemSchema),
  favorites: z.array(z.string()),
  orders: z.array(OrderSchema),
  points: z.number().int().nonnegative(),
  // `.default()` et non un champ requis : l'état déjà stocké sur les téléphones
  // n'a pas cette clé. Sans valeur par défaut, safeParse échouerait et le
  // `merge` du store repartirait de zéro — panier et commandes effacés.
  biometricEnabled: z.boolean().default(false),
});
export type PersistedShop = z.infer<typeof PersistedShopSchema>;
