-- 0026_shop_follows — suivre un commerce, être prévenu de ses ventes flash.
--
-- CDC V1.1 (Client, EXIGENCE) : « Découverte : … filtres, favoris et alertes ». Le CDC ne dit pas ce
-- qui déclenche une alerte ; arbitrage du 14/11/2026 (conduite de projet) : un client SUIT un
-- commerce (le cœur de sa vitrine) et reçoit une notification quand ce commerce publie une vente
-- flash. Le cœur des offres, lui, reste un favori sur le téléphone.
--
--   1. CHACUN SES ABONNEMENTS : suivre, ne plus suivre, relire les siens — jamais ceux des autres ;
--      seulement un commerce validé.
--   2. L'ALERTE PART DE LA BASE (même mécanisme que 0024 : pg_net vers `push-events`, secret dans
--      Vault) à la publication d'une Flash CLIENT ; une offre pro de grossiste ne prévient personne.
--   3. PAS D'AVALANCHE : un commerce qui publie cinq offres d'affilée ne réveille pas cinq fois ses
--      abonnés — une alerte par commerce toutes les 30 minutes au plus (garde technique, à régler
--      ici si le client le demande).

create table public.shop_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);

create index shop_follows_shop_idx on public.shop_follows (shop_id);

alter table public.shop_follows enable row level security;

create policy shop_follows_read_own on public.shop_follows
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy shop_follows_insert_own on public.shop_follows
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'valide')
  );

create policy shop_follows_delete_own on public.shop_follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.shop_follows from anon;
revoke update on public.shop_follows from authenticated;
grant select, insert, delete on public.shop_follows to authenticated;

-- Le dernier envoi par commerce : la garde des 30 minutes. Personne d'autre que le déclencheur n'y
-- touche (schéma privé).
create table private.shop_alert_log (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  sent_at timestamptz not null
);

create or replace function private.flash_offers_push()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_rows integer;
begin
  if new.offline then
    return null;
  end if;
  -- Personne ne suit ce commerce : rien à envoyer (et la garde n'est pas consommée).
  if not exists (select 1 from public.shop_follows f where f.shop_id = new.shop_id) then
    return null;
  end if;
  insert into private.shop_alert_log as l (shop_id, sent_at)
  values (new.shop_id, now())
  on conflict (shop_id) do update
    set sent_at = excluded.sent_at
    where l.sent_at < now() - interval '30 minutes';
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return null;
  end if;
  -- Les seules colonnes que lit `push-events` ; les abonnés sont relus par la fonction.
  perform private.post_push_event(
    'flash_offers',
    jsonb_build_object(
      'id', new.id, 'shop_id', new.shop_id, 'title', new.title,
      'audience', new.audience, 'starts_at', new.starts_at
    ),
    null
  );
  return null;
end;
$$;

drop trigger if exists flash_offers_push on public.flash_offers;
create trigger flash_offers_push
  after insert on public.flash_offers
  for each row
  when (new.audience = 'clients')
  execute function private.flash_offers_push();

revoke execute on function private.flash_offers_push() from public, anon, authenticated;
