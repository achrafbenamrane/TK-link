// Stripe Connect — ce qui ne dépend ni de Deno ni du réseau : les montants, l'encodage des requêtes,
// la vérification des webhooks et ce qu'un événement change à une commande. Testé par Jest
// (supabase/__tests__/stripe.test.ts).
//
// Modèle (CDC V1.1) : « Direct charges ». Le client paie le COMMERÇANT (son compte Stripe connecté) ;
// TK LINK prélève ses frais d'application. Le commerçant touche le prix de ses articles moins la
// commission — toujours, même quand TK LINK offre une réduction au client (parrainage) : c'est TK
// LINK qui la finance, sur ce qu'il prélève. Les frais de livraison reviennent à TK LINK, qui paie la
// course Uber Direct.

export const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * Une page de retour Stripe (secret `STRIPE_*_URL`) : une adresse https explicite, sinon rien — et
 * la fonction se dit alors « non configurée ». Jamais d'adresse par défaut : celle d'avant
 * (`tklink.vercel.app`) appartenait à un autre site, où Stripe aurait renvoyé nos clients.
 */
export function returnUrlOf(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.search && !url.hash ? url.toString() : null;
  } catch {
    return null;
  }
}

export type PayableOrder = {
  subtotal_cents: number;
  discount_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  commission_cents: number;
};

/**
 * Ce que TK LINK prélève sur le paiement : commission + livraison − réduction offerte.
 *
 * Le commerçant reçoit `total − frais` = `sous-total − commission`, quelle que soit la réduction.
 * Si la réduction dépasse ce que TK LINK prélève, le prélèvement ne peut pas être négatif en
 * Direct charges : `null`, et la commande ne se paie pas ainsi (il faudrait un virement de TK LINK).
 */
export function applicationFeeCents(order: PayableOrder): number | null {
  const fee = order.commission_cents + order.delivery_fee_cents - order.discount_cents;
  if (fee < 0 || fee > order.total_cents) return null;
  return fee;
}

