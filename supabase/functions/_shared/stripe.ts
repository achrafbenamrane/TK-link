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
      v.forEach((item, i) =>
        parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`),
      );
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
