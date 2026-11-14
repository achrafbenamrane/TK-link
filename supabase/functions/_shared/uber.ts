// Uber Direct — ce qui ne dépend ni de Deno ni du réseau : format des adresses, correspondance des
// statuts, vérification de la signature des webhooks, lecture des réponses. Testé par Jest
// (supabase/__tests__/uber.test.ts) ; les fonctions Edge (`uber-quote`, `uber-dispatch`,
// `uber-webhook`) ne font qu'appeler l'API autour.
//
// Documentation : https://developer.uber.com/docs/deliveries/overview (API « DaaS »).
//   - jeton : POST https://auth.uber.com/oauth/v2/token, client_credentials, scope eats.deliveries
//   - devis : POST /v1/customers/{customer_id}/delivery_quotes
//   - course : POST /v1/customers/{customer_id}/deliveries, annulation …/deliveries/{id}/cancel
//   - webhooks « event.delivery_status », signés HMAC-SHA256 avec la clé de signature du compte.

export const UBER_AUTH_URL = 'https://auth.uber.com/oauth/v2/token';
export const UBER_API_URL = 'https://api.uber.com/v1/customers';
export const UBER_SCOPE = 'eats.deliveries';

/** Statuts d'une course Uber Direct. */
export type UberDeliveryStatus =
  'pending' | 'pickup' | 'pickup_complete' | 'dropoff' | 'delivered' | 'canceled' | 'returned';

/**
 * Le statut de la commande TK LINK qui correspond à une course Uber, ou `null` s'il ne change pas.
 *
 * - `pending` / `pickup` : un coursier est cherché ou en route vers le commerce — la commande reste
 *   « prête », elle attend d'être prise.
 * - `pickup_complete` / `dropoff` : le colis est parti — « en livraison ».
 * - `delivered` : « livrée ».
 * - `canceled` / `returned` : la course a échoué après paiement — « litige », pour que TK LINK
 *   tranche (relancer une course ou rembourser). Jamais une annulation silencieuse.
 */
export function orderStatusFor(uber: string): 'en_livraison' | 'livree' | 'litige' | null {
  switch (uber) {
    case 'pickup_complete':
    case 'dropoff':
      return 'en_livraison';
    case 'delivered':
      return 'livree';
    case 'canceled':
    case 'returned':
      return 'litige';
    default:
      return null;
  }
}

/** Les statuts de commande qu'un webhook a le droit de remplacer (jamais un statut final). */
export const WEBHOOK_UPDATABLE = ['payee', 'acceptee', 'preparation', 'prete', 'en_livraison'];

/**
 * Une adresse française saisie en une ligne (« 8 rue des Carmes, 31000 Toulouse ») au format
 * qu'attend Uber : un objet JSON SÉRIALISÉ en chaîne. Le code postal et la ville sont repérés quand
 * la ligne se termine par « 31000 Toulouse » ; sinon la ligne entière part en rue, et les
 * coordonnées (envoyées à côté) font foi.
 */
export function uberAddress(line: string): string {
  const clean = line.replace(/\s+/g, ' ').trim();
  const match = /^(.*?)[,\s]+(\d{5})\s+([^,\d][^,]*)$/.exec(clean);
  const street = match?.[1]?.replace(/,\s*$/, '').trim();
  return JSON.stringify(
    match && street
      ? {
          street_address: [street],
          city: match[3]!.trim(),
          state: '',
          zip_code: match[2],
          country: 'FR',
        }
      : { street_address: [clean], city: '', state: '', zip_code: '', country: 'FR' },
  );
}

