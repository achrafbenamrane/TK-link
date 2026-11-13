-- 0012_flash_orders — la commande : réserver une Flash, la payer, la suivre.
--
-- Étape 3 du plan docs/architecture/exec-plans/2026-11-13-rapport-avancement.md (reprise de l'étape 3
-- du plan du marché). Le socle du paiement Stripe Connect et de la livraison Uber Direct.
--
-- Cinq règles :
--
--   1. LE STOCK SE RÉSERVE SOUS VERROU. `reserve_flash()` verrouille les offres, vérifie qu'elles sont en
--      ligne, que le mode de remise est proposé et que le stock suffit, puis le décrémente — dans la
--      même transaction. Deux clients ne peuvent pas acheter la dernière pièce.
--   2. LE SERVEUR FAIT LES PRIX. Le client envoie des identifiants et des quantités, jamais un prix.
--      Le sous-total, la commission (5 %, CDC V1.1, réglable dans `private.platform_config`) et le total
--      sont calculés ici.
--   3. UNE COMMANDE = UN COMMERCE. Stripe Connect en « Direct charges » (CDC V1.1) débite pour le compte
--      d'un seul commerçant : un panier de deux commerces fait deux commandes.
--   4. UNE RÉSERVATION NON PAYÉE EXPIRE (15 minutes, réglable) et rend son stock. Le paiement (étape
--      suivante, Edge Function + webhook Stripe) passe la commande à « payée », qui vaut acceptation
--      (CDC V1.1).
--   5. LE CLIENT NE PILOTE PAS LE STATUT. Aucun droit d'écriture sur les tables : tout passe par des
--      fonctions qui vérifient qui appelle et d'où vient la commande. Le code de retrait (Touch &
--      Collect) n'est lisible que par l'acheteur — le commerçant le reçoit en scannant son QR.

-- ───────────────────────────────────────────────────── réglages de la plateforme (serveur seul)

create table if not exists private.platform_config (
  key text primary key,
  value numeric not null
);

insert into private.platform_config (key, value) values
  -- Commission TK LINK en points de base : 500 = 5 % (CDC V1.1, B2C comme B2B).
  ('commission_bps', 500),
  -- Durée de vie d'une réservation non payée, en minutes.
  ('reservation_minutes', 15),
  -- Réservations non payées qu'un même compte peut tenir en même temps (anti-accaparement).
  ('max_pending_orders', 3)
on conflict (key) do nothing;

create or replace function private.config(p_key text)
  returns numeric
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select value from private.platform_config where key = p_key
$$;

-- ─────────────────────────────────────────────────────────────────────────────────── tables

create table public.flash_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  fulfilment text not null check (fulfilment in ('touch-collect', 'livraison')),
  -- Les identifiants de `src/features/shop/lib/order-status.ts` (sans « panier », qui reste local).
  status text not null default 'paiement_attente' check (
    status in (
      'paiement_attente', 'payee', 'acceptee', 'preparation', 'prete', 'en_livraison', 'recuperee',
      'livree', 'refusee', 'annulee', 'remboursement_en_cours', 'remboursee', 'litige'
    )
  ),
  -- Montants en CENTIMES, calculés par le serveur.
  subtotal_cents integer not null check (subtotal_cents > 0),
  -- Réduction financée par TK LINK (parrainage, Flash boosté) : le commerçant touche son prix plein.
  discount_cents integer not null default 0 check (discount_cents >= 0),
  -- Frais de livraison (devis Uber Direct) ; 0 en Touch & Collect.
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer generated always as (subtotal_cents - discount_cents + delivery_fee_cents) stored,
  commission_cents integer not null check (commission_cents >= 0),
  -- Livraison : l'adresse et le point exact (le coursier en a besoin), un téléphone de contact.
  delivery_address text check (delivery_address is null or char_length(delivery_address) <= 300),
  delivery_lat double precision check (delivery_lat is null or delivery_lat between -90 and 90),
  delivery_lng double precision check (delivery_lng is null or delivery_lng between -180 and 180),
  delivery_phone text check (delivery_phone is null or delivery_phone ~ '^\+?[0-9]{6,15}$'),
  reserved_until timestamptz not null,
  paid_at timestamptz,
  -- Paiement (Stripe) et livraison (Uber Direct) : écrits par les Edge Functions (service_role).
  stripe_payment_intent_id text unique,
  uber_quote_id text,
  uber_delivery_id text unique,
  uber_tracking_url text check (uber_tracking_url is null or uber_tracking_url ~ '^https://'),
  uber_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_cents <= subtotal_cents),
  check (fulfilment = 'touch-collect' or delivery_address is not null)
);

create index flash_orders_customer_idx on public.flash_orders (customer_id, created_at desc);
create index flash_orders_shop_idx on public.flash_orders (shop_id, created_at desc);
create index flash_orders_pending_idx on public.flash_orders (reserved_until)
  where status = 'paiement_attente';

