/**
 * Les chiffres du back-office (Vue d'ensemble, Comptes, Revenus), lus dans les VRAIES tables.
 *
 * Sous `/admin` : la serrure (middleware.js) protège cette route comme la page. Clé de SERVICE côté
 * serveur seulement (`SUPABASE_SERVICE_ROLE_KEY` sur Vercel). Sans elle, 503 : la page garde ses
 * chiffres de démonstration. Lecture seule.
 */
import { toStats } from '../../stats';

export const dynamic = 'force-dynamic';

const URL_ = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const json = (status, body) => Response.json(body, { status });

const rest = (path) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    cache: 'no-store',
  });

const configured = () => URL_.startsWith('https://') && KEY.length > 0;

export async function GET() {
  if (!configured()) return json(503, { error: 'not_configured' });
  // Le pilote compte quelques centaines de comptes : une lecture bornée suffit (et se voit si on
  // l'atteint un jour — la borne est dans la réponse).
  const LIMIT = 5000;
  const since = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();
  const [profiles, shops, offers, orders] = await Promise.all([
    rest(`profiles?select=id,first_name,last_name,account_type,created_at&limit=${LIMIT}`),
    rest(`shops?select=id,owner_id,name,siret,address,area,status&limit=${LIMIT}`),
    rest(`flash_offers?select=shop_id&limit=${LIMIT}`),
    rest(
      'flash_orders?select=customer_id,shop_id,status,subtotal_cents,discount_cents,commission_cents,created_at' +
        `&created_at=gte.${since}&limit=${LIMIT}`,
    ),
  ]);
  if (!profiles.ok || !shops.ok || !offers.ok || !orders.ok) {
    return json(502, { error: 'supabase_failed' });
  }
  const stats = toStats(
    await profiles.json(),
    await shops.json(),
    await offers.json(),
    await orders.json(),
    Date.now(),
  );
  return json(200, { ...stats, limit: LIMIT });
}
