// Les notifications — ce qui ne dépend ni de Deno ni du réseau : QUI prévenir et QUOI lui dire quand
// une commande change de statut ou que TK LINK répond à une demande. Testé par Jest
// (supabase/__tests__/push.test.ts). L'envoi passe par le service Expo
// (https://exp.host/--/api/v2/push/send), qui relaie vers Apple et Google.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = {
  /**
   * Destinataire : l'acheteur, le titulaire du commerce, l'auteur d'une demande, ou les abonnés
   * d'un commerce (0026).
   */
  to: 'customer' | 'shop_owner' | 'ticket_author' | 'shop_followers';
  title: string;
  body: string;
  /** Ce que l'app ouvre au toucher. */
  data: { kind: 'order' | 'merchant_order' | 'support' | 'offer' | 'shop'; id: string };
};

/** `audience` (0023) : `commercants` pour une offre pro — le grossiste livre lui-même. */
type OrderRow = { id: string; status: string; fulfilment: string; audience?: string | null };

/**
 * Le message d'un changement de statut de commande, ou `null` s'il n'y a rien à dire (statut
 * inchangé, étape que personne n'attend). « Payée » prévient le COMMERÇANT : c'est sa nouvelle
 * commande (le paiement vaut acceptation, CDC V1.1) ; la suite prévient l'ACHETEUR.
 */
export function orderMessage(
  record: OrderRow,
  old: { status?: string } | null,
): PushMessage | null {
  if (old?.status === record.status) return null;
  const order = { kind: 'order' as const, id: record.id };
  const delivery = record.fulfilment === 'livraison';
  // Une offre pro (0023) : le grossiste prépare et livre lui-même, l'acheteur est un commerçant.
  if (record.audience === 'commercants') return wholesaleMessage(record, delivery);
  switch (record.status) {
    case 'payee':
      return {
        to: 'shop_owner',
        title: 'Nouvelle commande',
        body: delivery
          ? 'Une commande payée à préparer, en livraison Uber Direct.'
          : 'Une commande payée à préparer, retrait en boutique.',
        data: { kind: 'merchant_order', id: record.id },
      };
    case 'preparation':
      return {
        to: 'customer',
        title: 'En préparation',
        body: 'Le commerçant prépare votre commande.',
        data: order,
      };
    case 'prete':
      return delivery
        ? {
            to: 'customer',
            title: 'Commande prête',
            body: 'Un coursier Uber Direct vient la chercher.',
            data: order,
          }
        : {
            to: 'customer',
            title: 'Commande prête',
            body: 'Venez la retirer : montrez votre QR code au commerçant.',
            data: order,
          };
    case 'en_livraison':
      return {
        to: 'customer',
        title: 'En route',
        body: 'Votre commande est en cours de livraison.',
        data: order,
      };
    case 'livree':
      return {
        to: 'customer',
        title: 'Livrée',
        body: 'Votre commande est arrivée. Bonne dégustation !',
        data: order,
      };
    case 'litige':
      return {
        to: 'customer',
        title: 'Un souci avec votre commande',
        body: 'TK LINK s’en occupe et revient vers vous très vite.',
        data: order,
      };
    case 'remboursement_en_cours':
      return {
        to: 'customer',
        title: 'Remboursement en cours',
        body: 'Il arrive sur votre carte, en général sous 5 à 10 jours ouvrés.',
        data: order,
      };
    case 'remboursee':
      return {
        to: 'customer',
        title: 'Remboursement effectué',
        body: 'Votre commande vous a été remboursée.',
        data: order,
      };
    default:
      return null;
  }
}

/** Les statuts où le commerce a la commande en main : payée, pas encore remise. */
const IN_HAND = ['payee', 'acceptee', 'preparation', 'prete', 'en_livraison'];

/**
 * Ce que le COMMERÇANT doit savoir en plus de l'acheteur (0027) : une commande qu'il a en main part en
 * remboursement — qu'il ne la prépare ni ne la remette. B2C comme B2B (« l'acheteur »).
 */
export function shopNotice(record: OrderRow, old: { status?: string } | null): PushMessage | null {
  if (record.status !== 'remboursement_en_cours' || !IN_HAND.includes(old?.status ?? '')) {
    return null;
  }
  return {
    to: 'shop_owner',
    title: 'Commande remboursée',
    body: 'L’acheteur est remboursé : ne préparez pas cette commande et ne la remettez pas.',
    data: { kind: 'merchant_order', id: record.id },
  };
}

