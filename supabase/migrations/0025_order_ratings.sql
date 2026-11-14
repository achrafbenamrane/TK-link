-- 0025_order_ratings — noter le commerçant, pour de vrai.
--
-- CDC V1.1 (Client, VALIDÉ) : « après une commande terminée : notation du commerçant par étoiles et
-- tags rapides, SANS texte libre ; la moyenne s'affiche sur la vitrine du commerçant ». L'app savait
-- noter une commande de démonstration, mais une commande du serveur n'avait aucune note, et aucune
-- vitrine réelle n'en montrait : « note 0 ».
--
--   1. UNE NOTE PAR COMMANDE, par le client de cette commande, une fois la commande terminée
--      (récupérée au comptoir ou livrée), jamais sur un achat B2B (règle du client final).
--   2. RIEN À MODÉRER : 1 à 5 étoiles et des tags pris dans une liste fermée — la même que l'app
--      (`src/features/shop/lib/rating.ts`, un test Jest vérifie qu'elles ne divergent pas).
--   3. ÉCRITURE PAR LE SERVEUR SEUL (`rate_order`) : aucune règle d'insertion directe.
--   4. LA MOYENNE EST PUBLIQUE (`shop_ratings`), les notes une à une ne le sont pas : chacun relit
--      seulement les siennes. Un compte supprimé laisse une note anonyme : la moyenne ne bouge pas.

create table public.order_ratings (
  order_id uuid primary key references public.flash_orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid references auth.users (id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  tags text[] not null default '{}' check (
    tags <@ array[
      'Rapide',
      'Produit frais',
      'Bien emballé',
      'Accueil agréable',
      'Conforme à l’offre',
      'Bon rapport qualité-prix'
    ]::text[]
    and cardinality(tags) <= 6
  ),
  created_at timestamptz not null default now()
);

create index order_ratings_shop_idx on public.order_ratings (shop_id);
create index order_ratings_customer_idx on public.order_ratings (customer_id);

alter table public.order_ratings enable row level security;

create policy order_ratings_read_own on public.order_ratings
  for select to authenticated
  using (customer_id = (select auth.uid()));

revoke insert, update, delete on public.order_ratings from anon, authenticated;

-- Noter sa commande. Les refus ont des noms stables (lus par l'app) :
--   not_authenticated, order_not_found (pas la sienne, ou inexistante), not_ratable (achat B2B),
--   not_finished, invalid_rating, already_rated.
create or replace function public.rate_order(p_order uuid, p_stars integer, p_tags text[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order record;
  v_tags text[] := coalesce(p_tags, '{}');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select o.id, o.shop_id, o.customer_id, o.status, o.audience
    into v_order
    from public.flash_orders o
   where o.id = p_order;
  if not found or v_order.customer_id is distinct from v_uid then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.audience <> 'clients' then
    raise exception 'not_ratable' using errcode = 'P0001';
  end if;
  if v_order.status not in ('recuperee', 'livree') then
    raise exception 'not_finished' using errcode = 'P0001';
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5
     or cardinality(v_tags) > 6
     or (select count(distinct t) from unnest(v_tags) t) <> cardinality(v_tags) then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  begin
    insert into public.order_ratings (order_id, shop_id, customer_id, stars, tags)
    values (v_order.id, v_order.shop_id, v_uid, p_stars, v_tags);
  exception
    when unique_violation then
      raise exception 'already_rated' using errcode = 'P0001';
    when check_violation then
      raise exception 'invalid_rating' using errcode = '22023';
  end;
end;
$$;

-- La moyenne des commerces demandés (une décimale) et le nombre de notes. Ouverte à tous : c'est ce
-- que la vitrine affiche.
create or replace function public.shop_ratings(p_shops uuid[])
  returns table (shop_id uuid, average numeric, count integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select r.shop_id, round(avg(r.stars)::numeric, 1), count(*)::integer
    from public.order_ratings r
   where r.shop_id = any (p_shops)
   group by r.shop_id
$$;

revoke execute on function public.rate_order(uuid, integer, text[]) from public, anon;
grant execute on function public.rate_order(uuid, integer, text[]) to authenticated;
revoke execute on function public.shop_ratings(uuid[]) from public;
grant execute on function public.shop_ratings(uuid[]) to anon, authenticated;
