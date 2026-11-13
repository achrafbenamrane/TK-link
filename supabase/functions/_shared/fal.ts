// fal.ai — ce qui ne dépend ni de Deno ni du réseau : le texte envoyé au modèle, les paramètres, la
// lecture des réponses de la file d'attente. Testé par Jest (supabase/__tests__/fal.test.ts).
//
// File d'attente fal.ai (https://docs.fal.ai/model-apis/model-endpoints/queue) :
//   - POST https://queue.fal.run/{modèle}            → { request_id, status_url, response_url }
//   - GET  {status_url}                               → { status: IN_QUEUE | IN_PROGRESS | COMPLETED }
//   - GET  {response_url}                             → { images: [{ url }] } ou { video: { url } }
// En-tête : `Authorization: Key <FAL_KEY>`.

export const FAL_QUEUE = 'https://queue.fal.run';

/** Modèles par défaut (remplaçables par les secrets FAL_IMAGE_MODEL / FAL_VIDEO_MODEL). */
export const DEFAULT_IMAGE_MODEL = 'fal-ai/flux/schnell';
export const DEFAULT_VIDEO_MODEL = 'fal-ai/kling-video/v2.1/standard/text-to-video';

export type MediaKind = 'image' | 'video';

/** Les catégories de l'app (src/shared/lib/categories.ts), décrites pour le modèle. */
const SCENE: Record<string, string> = {
  restauration:
    'a welcoming neighbourhood food shop, bakery or restaurant, fresh products on display',
  'high-tech': 'a modern electronics and phone repair shop, neat shelves of devices',
  maison: 'a cosy home goods and decoration shop, warm interior',
  mode: 'a stylish clothing boutique, garments on racks, soft daylight',
  beaute: 'an elegant beauty salon and cosmetics shop, clean and bright',
  sport: 'a dynamic sports equipment store, colourful gear',
  auto: 'a clean car service garage and auto parts shop',
  services: 'a friendly local service business storefront',
};

/** Le texte libre du commerçant, nettoyé : une ligne, 300 caractères au plus. */
export function cleanBrief(raw: unknown): string {
  return typeof raw === 'string'
    ? raw
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300)
    : '';
}

/**
 * Le texte envoyé au modèle. En anglais (les modèles le comprennent mieux), sans texte incrusté
 * (ils écrivent mal), et sans personnes reconnaissables : une vitrine, pas un portrait.
 */
export function buildPrompt(
  kind: MediaKind,
  shopName: string,
  category: string,
  brief: string,
): string {
  const scene = SCENE[category] ?? SCENE.services!;
  const name = shopName
    .replace(/["\r\n]+/g, ' ')
    .trim()
    .slice(0, 80);
  const detail = brief ? ` Details from the shop owner: ${brief}.` : '';
  const style =
    kind === 'video'
      ? 'Slow cinematic camera move, natural light, realistic, 5 seconds.'
      : 'Professional photograph, natural light, realistic, inviting, high detail.';
  return (
    `Showcase of "${name}", ${scene}, in a French city street (Toulouse).${detail} ${style} ` +
    'No text, no logos, no watermark, no identifiable faces.'
  ).slice(0, 1500);
}

/** Les paramètres du modèle. Le filtre de contenu de fal.ai reste toujours actif. */
export function falInput(kind: MediaKind, prompt: string): Record<string, unknown> {
  return kind === 'video'
    ? { prompt, duration: '5', aspect_ratio: '16:9' }
    : { prompt, image_size: 'landscape_16_9', num_images: 1, enable_safety_checker: true };
}

export type FalSubmit = { requestId: string; statusUrl: string; responseUrl: string };

const isQueueUrl = (u: unknown): u is string =>
  typeof u === 'string' && u.startsWith(`${FAL_QUEUE}/`);

/** La réponse à la soumission. Une adresse hors de queue.fal.run est refusée (on y enverrait la clé). */
export function parseSubmit(body: unknown): FalSubmit | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.request_id !== 'string' ||
    !isQueueUrl(b.status_url) ||
    !isQueueUrl(b.response_url)
  ) {
    return null;
  }
  return { requestId: b.request_id, statusUrl: b.status_url, responseUrl: b.response_url };
}

export type FalState = 'en_cours' | 'termine' | 'echec';

export function parseStatus(body: unknown): FalState {
  const s = body && typeof body === 'object' ? (body as Record<string, unknown>).status : null;
  if (s === 'COMPLETED') return 'termine';
  if (s === 'IN_QUEUE' || s === 'IN_PROGRESS') return 'en_cours';
  return 'echec';
}

/** L'adresse du fichier produit, ou `null` (contenu filtré, réponse inattendue). */
export function resultUrl(kind: MediaKind, body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (kind === 'video') {
    const url = (b.video as Record<string, unknown> | undefined)?.url;
    return typeof url === 'string' && url.startsWith('https://') ? url : null;
  }
  // Image écartée par le filtre de contenu : fal.ai la remplace par une image noire et le signale.
  const flagged = b.has_nsfw_concepts;
  if (Array.isArray(flagged) && flagged[0] === true) return null;
  const first = Array.isArray(b.images)
    ? (b.images[0] as Record<string, unknown> | undefined)
    : undefined;
  return typeof first?.url === 'string' && first.url.startsWith('https://') ? first.url : null;
}

/** Extension et type du fichier rangé dans Storage. */
export function storageType(
  kind: MediaKind,
  contentType: string | null,
): { ext: string; mime: string } {
  if (kind === 'video') return { ext: 'mp4', mime: 'video/mp4' };
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return { ext: 'png', mime: 'image/png' };
  if (ct.includes('webp')) return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'jpg', mime: 'image/jpeg' };
}