/** Encodage `application/x-www-form-urlencoded` de Stripe, objets imbriqués compris (`metadata[x]`). */
export function stripeForm(params: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const nested = stripeForm(v as Record<string, unknown>, key);
      if (nested) parts.push(nested);
    } else if (Array.isArray(v)) {
      // Une liste d'objets (les lignes d'une page de paiement) : `line_items[0][quantity]=2`.
      v.forEach((item, i) => {
        if (item && typeof item === 'object') {
          const nested = stripeForm(item as Record<string, unknown>, `${key}[${i}]`);
          if (nested) parts.push(nested);
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * L'en-tête `Stripe-Signature` (« t=…,v1=… ») : HMAC-SHA256 de « t.corps » avec le secret du point
 * de terminaison (`whsec_…`), et un horodatage de moins de `toleranceS` secondes (anti-rejeu).
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowS: number,
  toleranceS = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const fields = header.split(',').map((p) => p.trim().split('='));
  const t = Number(fields.find(([k]) => k === 't')?.[1]);
  const signatures = fields.filter(([k]) => k === 'v1').map(([, v]) => (v ?? '').toLowerCase());
  if (!Number.isFinite(t) || signatures.length === 0 || Math.abs(nowS - t) > toleranceS)
    return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  return signatures.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ s.charCodeAt(i);
    return diff === 0;
  });
}

/** Ce qu'un événement Stripe change. `null` : événement sans effet ici. */
export type StripeEffect =
  | { kind: 'order_paid'; paymentIntentId: string; orderId: string | null }
  | { kind: 'order_refunded'; paymentIntentId: string }
  | { kind: 'refund_failed'; paymentIntentId: string; reason: string }
  | { kind: 'order_disputed'; paymentIntentId: string; disputeId: string }
  | { kind: 'account_updated'; accountId: string; chargesEnabled: boolean }
  | null;

export function effectOf(event: unknown): StripeEffect {
  if (!event || typeof event !== 'object') return null;
  const e = event as { type?: unknown; data?: { object?: Record<string, unknown> } };
  const obj = e.data?.object;
  if (!obj || typeof obj !== 'object') return null;
  switch (e.type) {
    case 'payment_intent.succeeded': {
      if (typeof obj.id !== 'string') return null;
      const meta = (obj.metadata ?? {}) as Record<string, unknown>;
      return {
        kind: 'order_paid',
        paymentIntentId: obj.id,
        orderId: typeof meta.order_id === 'string' ? meta.order_id : null,
      };
    }
    case 'charge.refunded':
      // Remboursement TOTAL seulement : un remboursement partiel ne change pas le statut.
      return typeof obj.payment_intent === 'string' && obj.refunded === true
        ? { kind: 'order_refunded', paymentIntentId: obj.payment_intent }
        : null;
    // Un remboursement qui échoue APRÈS coup (carte expirée, compte fermé) : rare, mais l'argent n'est
    // alors jamais revenu au client. Stripe l'annonce sous deux noms selon la version de l'API.
    case 'charge.refund.updated':
    case 'refund.updated':
    case 'refund.failed':
      return obj.status === 'failed' && typeof obj.payment_intent === 'string'
        ? {
            kind: 'refund_failed',
            paymentIntentId: obj.payment_intent,
            reason: `refund_failed:${typeof obj.failure_reason === 'string' ? obj.failure_reason : 'unknown'}`,
          }
        : null;
    // Le client conteste le paiement auprès de sa banque : à traiter dans Stripe avant l'échéance.
    case 'charge.dispute.created':
      return typeof obj.payment_intent === 'string' && typeof obj.id === 'string'
        ? { kind: 'order_disputed', paymentIntentId: obj.payment_intent, disputeId: obj.id }
        : null;
    case 'account.updated':
      return typeof obj.id === 'string'
        ? {
            kind: 'account_updated',
            accountId: obj.id,
            chargesEnabled: obj.charges_enabled === true,
          }
        : null;
    default:
      return null;
  }
}

export type CheckoutItem = { title: string; qty: number; unit_price_cents: number };

/**
 * Les paramètres d'une page de paiement Stripe Checkout pour une commande (Direct charges : créée au
 * nom du commerçant). Le détail des articles s'affiche ; une réduction offerte par TK LINK ne peut
 * pas être une ligne négative chez Checkout : la commande se résume alors en une ligne au total.
 * La page expire au bout de 30 minutes (minimum imposé par Stripe).
 */
export function checkoutParams(input: {
  order: PayableOrder & { id: string };
  items: CheckoutItem[];
  shopName: string;
  fee: number;
  returnUrl: string;
  email?: string | null;
  nowS: number;
}): Record<string, unknown> {
  const { order, items, shopName, fee, returnUrl, email, nowS } = input;
  const line = (name: string, cents: number, quantity: number) => ({
    price_data: { currency: 'eur', unit_amount: cents, product_data: { name } },
    quantity,
  });
  const lines =
    order.discount_cents > 0
      ? [line(`Commande TK LINK — ${shopName}`, order.total_cents, 1)]
      : [
          ...items.map((i) => line(i.title, i.unit_price_cents, i.qty)),
          ...(order.delivery_fee_cents > 0
            ? [line('Livraison Uber Direct', order.delivery_fee_cents, 1)]
            : []),
        ];
  const back = (state: 'ok' | 'annule') =>
    `${returnUrl}?commande=${encodeURIComponent(order.id)}&etat=${state}`;
  return {
    mode: 'payment',
    // La carte seule (Apple Pay et Google Pay en sont) : un moyen à règlement différé (prélèvement
    // SEPA…) laisserait une page « complete » mais impayée, payée après l'annulation de la réservation.
    payment_method_types: ['card'],
    line_items: lines,
    payment_intent_data: {
      // Rien à prélever (crédit de parrainage égal à la commission, Touch & Collect) : on n'envoie pas
      // de frais du tout plutôt qu'un « 0 » que Stripe pourrait refuser.
      ...(fee > 0 ? { application_fee_amount: fee } : {}),
      description: `TK LINK — ${shopName}`,
      metadata: { order_id: order.id },
    },
    metadata: { order_id: order.id },
    client_reference_id: order.id,
    ...(email ? { customer_email: email } : {}),
    success_url: back('ok'),
    cancel_url: back('annule'),
    expires_at: nowS + 30 * 60,
    locale: 'fr',
  };
}

/** La somme que Checkout facturera : doit être EXACTEMENT le total de la commande. */
export function checkoutTotal(params: Record<string, unknown>): number {
  const lines = (params.line_items ?? []) as {
    price_data: { unit_amount: number };
    quantity: number;
  }[];
  return lines.reduce((s, l) => s + l.price_data.unit_amount * l.quantity, 0);
}

// ─────────────────────────────────────────────── les versements d'un commerce (onglet Versements)

/** Le solde d'un compte connecté, en euros : ce qui est disponible, et ce qui est en attente. */
export type StripeBalance = { availableCents: number; pendingCents: number };

/**
 * `GET /v1/balance` (au nom du compte connecté) → le solde en EUR. Stripe rend une liste par devise ;
 * on ne garde que l'euro. `null` si la réponse n'a pas la forme attendue.
 */
export function parseBalance(body: unknown): StripeBalance | null {
  const b = body as { available?: unknown; pending?: unknown } | null;
  if (!b || !Array.isArray(b.available) || !Array.isArray(b.pending)) return null;
  const eur = (list: unknown[]) =>
    list.reduce<number>((sum, x) => {
      const e = x as { amount?: unknown; currency?: unknown } | null;
      return e && e.currency === 'eur' && Number.isInteger(e.amount)
        ? sum + (e.amount as number)
        : sum;
    }, 0);
  return { availableCents: eur(b.available), pendingCents: eur(b.pending) };
}

export const PAYOUT_STATUSES = ['paid', 'pending', 'in_transit', 'canceled', 'failed'] as const;
export type StripePayout = {
  id: string;
  amountCents: number;
  /** Date d'arrivée prévue (ou effective) sur le compte bancaire, en millisecondes. */
  arrivalDate: number;
  status: (typeof PAYOUT_STATUSES)[number];
};

/** `GET /v1/payouts` (au nom du compte connecté) → les virements en EUR, tels que Stripe les date. */
export function parsePayouts(body: unknown): StripePayout[] {
  const list = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(list)) return [];
  return list.flatMap((x) => {
    const p = x as {
      id?: unknown;
      amount?: unknown;
      arrival_date?: unknown;
      status?: unknown;
      currency?: unknown;
    } | null;
    if (
      !p ||
      typeof p.id !== 'string' ||
      !Number.isInteger(p.amount) ||
      typeof p.arrival_date !== 'number' ||
      p.currency !== 'eur' ||
      !PAYOUT_STATUSES.includes(p.status as StripePayout['status'])
    ) {
      return [];
    }
    return [
      {
        id: p.id,
        amountCents: p.amount as number,
        arrivalDate: p.arrival_date * 1000,
        status: p.status as StripePayout['status'],
      },
    ];
  });
}