/** Les messages d'une commande B2B : sans Uber Direct ni « Bonne dégustation ». */
function wholesaleMessage(record: OrderRow, delivery: boolean): PushMessage | null {
  const order = { kind: 'order' as const, id: record.id };
  switch (record.status) {
    case 'payee':
      return {
        to: 'shop_owner',
        title: 'Nouvelle commande d’un commerçant',
        body: delivery
          ? 'Une commande payée à préparer, à expédier par vos soins.'
          : 'Une commande payée à préparer, retrait chez vous.',
        data: { kind: 'merchant_order', id: record.id },
      };
    case 'preparation':
      return {
        to: 'customer',
        title: 'En préparation',
        body: 'Le grossiste prépare votre commande.',
        data: order,
      };
    case 'prete':
      return delivery
        ? null
        : {
            to: 'customer',
            title: 'Commande prête',
            body: 'Venez la retirer : donnez votre code de retrait au grossiste.',
            data: order,
          };
    case 'en_livraison':
      return {
        to: 'customer',
        title: 'Expédiée',
        body: 'Le grossiste a expédié votre commande.',
        data: order,
      };
    case 'livree':
      return {
        to: 'customer',
        title: 'Livrée',
        body: 'Votre commande du grossiste est arrivée.',
        data: order,
      };
    case 'litige':
    case 'remboursement_en_cours':
    case 'remboursee':
      return orderMessage({ ...record, audience: 'clients' }, null);
    default:
      return null;
  }
}

/** Une réponse de TK LINK à une demande prévient son auteur ; ses propres messages, non. */
export function supportMessage(record: {
  ticket_id: string;
  from_staff: boolean;
}): PushMessage | null {
  return record.from_staff
    ? {
        to: 'ticket_author',
        title: 'TK LINK vous a répondu',
        body: 'Ouvrez votre demande pour lire la réponse.',
        data: { kind: 'support', id: record.ticket_id },
      }
    : null;
}

/**
 * Un commerce suivi publie une vente flash (0026) : ses abonnés sont prévenus. Une Flash déjà en
 * ligne s'ouvre directement ; une Flash programmée n'est pas encore visible, la notification ouvre
 * alors la vitrine et dit l'heure (Europe/Paris). Une offre pro de grossiste ne prévient personne.
 */
export function followMessage(
  record: {
    id: string;
    shop_id: string;
    title: string;
    audience?: string | null;
    starts_at?: string | null;
  },
  shopName: string,
  nowMs: number,
): PushMessage | null {
  if (record.audience && record.audience !== 'clients') return null;
  const startsMs = record.starts_at ? Date.parse(record.starts_at) : Number.NaN;
  const later = Number.isFinite(startsMs) && startsMs - nowMs > 60_000;
  const time = later
    ? new Date(startsMs).toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return {
    to: 'shop_followers',
    title: shopName || 'Nouvelle vente flash',
    body: later
      ? `Vente flash dès ${time} : ${record.title}`
      : `Nouvelle vente flash : ${record.title}`,
    data: later ? { kind: 'shop', id: record.shop_id } : { kind: 'offer', id: record.id },
  };
}

/** Un jeton Expo valide (« ExponentPushToken[…] » ou « ExpoPushToken[…] »). */
export const isExpoToken = (t: unknown): t is string =>
  typeof t === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);

/** Les envois Expo : un par jeton, par paquets de 100 (limite du service). */
export function expoBatches(tokens: string[], msg: PushMessage): Record<string, unknown>[][] {
  const all = tokens.filter(isExpoToken).map((to) => ({
    to,
    title: msg.title,
    body: msg.body,
    data: msg.data,
    sound: 'default',
    priority: 'high',
  }));
  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < all.length; i += 100) batches.push(all.slice(i, i + 100));
  return batches;
}

/** Les jetons qu'Expo déclare morts (application désinstallée) : à effacer. */
export function deadTokens(sent: string[], response: unknown): string[] {
  const data = (response as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((ticket, i) => {
    const t = ticket as { status?: string; details?: { error?: string } };
    return t?.status === 'error' && t.details?.error === 'DeviceNotRegistered' && sent[i]
      ? [sent[i]!]
      : [];
  });
}