create table public.flash_order_items (
  order_id uuid not null references public.flash_orders (id) on delete cascade,
  offer_id uuid not null references public.flash_offers (id) on delete restrict,
  -- Recopiés à la commande : le titre et le prix ne bougent plus, même si l'offre est retirée.
  title text not null,
  qty integer not null check (qty between 1 and 99),
  unit_price_cents integer not null check (unit_price_cents > 0),
  primary key (order_id, offer_id)
);

create index flash_order_items_offer_idx on public.flash_order_items (offer_id);

-- Le code de retrait : hors du schéma public (ni l'API, ni le temps réel ne le voient). L'acheteur le
-- lit par `order_pickup_code()` ; le commerçant le vérifie par `confirm_pickup()`.
create table private.order_pickup_codes (
  order_id uuid primary key references public.flash_orders (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$')
);

-- ───────────────────────────────────────────────── réservations expirées : le stock revient

create or replace function private.release_expired_reservations()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  with expired as (
    update public.flash_orders o
       set status = 'annulee', updated_at = now()
     where o.status = 'paiement_attente'
       and o.reserved_until < now()
       -- Un paiement lancé laisse une marge (le webhook Stripe peut arriver en retard).
       and (o.stripe_payment_intent_id is null or o.reserved_until < now() - interval '45 minutes')
    returning o.id
  ), freed as (
    select i.offer_id, sum(i.qty)::integer as qty
      from public.flash_order_items i join expired e on e.id = i.order_id
     group by i.offer_id
  )
  update public.flash_offers f
     set stock_left = least(f.stock_total, f.stock_left + freed.qty)
    from freed
   where f.id = freed.offer_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────── réserver (le client)

create or replace function public.reserve_flash(
  p_items jsonb,
  p_fulfilment text,
  p_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_phone text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_shop uuid;
  v_order uuid;
  v_subtotal integer := 0;
  v_line record;
  v_offer public.flash_offers%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_fulfilment is null or p_fulfilment not in ('touch-collect', 'livraison') then
    raise exception 'invalid_fulfilment' using errcode = '22023';
  end if;
  if p_fulfilment = 'livraison' and coalesce(btrim(p_address), '') = '' then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  perform private.release_expired_reservations();

  if (select count(*) from public.flash_orders o
       where o.customer_id = v_uid and o.status = 'paiement_attente')
     >= private.config('max_pending_orders') then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  -- 1) Verrouiller et vérifier chaque offre, dans un ordre fixe (pas d'interblocage entre deux paniers).
  for v_line in
    select (e ->> 'offer_id')::uuid as offer_id, sum((e ->> 'qty')::integer)::integer as qty
      from jsonb_array_elements(p_items) e
     group by 1
     order by 1
  loop
    select * into v_offer from public.flash_offers f where f.id = v_line.offer_id for update;
    if not found
       or v_offer.audience <> 'clients'
       or v_offer.offline
       or now() < v_offer.starts_at
       or now() >= v_offer.ends_at
       or not exists (
         select 1 from public.shops s where s.id = v_offer.shop_id and s.status = 'valide'
       ) then
      raise exception 'offer_unavailable' using errcode = 'P0001';
    end if;
    if not (p_fulfilment = any (v_offer.modes)) then
      raise exception 'mode_unavailable' using errcode = 'P0001';
    end if;
    if v_line.qty is null or v_line.qty < greatest(1, v_offer.min_qty) or v_line.qty > 99 then
      raise exception 'invalid_items' using errcode = '22023';
    end if;
    if v_offer.stock_left < v_line.qty then
      raise exception 'out_of_stock' using errcode = 'P0001';
    end if;
    if v_shop is null then
      v_shop := v_offer.shop_id;
    elsif v_shop <> v_offer.shop_id then
      raise exception 'one_shop_per_order' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_offer.price_cents * v_line.qty;
  end loop;

  -- 2) La commande, ses lignes au prix du serveur, et le stock décrémenté (les offres sont verrouillées).
  insert into public.flash_orders (
    customer_id, shop_id, fulfilment, subtotal_cents, commission_cents,
    delivery_address, delivery_lat, delivery_lng, delivery_phone, reserved_until
  ) values (
    v_uid, v_shop, p_fulfilment, v_subtotal,
    round(v_subtotal * private.config('commission_bps') / 10000)::integer,
    case when p_fulfilment = 'livraison' then btrim(p_address) end,
    case when p_fulfilment = 'livraison' then p_lat end,
    case when p_fulfilment = 'livraison' then p_lng end,
    nullif(btrim(coalesce(p_phone, '')), ''),
    now() + make_interval(mins => private.config('reservation_minutes')::integer)
  ) returning id into v_order;

  insert into public.flash_order_items (order_id, offer_id, title, qty, unit_price_cents)
  select v_order, f.id, f.title, l.qty, f.price_cents
    from (
      select (e ->> 'offer_id')::uuid as offer_id, sum((e ->> 'qty')::integer)::integer as qty
        from jsonb_array_elements(p_items) e
       group by 1
    ) l
    join public.flash_offers f on f.id = l.offer_id;

  update public.flash_offers f
     set stock_left = f.stock_left - i.qty
    from public.flash_order_items i
   where i.order_id = v_order and f.id = i.offer_id;

  -- Six chiffres tirés d'un UUID v4 (aléa cryptographique), pas de `random()`.
  insert into private.order_pickup_codes (order_id, code)
  -- (Le modulo AVANT `abs` : `abs` du plus petit bigint déborde.)
  values (v_order, lpad(abs(hashtextextended(gen_random_uuid()::text, 0) % 1000000)::text, 6, '0'));

  return v_order;
end;
$$;

-- ───────────────────────────────────────────────────────────── annuler avant paiement (le client)

create or replace function public.cancel_order(p_order uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.flash_orders o
     set status = 'annulee', updated_at = now()
   where o.id = p_order
     and o.customer_id = auth.uid()
     and o.status = 'paiement_attente'
     and o.stripe_payment_intent_id is null;
  if not found then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;

  update public.flash_offers f
     set stock_left = least(f.stock_total, f.stock_left + i.qty)
    from public.flash_order_items i
   where i.order_id = p_order and f.id = i.offer_id;
end;
$$;

-- ──────────────────────────────────────────────────────────── le code de retrait (l'acheteur)

create or replace function public.order_pickup_code(p_order uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select c.code
    from private.order_pickup_codes c
    join public.flash_orders o on o.id = c.order_id
   where c.order_id = p_order
     and o.customer_id = auth.uid()
     and o.status not in ('paiement_attente', 'annulee', 'refusee', 'remboursee')
$$;

-- ─────────────────────────────────────────────────── faire avancer la commande (le commerçant)

-- Le paiement vaut acceptation (CDC V1.1) : le commerçant ne refuse pas, il prépare. « Prête » d'une
-- livraison déclenche la course Uber Direct (Edge Function) ; « en livraison » et « livrée » viennent
-- ensuite du webhook Uber, jamais du téléphone.
create or replace function public.advance_order(p_order uuid, p_status text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.flash_orders%rowtype;
begin
  select o.* into v_order
    from public.flash_orders o
    join public.shops s on s.id = o.shop_id
   where o.id = p_order and s.owner_id = auth.uid()
   for update of o;
  if not found then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  if (v_order.status in ('payee', 'acceptee') and p_status = 'preparation')
     or (v_order.status = 'preparation' and p_status = 'prete') then
    update public.flash_orders set status = p_status, updated_at = now() where id = p_order;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
end;
$$;

-- Touch & Collect : le commerçant scanne le QR du client (ou tape son code) — la commande est remise.
create or replace function public.confirm_pickup(p_order uuid, p_code text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.flash_orders o
     set status = 'recuperee', updated_at = now()
    from public.shops s, private.order_pickup_codes c
   where o.id = p_order
     and s.id = o.shop_id and s.owner_id = auth.uid()
     and c.order_id = o.id and c.code = btrim(coalesce(p_code, ''))
     and o.fulfilment = 'touch-collect'
     and o.status in ('payee', 'acceptee', 'preparation', 'prete');
  if not found then
    raise exception 'pickup_refused' using errcode = 'P0001';
  end if;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────────── droits

-- Lecture seule pour les comptes ; toute écriture passe par les fonctions ci-dessus ou le service_role.
grant select on public.flash_orders to authenticated;
grant select on public.flash_order_items to authenticated;

-- Postgres donne EXECUTE à PUBLIC par défaut : on le retire, puis on l'accorde aux seuls comptes.
revoke execute on function public.reserve_flash(jsonb, text, text, double precision, double precision, text)
  from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.order_pickup_code(uuid) from public, anon;
revoke execute on function public.advance_order(uuid, text) from public, anon;
revoke execute on function public.confirm_pickup(uuid, text) from public, anon;
grant execute on function public.reserve_flash(jsonb, text, text, double precision, double precision, text)
  to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.order_pickup_code(uuid) to authenticated;
grant execute on function public.advance_order(uuid, text) to authenticated;
grant execute on function public.confirm_pickup(uuid, text) to authenticated;

revoke execute on function private.release_expired_reservations() from public;
revoke execute on function private.config(text) from public;

create policy "orders: les siennes (acheteur)" on public.flash_orders
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "orders: celles de son commerce" on public.flash_orders
  for select to authenticated
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
  );

create policy "order items: ceux d'une commande visible" on public.flash_order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.flash_orders o
       where o.id = order_id
         and (
           o.customer_id = (select auth.uid())
           or exists (
             select 1 from public.shops s where s.id = o.shop_id and s.owner_id = (select auth.uid())
           )
         )
    )
  );

-- ───────────────────────────────────────────────── suivi en direct (Supabase Realtime, sous RLS)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.flash_orders;
  end if;
end;
$$;
