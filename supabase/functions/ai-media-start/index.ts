// Lance la génération d'une image ou d'une vidéo de présentation du commerce (fal.ai) — appelé par
// le COMMERÇANT. Rend l'identifiant du visuel ; l'app relève ensuite le résultat avec
// `ai-media-status` (une vidéo prend une à trois minutes : on ne la fait pas attendre ici).
//
// Sécurité et coût : l'appelant est identifié par son jeton et doit être le titulaire d'un commerce
// VALIDÉ. Le quota du jour (10 images, 2 vidéos) est vérifié par le serveur avant tout appel payant.
// Le texte envoyé au modèle est construit ici (nom, catégorie, description nettoyée), jamais reçu
// tel quel du téléphone. Secret : FAL_KEY (et, facultatifs, FAL_IMAGE_MODEL / FAL_VIDEO_MODEL).
import { adminClient, callerOf, CORS, jsonBody, reply, serve } from '../_shared/http.ts';
import {
  buildPrompt,
  cleanBrief,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  FAL_QUEUE,
  falInput,
  type MediaKind,
  parseSubmit,
} from '../_shared/fal.ts';

const FAL_KEY = Deno.env.get('FAL_KEY') ?? '';
const MODEL: Record<MediaKind, string> = {
  image: Deno.env.get('FAL_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL,
  video: Deno.env.get('FAL_VIDEO_MODEL') || DEFAULT_VIDEO_MODEL,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (!FAL_KEY) return reply(503, { error: 'ai_not_configured' });

  const user = await callerOf(req);
  if (!user) return reply(401, { error: 'unauthorized' });

  const input = await jsonBody(req);
  const kind = input?.kind;
  if (kind !== 'image' && kind !== 'video') return reply(400, { error: 'invalid_kind' });
  const brief = cleanBrief(input?.brief);

  const admin = adminClient();
  const { data: shop } = await admin
    .from('shops')
    .select('id, name, category, status')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!shop) return reply(404, { error: 'no_shop' });
  if (shop.status !== 'valide') return reply(409, { error: 'shop_not_validated' });

  const { data: left, error: quotaError } = await admin.rpc('shop_media_quota_left', {
    p_shop: shop.id,
    p_kind: kind,
  });
  if (quotaError || typeof left !== 'number') return reply(500, { error: 'server_error' });
  if (left <= 0) return reply(429, { error: 'quota_exhausted' });

  const prompt = buildPrompt(kind, shop.name, shop.category, brief);
  const model = MODEL[kind];

  // La ligne d'abord (elle compte dans le quota même si fal.ai tarde à répondre).
  const { data: row, error: insertError } = await admin
    .from('shop_media')
    .insert({ shop_id: shop.id, kind, brief, prompt, fal_model: model })
    .select('id')
    .single();
  if (insertError || !row) return reply(500, { error: 'server_error' });

  const fail = (code: string) =>
    admin
      .from('shop_media')
      .update({ status: 'echec', error: code, updated_at: new Date().toISOString() })
      .eq('id', row.id);

  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(falInput(kind, prompt)),
  }).catch(() => null);
  const submitted = res?.ok ? parseSubmit(await res.json().catch(() => null)) : null;
  if (!submitted) {
    await fail(res ? `fal_${res.status}` : 'fal_unreachable');
    return reply(502, { error: 'ai_failed' });
  }

  await admin
    .from('shop_media')
    .update({
      fal_request_id: submitted.requestId,
      fal_status_url: submitted.statusUrl,
      fal_response_url: submitted.responseUrl,
    })
    .eq('id', row.id);

  return reply(200, { mediaId: row.id, kind, quotaLeft: left - 1 });
});
