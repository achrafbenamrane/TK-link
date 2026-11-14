-- 0023_b2b_orders — les commerçants commandent les offres pro des grossistes (CDC V1.1 §1 et §2).
--
-- Les offres pro se publient depuis 0011 (`audience = 'commercants'`), mais `reserve_flash` les
-- refusait : aucun commerçant ne pouvait en commander une. Même moteur que le B2C (« pas de
-- catalogue distinct ») : une commande B2B est une ligne de `flash_orders`, payée par la même page
-- Stripe Checkout au compte Connect du grossiste, commission 5 % (`commission_bps`). Ce qui change,
-- et que le CDC fixe :
--
--   1. L'ACHETEUR est un compte `commercant` dont le commerce est VALIDÉ (« SIRET vérifié avant
--      toute commande B2B »), et jamais sa propre offre. Un client ne commande pas une offre pro.
--   2. LE MINIMUM de l'offre (`min_qty`, déjà tenu) ; jusqu'à 999 par ligne (commandes de volume).
--      Le B2C reste à 99.
--   3. AUCUNE ÉTAPE D'ACCEPTATION : payée = « Commande reçue ». Livrée par le grossiste lui-même
--      (pas d'Uber Direct, pas de devis, frais 0 : le CDC ne chiffre rien) — il avance la commande :
--      en préparation → expédiée (`en_livraison`) → livrée. Retrait chez lui : comme le B2C.
--   4. NI PARRAINAGE NI FIDÉLITÉ : le crédit, les points et le déblocage du parrainage sont des
--      règles du client final (les points B2B sont CANDIDAT dans le CDC : rien n'est inventé).

-- ─────────────────────────────────────────────────────────────── la commande sait ce qu'elle est

alter table public.flash_orders
  add column audience text not null default 'clients' check (audience in ('clients', 'commercants'));

-- Les commandes de volume : 999 par ligne (le stock d'une offre est borné à 999). Le B2C reste
-- borné à 99 par `reserve_flash`.
alter table public.flash_order_items drop constraint flash_order_items_qty_check;
alter table public.flash_order_items
  add constraint flash_order_items_qty_check check (qty between 1 and 999);

-- ─────────────────────────────────────────────────────────────────────────────── réserver

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
  -- En bigint : 999 lots d'une offre pro chère dépasseraient l'entier ordinaire.
  v_subtotal bigint := 0;
  v_commission integer;
  v_discount integer := 0;
  v_line record;
  v_offer public.flash_offers%rowtype;
  v_audience text;
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  -- Une ligne B2B va jusqu'à 999 (commandes de volume), une ligne de client jusqu'à 99.
  v_max_qty integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_fulfilment is null or p_fulfilment not in ('touch-collect', 'livraison') then
    raise exception 'invalid_fulfilment' using errcode = '22023';
  end if;
  -- Une offre pro se livre au commerce acheteur : seule une commande de client final doit porter son
  -- adresse. On lit donc l'audience de la première offre AVANT les contrôles de 0019, sans rien
  -- changer à leur ordre pour un client : un panier vide ou un identifiant mal formé ne lève rien ici
  -- (`->` sur autre chose qu'un tableau rend null ; la boucle relèvera l'identifiant mal formé). Lu
  -- sans verrou : la boucle revérifie l'audience de chaque offre verrouillée.
  begin
    select f.audience into v_audience
      from public.flash_offers f
     where f.id = (p_items -> 0 ->> 'offer_id')::uuid;
  exception when invalid_text_representation then
    v_audience := null;
  end;
  if p_fulfilment = 'livraison' and v_address is null
     and v_audience is distinct from 'commercants' then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- Calculé à part : dans la condition d'un IF, le THEN d'un CASE clôt la condition (PL/pgSQL).
  v_max_qty := case when v_audience = 'commercants' then 999 else 99 end;

  perform private.release_expired_reservations();

  -- Un verrou par compte (0019) : deux réservations simultanées du même compte passent l'une après
  -- l'autre — ni deux fois le même crédit, ni une réservation de trop au-delà du plafond.
  perform pg_advisory_xact_lock(hashtextextended('referral:' || v_uid::text, 0));

  if (select count(*) from public.flash_orders o
       where o.customer_id = v_uid and o.status = 'paiement_attente')
     >= private.config('max_pending_orders') then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;

  -- Une commande B2B : un commerçant dont le commerce est validé (CDC V1.1 §1).
  if v_audience = 'commercants' and not exists (
    select 1
      from public.profiles p
      join public.shops s on s.owner_id = p.id
     where p.id = v_uid and p.account_type = 'commercant' and s.status = 'valide'
  ) then
    raise exception 'pro_required' using errcode = 'P0001';
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
       or v_offer.audience is distinct from v_audience
       or v_offer.offline
       or now() < v_offer.starts_at
       or now() >= v_offer.ends_at
       or not exists (
         select 1 from public.shops s where s.id = v_offer.shop_id and s.status = 'valide'
       ) then
      raise exception 'offer_unavailable' using errcode = 'P0001';
    end if;
    if v_audience = 'commercants' and exists (
      select 1 from public.shops s where s.id = v_offer.shop_id and s.owner_id = v_uid
    ) then
      raise exception 'own_offer' using errcode = 'P0001';
    end if;
    if not (p_fulfilment = any (v_offer.modes)) then
      raise exception 'mode_unavailable' using errcode = 'P0001';
    end if;
    if v_line.qty is null or v_line.qty < greatest(1, v_offer.min_qty)
       or v_line.qty > v_max_qty then
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

  -- Un seul paiement Stripe ne dépasse pas 999 999,99 € : au-delà, on commande en plusieurs fois
  -- plutôt que de réserver un stock qui ne pourra jamais être payé.
  if v_subtotal > 99999999 then
    raise exception 'order_too_large' using errcode = 'P0001';
  end if;

  v_commission := round(v_subtotal * private.config('commission_bps') / 10000)::integer;

  if v_audience = 'commercants' then
    -- Livrée par le grossiste au commerce acheteur — à SON adresse, jamais à une autre (le grossiste
    -- livre à ses frais : ce n'est pas une course à destination libre). Pas de crédit de parrainage.
    if p_fulfilment = 'livraison' then
      select s.address, s.lat, s.lng into v_address, v_lat, v_lng
        from public.shops s where s.owner_id = v_uid;
    end if;
  else
    -- 2) Le crédit de parrainage (0019), borné à la commission (Direct charges, voir 0019).
    v_discount := least(greatest(private.referral_balance(v_uid), 0), v_commission);
  end if;

  -- 3) La commande, ses lignes au prix du serveur, et le stock décrémenté (les offres sont verrouillées).
  insert into public.flash_orders (
    customer_id, shop_id, fulfilment, audience, subtotal_cents, commission_cents, discount_cents,
    referral_credit_cents,
    delivery_address, delivery_lat, delivery_lng, delivery_phone, reserved_until
  ) values (
    v_uid, v_shop, p_fulfilment, v_audience, v_subtotal, v_commission, v_discount,
    v_discount,
    case when p_fulfilment = 'livraison' then v_address end,
    case when p_fulfilment = 'livraison' then v_lat end,
    case when p_fulfilment = 'livraison' then v_lng end,
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

-- ─────────────────────────────────────────────────────── faire avancer : la livraison du grossiste

create or replace function public.advance_order(p_order uuid, p_status text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.flash_orders%rowtype;
  v_shipped boolean;
begin
  select o.* into v_order
    from public.flash_orders o
    join public.shops s on s.id = o.shop_id
   where o.id = p_order and s.owner_id = auth.uid()
   for update of o;
  if not found then
    raise exception 'not_your_order' using errcode = '42501';
  end if;

  -- Une offre pro livrée : c'est le grossiste qui l'achemine (pas d'Uber Direct, pas de « prête »).
  v_shipped := v_order.audience = 'commercants' and v_order.fulfilment = 'livraison';

  if (v_order.status in ('payee', 'acceptee') and p_status = 'preparation')
     or (not v_shipped and v_order.status = 'preparation' and p_status = 'prete')
     or (v_shipped and v_order.status = 'preparation' and p_status = 'en_livraison')
     or (v_shipped and v_order.status = 'en_livraison' and p_status = 'livree') then
    update public.flash_orders set status = p_status, updated_at = now() where id = p_order;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────── fidélité et parrainage : des règles du client final

drop trigger flash_orders_credit_loyalty on public.flash_orders;
create trigger flash_orders_credit_loyalty
  after update of status on public.flash_orders
  for each row
  when (new.status in ('recuperee', 'livree') and old.status not in ('recuperee', 'livree')
        and new.audience = 'clients')
  execute function private.credit_loyalty();

drop trigger flash_orders_unlock_referral on public.flash_orders;
create trigger flash_orders_unlock_referral
  after update of status on public.flash_orders
  for each row
  when (new.status in ('recuperee', 'livree') and old.status not in ('recuperee', 'livree')
        and new.audience = 'clients')
  execute function private.unlock_referral();

-- Saisir le code d'un parrain (0019) : « déjà client » ne compte que les achats de client final — un
-- commerçant qui s'est approvisionné chez un grossiste n'a encore rien acheté en tant que client.
create or replace function public.apply_referral_code(p_code text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select c.user_id into v_referrer
    from public.referral_codes c
   where c.code = upper(btrim(coalesce(p_code, '')));
  if v_referrer is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  if v_referrer = v_uid then
    raise exception 'own_code' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.referrals r where r.referee_id = v_uid) then
    raise exception 'already_referred' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.flash_orders o
     where o.customer_id = v_uid and o.audience = 'clients' and private.order_was_paid(o.status)
  ) then
    raise exception 'already_customer' using errcode = 'P0001';
  end if;
  -- Deux saisies simultanées : la seconde voit la première et répond « déjà parrainé ».
  insert into public.referrals (referee_id, referrer_id) values (v_uid, v_referrer)
  on conflict (referee_id) do nothing;
  if not found then
    raise exception 'already_referred' using errcode = 'P0001';
  end if;
end;
$$;

-- Les droits de `reserve_flash`, `advance_order` et `apply_referral_code` sont gardés (create or
-- replace, même signature) : réservés aux comptes depuis 0012 et 0019.