// ──────────────────────────────────────── les pages de paiement déjà ouvertes (races, 13/11/2026)

/**
 * Une commande a déjà une page de paiement : que faire quand on en redemande une ?
 * - `open` : la rendre (second appui, retour dans l'app) ;
 * - `complete` : elle vient d'être payée (le webhook n'est pas encore arrivé) — surtout pas une
 *   seconde page, on paierait deux fois ;
 * - `expired` : en ouvrir une nouvelle ;
 * - autre chose (Stripe injoignable, réponse inattendue) : ne rien ouvrir.
 */
export function nextCheckoutStep(
  existingStatus: unknown,
): 'reuse' | 'already_paid' | 'new' | 'stripe_failed' {
  if (existingStatus === 'open') return 'reuse';
  if (existingStatus === 'complete') return 'already_paid';
  if (existingStatus === 'expired') return 'new';
  return 'stripe_failed';
}

/**
 * Après « expirer la page » (`POST checkout/sessions/:id/expire`) : annuler la réservation, ou non.
 * Expirée par nous, ou déjà expirée d'elle-même (30 minutes) : on annule. Payée entre-temps : on ne
 * touche à rien. Sinon (Stripe injoignable, page encore ouverte) : on ne sait pas — on n'annule pas.
 */
export function afterExpire(
  expireHttpStatus: number,
  sessionStatus: unknown,
): 'cancel' | 'already_paid' | 'stripe_failed' {
  if (expireHttpStatus >= 200 && expireHttpStatus < 300) return 'cancel';
  if (sessionStatus === 'expired') return 'cancel';
  if (sessionStatus === 'complete') return 'already_paid';
  return 'stripe_failed';
}

// ─────────────────────────────────────────── rembourser une commande (migration 0027, `order-refund`)

export type RefundableOrder = {
  id: string;
  status: string;
  stripe_payment_intent_id: string | null;
  uber_delivery_id: string | null;
  uber_status: string | null;
  /** L'instant du passage en « remboursement en cours » : une tentative = une clé d'idempotence. */
  updated_at?: string | null;
};

/** Une course Uber Direct terminée, d'une façon ou d'une autre : plus de coursier sur la route. */
const COURIER_DONE = ['canceled', 'returned', 'delivered'];

