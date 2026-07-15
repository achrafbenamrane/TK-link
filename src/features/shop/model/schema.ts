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

/* ---- Adresses de livraison ---- */

export const AddressSchema = z.object({
  id: z.string().min(1),
  /** « Maison », « Bureau »… */
  label: z.string().min(1, 'Donnez un nom à cette adresse'),
  street: z.string().min(3, 'Indiquez la rue et le numéro'),
  zip: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres'),
  city: z.string().min(2, 'Indiquez la ville'),
  /** Étage, digicode, instructions livreur. */
  notes: z.string().optional(),
  isDefault: z.boolean(),
});
export type Address = z.infer<typeof AddressSchema>;

/** Champs saisis par l'utilisateur — l'id et le défaut sont gérés par le store. */
export const AddressDraftSchema = AddressSchema.omit({ id: true, isDefault: true });
export type AddressDraft = z.infer<typeof AddressDraftSchema>;

/* ---- Demande « Devenir commerçant » ---- */

export const MerchantApplicationSchema = z.object({
  shopName: z.string().min(2, 'Indiquez le nom de votre commerce'),
  category: z.enum(CATEGORIES, { error: 'Choisissez une catégorie' }),
  contactName: z.string().min(2, 'Indiquez votre nom'),
  phone: z
    .string()
    .regex(
      /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
      'Numéro français invalide (ex. 06 12 34 56 78)',
    ),
  email: z.email('Adresse e-mail invalide'),
  area: z.string().min(2, 'Indiquez votre quartier'),
});
export type MerchantApplication = z.infer<typeof MerchantApplicationSchema>;

/** Shape persisted to storage — the merge guard validates against this. */
export const PersistedShopSchema = z.object({
  cart: z.array(CartItemSchema),
  favorites: z.array(z.string()),
  orders: z.array(OrderSchema),
  points: z.number().int().nonnegative(),
  addresses: z.array(AddressSchema).default([]),
  /** Demande envoyée localement, en attendant un back-end pour la recevoir. */
  merchantApplication: MerchantApplicationSchema.nullable().default(null),
  // `.default()` et non un champ requis : l'état déjà stocké sur les téléphones
  // n'a pas cette clé. Sans valeur par défaut, safeParse échouerait et le
  // `merge` du store repartirait de zéro — panier et commandes effacés.
  biometricEnabled: z.boolean().default(false),
});
export type PersistedShop = z.infer<typeof PersistedShopSchema>;
