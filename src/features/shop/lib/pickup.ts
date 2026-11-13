/**
 * LE QR DE RETRAIT d’une commande du serveur (Touch & Collect) : l’acheteur le montre, le commerçant
 * le scanne, et le SERVEUR vérifie le code (`confirm_pickup`). Le QR ne prouve rien par lui-même.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ce que le QR contient. */
export function pickupPayload(orderId: string, code: string): string {
  return JSON.stringify({ v: 1, id: orderId, code });
}

/** Le contenu d’un QR scanné, s’il s’agit bien d’un QR de retrait TK LINK ; sinon `null`. */
export function parsePickupQr(value: string): { orderId: string; code: string } | null {
  try {
    const data = JSON.parse(value) as { v?: unknown; id?: unknown; code?: unknown };
    if (data?.v !== 1 || typeof data.id !== 'string' || typeof data.code !== 'string') return null;
    if (!UUID.test(data.id) || !/^\d{6}$/.test(data.code)) return null;
    return { orderId: data.id, code: data.code };
  } catch {
    return null;
  }
}