/** Pourquoi un remboursement ne part pas tout seul : la commande revient alors en « litige ». */
export type RefundBlocker =
  'stripe_not_configured' | 'no_payment' | 'no_account' | 'courier_active';

/** Les statuts qui attendent leur remboursement : signalée ou décidée, et refusée par le commerce. */
export const AWAITING_REFUND = ['remboursement_en_cours', 'refusee'];

/**
 * Que faire d'une commande « remboursement en cours » (ou « refusée » par le commerce) ?
 * - `skip` : elle ne l'attend plus (rejeu, autre onglet, webhook arrivé avant) — rien ;
 * - `manual` : impossible sans un humain (pas de clé Stripe, pas de paiement, pas de compte, ou un
 *   coursier qui roule encore : rembourser d'abord, ce serait livrer gratuitement) ;
 * - `refund` : le remboursement TOTAL, au nom du commerce (Direct charges). `refund_application_fee` :
 *   TK LINK rend aussi ce qu'il a prélevé (commission, livraison) — sinon le commerçant rembourserait
 *   de sa poche un argent qu'il n'a jamais touché.
 *
 * Deux fois rembourser est impossible : un remboursement TOTAL d'un paiement déjà remboursé est
 * refusé par Stripe (`charge_already_refunded`). La clé d'idempotence vaut pour UNE tentative (la
 * commande et l'instant où elle est passée « remboursement en cours ») : Stripe rejoue la réponse
 * d'une clé pendant 24 h, échec compris — une nouvelle décision « Rembourser » après un refus doit
 * pouvoir réessayer.
 */
export function refundPlan(
  order: RefundableOrder,
  account: string | null,
  configured: boolean,
):
  | { kind: 'skip' }
  | { kind: 'manual'; reason: RefundBlocker }
  | {
      kind: 'refund';
      account: string;
      idempotencyKey: string;
      params: Record<string, unknown>;
    } {
  if (!AWAITING_REFUND.includes(order.status)) return { kind: 'skip' };
  if (!configured) return { kind: 'manual', reason: 'stripe_not_configured' };
  if (!order.stripe_payment_intent_id) return { kind: 'manual', reason: 'no_payment' };
  if (!account) return { kind: 'manual', reason: 'no_account' };
  if (order.uber_delivery_id && !COURIER_DONE.includes(order.uber_status ?? '')) {
    return { kind: 'manual', reason: 'courier_active' };
  }
  const attempt = order.updated_at ? Date.parse(order.updated_at) : Number.NaN;
  return {
    kind: 'refund',
    account,
    idempotencyKey: `tklink-refund-${order.id}${Number.isFinite(attempt) ? `-${attempt}` : ''}`,
    params: {
      payment_intent: order.stripe_payment_intent_id,
      refund_application_fee: true,
      reason: 'requested_by_customer',
      metadata: { order_id: order.id },
    },
  };
}

/**
 * La réponse de Stripe à `POST /v1/refunds` → le nouveau statut de la commande (`null` : inchangé).
 * - fait (`succeeded`) : « remboursée » ;
 * - en route (`pending`, `requires_action`) : inchangé, le webhook finira — surtout pas réécrire le
 *   statut : repasser « remboursement en cours » relancerait le déclencheur ;
 * - déjà remboursée chez Stripe (à la main, par exemple) : « remboursée » ;
 * - autre chose (refus, Stripe injoignable) : « litige », avec la raison pour le back-office.
 */
export function afterRefund(
  httpStatus: number,
  body: Record<string, unknown> | null,
): {
  status: 'remboursee' | 'litige' | null;
  refundId: string | null;
  failure: string | null;
} {
  const id = typeof body?.id === 'string' ? body.id : null;
  if (httpStatus >= 200 && httpStatus < 300 && id) {
    if (body?.status === 'succeeded') return { status: 'remboursee', refundId: id, failure: null };
    if (body?.status === 'pending' || body?.status === 'requires_action') {
      return { status: null, refundId: id, failure: null };
    }
    return {
      status: 'litige',
      refundId: id,
      failure: `refund_${String(body?.status ?? 'unknown')}`,
    };
  }
  const error = (body?.error ?? null) as { code?: unknown } | null;
  const code = typeof error?.code === 'string' ? error.code : null;
  if (code === 'charge_already_refunded') {
    return { status: 'remboursee', refundId: null, failure: null };
  }
  return {
    status: 'litige',
    refundId: null,
    failure: `stripe_failed:${code ?? (httpStatus || 'unreachable')}`.slice(0, 200),
  };
}
