// Relève une génération lancée par `ai-media-start` — appelé par le COMMERÇANT, toutes les quelques
// secondes, tant que le visuel est « en cours ». Une fois prêt, le fichier est COPIÉ dans Storage
// (`shop-media/<commerce>/<visuel>.<ext>`) : les adresses de fal.ai expirent, la vitrine doit durer.
//
// Sécurité : l'appelant doit être le titulaire du commerce du visuel. Les adresses de fal.ai
// interrogées (avec la clé) sont celles rangées par le serveur, vérifiées sur queue.fal.run.
import { adminClient, callerOf, CORS, jsonBody, reply, UUID } from '../_shared/http.ts';
import { FAL_QUEUE, type MediaKind, parseStatus, resultUrl, storageType } from '../_shared/fal.ts';

const FAL_KEY = Deno.env.get('FAL_KEY') ?? '';
// Au-delà, une génération est déclarée ratée (fal.ai garde les requêtes, pas nous).
const GIVE_UP_MS = 15 * 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!FAL_KEY) return reply(503, { error: 'ai_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const mediaId = (await jsonBody(req))?.mediaId;
  if (typeof mediaId !== 'string' || !UUID.test(mediaId))
    return reply(400, { error: 'invalid_media' });

  const admin = adminClient();
  const { data: media } = await admin
    .from('shop_media')
    .select('id, shop_id, kind, status, url, fal_status_url, fal_response_url, created_at')
    .eq('id', mediaId)
    .maybeSingle();
  if (!media) return reply(404, { error: 'media_not_found' });
  const { data: shop } = await admin
    .from('shops')
    .select('owner_id')
    .eq('id', media.shop_id)
    .maybeSingle();
  if (shop?.owner_id !== user.id) return reply(404, { error: 'media_not_found' });

  if (media.status !== 'en_cours') return reply(200, { status: media.status, url: media.url });

  const now = new Date().toISOString();
  const fail = async (code: string) => {
    await admin
      .from('shop_media')
      .update({ status: 'echec', error: code, updated_at: now })
      .eq('id', media.id);
    return reply(200, { status: 'echec' });
  };

  const queued = (u: unknown): u is string =>
    typeof u === 'string' && u.startsWith(`${FAL_QUEUE}/`);
  if (!queued(media.fal_status_url) || !queued(media.fal_response_url)) {
    return Date.now() - Date.parse(media.created_at) > GIVE_UP_MS
      ? fail('never_submitted')
      : reply(200, { status: 'en_cours' });
  }

  const auth = { Authorization: `Key ${FAL_KEY}` };
  const statusRes = await fetch(media.fal_status_url, { headers: auth }).catch(() => null);
  if (!statusRes?.ok) return reply(200, { status: 'en_cours' });
  const state = parseStatus(await statusRes.json().catch(() => null));
  if (state === 'en_cours') {
    return Date.now() - Date.parse(media.created_at) > GIVE_UP_MS
      ? fail('timeout')
      : reply(200, { status: 'en_cours' });
  }
  if (state === 'echec') return fail('fal_failed');

  const resultRes = await fetch(media.fal_response_url, { headers: auth }).catch(() => null);
  const source = resultRes?.ok
    ? resultUrl(media.kind as MediaKind, await resultRes.json().catch(() => null))
    : null;
  if (!source) return fail('no_result');

  // Copier le fichier chez nous.
  const file = await fetch(source).catch(() => null);
  if (!file?.ok) return fail('download_failed');
  const { ext, mime } = storageType(media.kind as MediaKind, file.headers.get('content-type'));
  const path = `${media.shop_id}/${media.id}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from('shop-media')
    .upload(path, await file.arrayBuffer(), { contentType: mime, upsert: true });
  if (uploadError) return fail('upload_failed');
  const url = admin.storage.from('shop-media').getPublicUrl(path).data.publicUrl;

  await admin
    .from('shop_media')
    .update({ status: 'pret', url, updated_at: now })
    .eq('id', media.id)
    .eq('status', 'en_cours');

  return reply(200, { status: 'pret', url });
});
