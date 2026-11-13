import { z } from 'zod';

/**
 * Ce qu’une notification de TK LINK porte (fonction Edge `push-events`) : un genre et un
 * identifiant, rien d’autre — une notification n’est pas un canal sûr, on n’y met ni montant ni
 * donnée personnelle. Validé avant toute navigation : une charge inattendue n’ouvre rien.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PushDataSchema = z.object({
  kind: z.enum(['order', 'merchant_order', 'support']),
  id: z.string().regex(UUID),
});
export type PushData = z.infer<typeof PushDataSchema>;

/** L’écran qu’ouvre le toucher d’une notification. */
export type PushRoute =
  | { pathname: '/commande/[id]'; params: { id: string } }
  | { pathname: '/aide/[id]'; params: { id: string } }
  | '/commandes';

export function routeForPush(data: unknown): PushRoute | null {
  const parsed = PushDataSchema.safeParse(data);
  if (!parsed.success) return null;
  const { kind, id } = parsed.data;
  switch (kind) {
    case 'order':
      return { pathname: '/commande/[id]', params: { id } };
    case 'support':
      return { pathname: '/aide/[id]', params: { id } };
    // Une nouvelle commande pour le commerçant : son écran de service, les commandes reçues.
    case 'merchant_order':
      return '/commandes';
  }
}

/** Ce qui se garde d’un lancement à l’autre : le jeton enregistré, pour le retirer à la déconnexion. */
export const PersistedSchema = z.object({
  token: z.string().nullable().default(null),
});
