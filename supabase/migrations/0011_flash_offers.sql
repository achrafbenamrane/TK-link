-- 0011_flash_offers — les Flash publiées par les professionnels, lues en direct par les clients.
--
-- Étape 2 du branchement du marché (docs/architecture/exec-plans/2026-11-11-marche-sur-supabase.md).
-- Jusqu'ici une Flash ne vivait que sur le téléphone du commerçant : aucun client ne la voyait.
--
-- Quatre règles :
--
--   1. SEUL UN COMMERCE VALIDÉ PUBLIE (CDC V1.1, Commerçant > Règle), et seulement pour lui-même.
--   2. LE SERVEUR TIENT CE QUI SE COMPTE. Le quota d'opérations (les 5 premières offertes, CDC §9,
--      puis les packs), le stock restant, l'heure de début et de fin : le client déclare une durée et
--      une heure souhaitée, le serveur calcule. `stock_left` n'est dans aucun droit client — il ne
--      baissera que par une commande (étape 3), sous verrou.
--   3. UN FLASH DURE ENTRE 15 MINUTES ET 2 HEURES (CDC V1.1, VALIDÉ) ; une offre pro (B2B) n'a pas
--      de borne. Le prix flash est inférieur au prix barré.
--   4. LE PUBLIC NE VOIT QUE LES FLASH EN LIGNE D'UN COMMERCE VALIDÉ ; les offres pro ne sont lues que
--      par des professionnels. Le titulaire voit toutes les siennes.
--
-- Les brouillons restent sur le téléphone : ils ne regardent que leur auteur.

-- ───────────────────────────────────────────── le quota, tenu par le dossier du commerce

alter table public.shops
  -- CDC §9 : les cinq premières opérations sont offertes. Réglable par commerce (geste commercial).
  add column ops_free integer not null default 5 check (ops_free >= 0),
  -- Opérations achetées en packs (paiement à venir) : posées par TK LINK, jamais par le client.
  add column ops_purchased integer not null default 0 check (ops_purchased >= 0);

-- ─────────────────────────────────────────────────────────────────────────── table

create table public.flash_offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- CDC §20 : le même geste vend aux clients (Flash) ou aux commerçants (offre pro d'un grossiste).
  audience text not null default 'clients' check (audience in ('clients', 'commercants')),
  title text not null check (char_length(btrim(title)) between 3 and 60),
  category text not null check (
    category in ('restauration', 'high-tech', 'maison', 'mode', 'beaute', 'sport', 'auto', 'services')
  ),
  description text not null default '' check (char_length(description) <= 240),
  -- Prix en CENTIMES (un float sur de la monnaie finit par perdre un centime).
  price_cents integer not null check (price_cents > 0),
  old_price_cents integer not null,
  stock_total integer not null check (stock_total between 1 and 999),
  stock_left integer not null check (stock_left >= 0 and stock_left <= stock_total),
  -- Minimum de commande d'une offre pro (CDC V1.1, Grossiste) ; 1 = pas de minimum.
  min_qty integer not null default 1 check (min_qty >= 1),
  duration_minutes integer not null check (duration_minutes between 1 and 43200),
  -- Des INSTANTS, pas une durée restante : « il reste 285 s » ne survit pas à un téléphone en veille.
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  modes text[] not null default '{touch-collect,livraison}' check (
    cardinality(modes) between 1 and 2 and modes <@ array['touch-collect', 'livraison']
  ),
  photo_url text check (photo_url is null or photo_url ~ '^https://'),
  recurrence text not null default 'aucune' check (
    recurrence in ('aucune', 'quotidienne', 'hebdomadaire', 'mensuelle')
  ),
  -- Retirée par le commerçant avant son terme. Elle ne revient pas en ligne : on republie.
  offline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (old_price_cents > price_cents),
  check (audience <> 'clients' or duration_minutes between 15 and 120)
);

create index flash_offers_live_idx on public.flash_offers (ends_at) where not offline;
create index flash_offers_shop_idx on public.flash_offers (shop_id);

-- ─────────────────────────────────────────────── le gardien : horaires, stock, quota

create or replace function private.flash_offers_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
  v_allowed integer;
  v_used integer;
begin
  if tg_op = 'INSERT' then
    if v_client then
      -- Le stock restant part du stock total ; l'heure de début ne recule pas dans le passé et ne
      -- se programme pas à plus de 30 jours ; la fin découle de la durée.
      new.stock_left := new.stock_total;
      new.offline := false;
      new.starts_at := greatest(coalesce(new.starts_at, now()), now());
      if new.starts_at > now() + interval '30 days' then
        raise exception 'Une offre se programme au plus 30 jours à l''avance'
          using errcode = '23514';
      end if;

      -- Le quota d'opérations : celui des Flash du commerçant (CDC §9). Une offre pro n'en dépend pas.
      if new.audience = 'clients' then
        select s.ops_free + s.ops_purchased into v_allowed
          from public.shops s where s.id = new.shop_id
          for update;
        select count(*) into v_used
          from public.flash_offers f
         where f.shop_id = new.shop_id and f.audience = 'clients';
        if v_used >= v_allowed then
          raise exception 'quota_exhausted' using errcode = 'P0001';
        end if;
      end if;
    end if;
    new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
    return new;
  end if;

  -- UPDATE : le client ne peut que retirer son offre (droit sur `offline` seulement), sans retour.
  new.updated_at := now();
  if v_client and old.offline and not new.offline then
    raise exception 'Une offre retirée ne revient pas en ligne : republiez-la' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger flash_offers_guard
  before insert or update on public.flash_offers
  for each row execute function private.flash_offers_guard();

-- ──────────────────────────────────────────────────────────────────────── droits

grant select on public.flash_offers to anon, authenticated;
grant insert (
  shop_id, audience, title, category, description, price_cents, old_price_cents, stock_total,
  min_qty, duration_minutes, starts_at, modes, photo_url, recurrence
) on public.flash_offers to authenticated;
grant update (offline) on public.flash_offers to authenticated;

-- Le public : les Flash d'un commerce validé, en ligne (pas retirées). L'heure de fin se filtre dans
-- la requête — une offre terminée n'a rien de secret.
create policy "flash: les Flash en ligne sont publiques" on public.flash_offers
  for select to anon, authenticated
  using (
    audience = 'clients'
    and not offline
    and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'valide')
  );

-- Les offres pro : lues par les professionnels seulement (CDC §20).
create policy "flash: les offres pro, aux professionnels" on public.flash_offers
  for select to authenticated
  using (
    audience = 'commercants'
    and not offline
    and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'valide')
    and exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.account_type in ('commercant', 'grossiste')
    )
  );

create policy "flash: les siennes" on public.flash_offers
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

create policy "flash: publier pour son commerce validé" on public.flash_offers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.shops s
       where s.id = shop_id and s.owner_id = (select auth.uid()) and s.status = 'valide'
    )
  );

create policy "flash: retirer la sienne" on public.flash_offers
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- ─────────────────────────────────────────────────────── photos des Flash (Storage)

-- Lecture publique (l'image s'affiche chez tous les clients) ; écriture dans SON dossier seulement
-- (`<id du compte>/…`), images de 5 Mo au plus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flash-photos', 'flash-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "flash-photos: déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'flash-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
