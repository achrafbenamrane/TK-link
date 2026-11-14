import { z } from 'zod';

/**
 * Ce qu’une notification de TK LINK porte (fonction Edge `push-events`) : un genre et un
 * identifiant, rien d’autre — une notification n’est pas un canal sûr, on n’y met ni montant ni
 * donnée personnelle. Validé avant toute navigation : une charge inattendue n’ouvre rien.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PushDataSchema = z.object({
  // `shop` : un commerce suivi publie une vente flash (0026) — sa vitrine, avec `offer` à épingler
  // en tête si elle est déjà en ligne (demande du client, 14/11/2026). `offer` seul : l'ancienne
  // forme (l'offre directement), gardée pour les notifications envoyées avant.
  kind: z.enum(['order', 'merchant_order', 'support', 'offer', 'shop']),
  id: z.string().regex(UUID),
  offer: z.string().regex(UUID).optional(),
});
export type PushData = z.infer<typeof PushDataSchema>;

/** L’écran qu’ouvre le toucher d’une notification. */
export type PushRoute =
  | { pathname: '/commande/[id]'; params: { id: string } }
  | { pathname: '/aide/[id]'; params: { id: string } }
  | { pathname: '/produit/[id]'; params: { id: string } }
  | { pathname: '/enseigne/[id]'; params: { id: string; offre?: string } }
  | '/commandes';

export function routeForPush(data: unknown): PushRoute | null {
  const parsed = PushDataSchema.safeParse(data);
  if (!parsed.success) return null;
  const { kind, id, offer } = parsed.data;
  switch (kind) {
    case 'order':
      return { pathname: '/commande/[id]', params: { id } };
    case 'support':
      return { pathname: '/aide/[id]', params: { id } };
    // Une nouvelle commande pour le commerçant : son écran de service, les commandes reçues.
    case 'merchant_order':
      return '/commandes';
    case 'offer':
      return { pathname: '/produit/[id]', params: { id } };
    case 'shop':
      return { pathname: '/enseigne/[id]', params: offer ? { id, offre: offer } : { id } };
  }
}

/** Ce qui se garde d’un lancement à l’autre : le jeton enregistré, pour le retirer à la déconnexion. */
export const PersistedSchema = z.object({
  token: z.string().nullable().default(null),
});
