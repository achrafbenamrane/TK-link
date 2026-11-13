-- 0015_shop_media — les images et vidéos de présentation d'un commerce, générées par IA.
--
-- Étape 6 du plan docs/architecture/exec-plans/2026-11-13-rapport-avancement.md : « les commerçants
-- présentent leur boutique sans produire eux-mêmes les visuels ». Décision du 13/11/2026 : fal.ai,
-- appelé par le serveur seulement (secret FAL_KEY). Le modèle économique viendra plus tard : pour
-- l'instant, ouvert à tout commerce validé, dans la limite d'un quota journalier (chaque génération
-- est payée par TK LINK).
--
-- Trois règles :
--
--   1. RIEN NE S'ÉCRIT DEPUIS L'APP. Les lignes naissent et avancent dans les fonctions Edge
--      `ai-media-start` (lancer) et `ai-media-status` (relever le résultat, le copier dans Storage).
--   2. LE QUOTA EST TENU PAR LE SERVEUR (`private.platform_config`) : 10 images et 2 vidéos par
--      commerce et par jour.
--   3. LE PUBLIC VOIT LES VISUELS PRÊTS D'UN COMMERCE VALIDÉ, et que le commerçant a choisi de
--      montrer ; le commerçant voit tous les siens (en cours, ratés compris).

insert into private.platform_config (key, value) values
  ('ai_images_per_day', 10),
  ('ai_videos_per_day', 2)
on conflict (key) do nothing;

create table public.shop_media (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  status text not null default 'en_cours' check (status in ('en_cours', 'pret', 'echec')),
  -- Ce que le commerçant a demandé (sa description), et le texte envoyé au modèle.
  brief text not null default '' check (char_length(brief) <= 300),
  prompt text not null check (char_length(prompt) <= 1500),
  fal_model text not null,
  fal_request_id text unique,
  -- Rendues par fal.ai à la soumission (leur forme dépend du modèle) ; toujours sur queue.fal.run.
  fal_status_url text check (fal_status_url is null or fal_status_url ~ '^https://queue\.fal\.run/'),
  fal_response_url text check (fal_response_url is null or fal_response_url ~ '^https://queue\.fal\.run/'),
  -- L'adresse PUBLIQUE du fichier copié dans Storage (`shop-media`), une fois prêt.
  url text check (url is null or url ~ '^https://'),
  -- Montré sur la vitrine ? Le commerçant choisit (fonction `set_shop_media_visible`).
  visible boolean not null default true,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shop_media_shop_idx on public.shop_media (shop_id, created_at desc);

-- Le compte du jour, pour le quota (appelé par `ai-media-start` avec la clé de service).
create or replace function public.shop_media_quota_left(p_shop uuid, p_kind text)
  returns integer
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select greatest(0,
    private.config(case when p_kind = 'video' then 'ai_videos_per_day' else 'ai_images_per_day' end)::integer
    - (select count(*)::integer from public.shop_media m
        where m.shop_id = p_shop and m.kind = p_kind
          and m.status <> 'echec'
          and m.created_at > now() - interval '24 hours'))
$$;

revoke execute on function public.shop_media_quota_left(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_media_quota_left(uuid, text) to service_role;

-- Le commerçant montre ou cache un visuel sur sa vitrine.
create or replace function public.set_shop_media_visible(p_media uuid, p_visible boolean)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.shop_media m
     set visible = p_visible, updated_at = now()
    from public.shops s
   where m.id = p_media and s.id = m.shop_id and s.owner_id = auth.uid();
  if not found then
    raise exception 'not_your_media' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.set_shop_media_visible(uuid, boolean) from public, anon;
grant execute on function public.set_shop_media_visible(uuid, boolean) to authenticated;

grant select on public.shop_media to anon, authenticated;

create policy "shop media: visuels publics d'un commerce validé" on public.shop_media
  for select to anon, authenticated
  using (
    status = 'pret' and visible
    and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'valide')
  );

create policy "shop media: les siens" on public.shop_media
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- Les fichiers : lecture publique, écriture par la clé de service seulement (aucune règle client).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;