/** Un numéro au format international attendu par Uber (« +33612345678 »), ou `null`. */
export function uberPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s.\-()]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  // Numéro français saisi à la française : 06 12 34 56 78 → +33612345678.
  if (/^0[1-9]\d{8}$/.test(digits)) return `+33${digits.slice(1)}`;
  if (/^33[1-9]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export type QuoteResult = {
  id: string;
  feeCents: number;
  etaMinutes: number | null;
  expires: string;
};

/** Lit la réponse d'un devis. Une réponse inattendue rend `null` : on ne facture rien d'inventé. */
export function parseQuote(body: unknown, nowMs: number): QuoteResult | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || typeof b.fee !== 'number' || !Number.isInteger(b.fee))
    return null;
  if (b.fee < 0) return null;
  const currency = String(b.currency ?? b.currency_type ?? 'eur').toLowerCase();
  if (currency !== 'eur') return null;
  const eta = typeof b.dropoff_eta === 'string' ? Date.parse(b.dropoff_eta) : NaN;
  return {
    id: b.id,
    feeCents: b.fee,
    etaMinutes: Number.isFinite(eta) ? Math.max(0, Math.round((eta - nowMs) / 60_000)) : null,
    expires: typeof b.expires === 'string' ? b.expires : '',
  };
}

export type DeliveryResult = { id: string; status: string; trackingUrl: string | null };

export function parseDelivery(body: unknown): DeliveryResult | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.id !== 'string' || typeof b.status !== 'string') return null;
  const url =
    typeof b.tracking_url === 'string' && b.tracking_url.startsWith('https://')
      ? b.tracking_url
      : null;
  return { id: b.id, status: b.status, trackingUrl: url };
}

export type WebhookEvent = {
  deliveryId: string;
  status: string;
  trackingUrl: string | null;
  /** `external_id` de la course : l'identifiant de la commande TK LINK. */
  orderId: string | null;
};

/** Lit un événement « event.delivery_status ». Les autres événements rendent `null` (ignorés). */
export function parseWebhook(body: unknown): WebhookEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.kind !== 'event.delivery_status') return null;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;
  const deliveryId = typeof b.delivery_id === 'string' ? b.delivery_id : data.id;
  const status = typeof b.status === 'string' ? b.status : data.status;
  if (typeof deliveryId !== 'string' || typeof status !== 'string') return null;
  const tracking = data.tracking_url;
  return {
    deliveryId,
    status,
    trackingUrl: typeof tracking === 'string' && tracking.startsWith('https://') ? tracking : null,
    orderId: typeof data.external_id === 'string' ? data.external_id : null,
  };
}

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * La signature d'un webhook : HMAC-SHA256 du corps BRUT avec la clé de signature, en hexadécimal
 * (en-tête `x-uber-signature`, ou `x-postmates-signature` sur les anciens comptes). Comparaison à
 * temps constant.
 */
export async function verifyUberSignature(
  rawBody: string,
  signature: string | null,
  signingKey: string,
): Promise<boolean> {
  if (!signature || !signingKey) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(signingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(rawBody)));
  const given = signature.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * Une course qu'on peut encore ANNULER : commandée pour une commande « prête », et le coursier n'a
 * pas encore pris le colis (`pending` : coursier cherché ; `pickup` : en route vers le commerce).
 * Après la prise en charge, le colis voyage : on ne l'arrête plus depuis l'app — c'est un litige que
 * TK LINK tranche.
 */
export const CANCELLABLE_UBER_STATUSES = ['pending', 'pickup'];

export function isCourierCancellable(order: {
  status: string;
  uber_delivery_id: string | null;
  uber_status: string | null;
}): boolean {
  return (
    order.status === 'prete' &&
    typeof order.uber_delivery_id === 'string' &&
    order.uber_delivery_id.length > 0 &&
    CANCELLABLE_UBER_STATUSES.includes(order.uber_status ?? '')
  );
}

/**
 * Une commande part-elle en course Uber Direct ? Une livraison de client final, oui. Une offre pro
 * (migration 0023) est livrée par le grossiste lui-même : ni devis, ni coursier — et son paiement
 * n'attend pas de devis.
 */
export function needsCourier(order: { fulfilment: string; audience?: string | null }): boolean {
  // Refus explicite du B2B plutôt qu'« uniquement les clients » : une ligne lue sans sa colonne
  // `audience` garde le coursier (et son devis) au lieu de livrer gratuitement sans personne.
  return order.fulfilment === 'livraison' && order.audience !== 'commercants';
}
