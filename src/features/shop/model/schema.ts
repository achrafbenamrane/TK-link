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
  emoji: string; // repli si aucune photo
  /** Photo réelle uploadée par le commerçant (URL). Prioritaire sur le visuel
   *  embarqué ; alimentée par le back-end quand il existera. */
  imageUrl?: string;
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
  /**
   * Où livrer. `.default(null)` : les commandes déjà stockées sur les
   * téléphones n'ont pas cette clé, et un champ requis ferait échouer la
   * validation — donc effacerait tout l'historique au prochain lancement.
   */
  addressId: z.string().nullable().default(null),
  items: z.array(OrderLineSchema),
  /** Ce qui est facturé pour les articles : sous-total MOINS la remise coupon. */
  total: z.number(),
  /**
   * Remise appliquée par un coupon (euros). `.default(0)` : les commandes déjà
   * stockées n'ont pas ce champ, et un champ requis les effacerait à la
   * réhydratation — même piège que `addressId`.
   */
  discount: z.number().nonnegative().default(0),
  /** Code du coupon utilisé, pour le reçu ; `null` si aucun. */
  couponCode: z.string().nullable().default(null),
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

/* ---- Fidélité ---- */

/** Un bon d'achat obtenu en échangeant des points. */
export const VoucherSchema = z.object({
  id: z.string().min(1),
  /** Code présenté au commerçant — lisible à voix haute, sans caractères ambigus. */
  code: z.string().min(4),
  /** Valeur en euros. */
  value: z.number().positive(),
  createdAt: z.number().int().positive(),
  usedAt: z.number().int().positive().nullable(),
});
export type Voucher = z.infer<typeof VoucherSchema>;

/* ---- Messagerie ---- */

/**
 * Forme alignée sur `packs/chat-realtime/src/model/chat.ts` (snake_case,
 * `created_at` en ISO) : quand le back-end arrivera, on remplace la source de
 * données, pas les écrans.
 */
export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  /** 'moi' = l'utilisateur ; sinon l'id du commerçant ou 'support'. */
  sender_id: z.string().min(1),
  body: z.string().min(1).max(4000),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string().min(1),
  /** Id du commerçant, ou 'support' pour l'équipe Freedoo. */
  partnerId: z.string().min(1),
  /**
   * Dernier message VU, par identité — pas par horloge.
   *
   * Une date de lecture se compare à `created_at` à la milliseconde près : un
   * message arrivé dans la même milliseconde que l'ouverture du fil est à
   * égalité, et selon le sens de la comparaison on l'avale (jamais notifié) ou
   * on le re-notifie alors qu'il est à l'écran. L'ordre des messages, lui, n'a
   * pas d'ambiguïté.
   *
   * `null` = rien de lu (tout le fil est non lu).
   */
  lastReadMessageId: z.string().nullable().default(null),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ME = 'moi';
export const SUPPORT = 'support';

/** Shape persisted to storage — the merge guard validates against this. */
export const PersistedShopSchema = z.object({
  cart: z.array(CartItemSchema),
  favorites: z.array(z.string()),
  orders: z.array(OrderSchema),
  points: z.number().int().nonnegative(),
  addresses: z.array(AddressSchema).default([]),
  /** Demande envoyée localement, en attendant un back-end pour la recevoir. */
  merchantApplication: MerchantApplicationSchema.nullable().default(null),
  vouchers: z.array(VoucherSchema).default([]),
  conversations: z.array(ConversationSchema).default([]),
  messages: z.array(ChatMessageSchema).default([]),
  // `.default()` et non un champ requis : l'état déjà stocké sur les téléphones
  // n'a pas cette clé. Sans valeur par défaut, safeParse échouerait et le
  // `merge` du store repartirait de zéro — panier et commandes effacés.
  biometricEnabled: z.boolean().default(false),
});
export type PersistedShop = z.infer<typeof PersistedShopSchema>;
