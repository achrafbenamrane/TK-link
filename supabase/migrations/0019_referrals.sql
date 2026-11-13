-- 0019_referrals — le parrainage, tenu par le serveur.
--
-- CDC V1.1 (Utilisateur > Process, VALIDÉ) : « un lien ou code d'invitation ; une récompense financée
-- par TK Link, débloquée pour les deux après un premier achat réel du filleul » — 5 € au parrain ET au
-- filleul (section « circuit de l'argent »). Jusqu'ici, le code et le crédit ne vivaient que sur le
-- téléphone : un vrai compte n'en tirait rien.
--
--   1. CHAQUE COMPTE A SON CODE (`TK-XXXXXX`), créé à la demande (`my_referral_code`).
--   2. UN NOUVEAU CLIENT SAISIT LE CODE D'UN PARRAIN (`apply_referral_code`) : une fois, pas le sien,
--      et seulement s'il n'a encore rien acheté — le parrainage invite de NOUVEAUX clients.
--   3. LE CRÉDIT SE DÉBLOQUE AU PREMIER ACHAT RÉEL DU FILLEUL : sa première commande « récupérée » ou
--      « livrée » crédite les deux comptes (`referral_credit_cents`, 500 = 5 €). Une fois par
--      parrainage et par côté.
--   4. LE CRÉDIT SE DÉDUIT À LA RÉSERVATION, À HAUTEUR DE LA COMMISSION DE TK LINK. En Stripe Connect
--      « Direct charges » (CDC V1.1), le prélèvement de TK LINK ne peut pas être négatif : TK LINK ne
--      peut offrir que ce qu'il aurait prélevé. Le crédit se consomme donc sur plusieurs commandes
--      (≈ 0,35 € sur 7 €) ; le commerçant reçoit toujours son prix moins la commission normale. Passer
--      en « charges séparées et virements » permettrait de tout déduire d'un coup : c'est une décision
--      ouverte (docs/architecture/exec-plans/2026-11-13-rapport-avancement.md), et seule la borne
--      changerait ici.
--   5. UNE RÉSERVATION ANNULÉE (ou une commande remboursée) REND LE CRÉDIT qu'elle avait pris.
--   6. LE CLIENT N'ÉCRIT RIEN DIRECTEMENT : un grand livre (`referral_credits`) écrit par le serveur
--      seul ; le solde en est la somme.

insert into private.platform_config (key, value) values
  -- Crédit de parrainage, en centimes, pour le parrain comme pour le filleul (CDC V1.1).
  ('referral_credit_cents', 500)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────────── tables

create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^TK-[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  -- Un filleul n'a qu'un parrain.
  referee_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unlocked_at timestamptz,
  check (referee_id <> referrer_id)
);

create index referrals_referrer_idx on public.referrals (referrer_id);

-- Le grand livre du crédit : + au déblocage (parrain, filleul) et à la restitution, − à l'utilisation.
create table public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null check (amount_cents <> 0),
  kind text not null check (kind in ('parrain', 'filleul', 'utilisation', 'restitution')),
  referee_id uuid references auth.users (id) on delete set null,
  order_id uuid references public.flash_orders (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (kind in ('parrain', 'filleul') and amount_cents > 0 and referee_id is not null)
    or (kind = 'utilisation' and amount_cents < 0 and order_id is not null)
    or (kind = 'restitution' and amount_cents > 0 and order_id is not null)
  )
);

create index referral_credits_user_idx on public.referral_credits (user_id);
-- Un parrainage crédite chaque côté une fois ; une commande prend le crédit une fois, le rend une fois.
create unique index referral_credits_unlock_once
  on public.referral_credits (user_id, referee_id, kind) where kind in ('parrain', 'filleul');
create unique index referral_credits_order_once
  on public.referral_credits (order_id, kind) where kind in ('utilisation', 'restitution');

-- ─────────────────────────────────────────────────────────────────────────────────── outils

create or replace function private.referral_balance(p_user uuid)
  returns integer
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(sum(c.amount_cents), 0)::integer
    from public.referral_credits c
   where c.user_id = p_user
$$;

-- Les statuts d'une commande qui a été PAYÉE (comme `isInvoiceable` dans l'app).
create or replace function private.order_was_paid(p_status text)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select p_status in (
    'payee', 'acceptee', 'preparation', 'prete', 'en_livraison', 'recuperee', 'livree',
    'refusee', 'remboursement_en_cours', 'remboursee', 'litige'
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────────── codes

-- MON code de parrainage, créé au premier appel.
create or replace function public.my_referral_code()
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select c.code into v_code from public.referral_codes c where c.user_id = v_uid;
  if v_code is not null then
    return v_code;
  end if;
  -- Six caractères lisibles (pas de 0/O ni 1/I), tirés d'un UUID v4 (aléa cryptographique).
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := 'TK-';
    for v_i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes c where c.code = v_code);
  end loop;
  insert into public.referral_codes (user_id, code) values (v_uid, v_code)
  on conflict (user_id) do nothing;
  -- Deux appels simultanés : c'est le premier code enregistré qui compte.
  select c.code into v_code from public.referral_codes c where c.user_id = v_uid;
  return v_code;
end;
$$;

-- Saisir le code d'un parrain.
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
     where o.customer_id = v_uid and private.order_was_paid(o.status)
  ) then
    raise exception 'already_customer' using errcode = 'P0001';
  end if;
  insert into public.referrals (referee_id, referrer_id) values (v_uid, v_referrer);
end;
$$;

-- Ce que l'écran du parrainage affiche : mon code, mon parrain, mon crédit, mes filleuls.
create or replace function public.referral_summary()
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_referral public.referrals%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_referral from public.referrals r where r.referee_id = v_uid;
  return jsonb_build_object(
    'code', public.my_referral_code(),
    'referrer_code', (
      select c.code from public.referral_codes c where c.user_id = v_referral.referrer_id
    ),
    'unlocked', v_referral.unlocked_at is not null,
    'balance_cents', private.referral_balance(v_uid),
    'credit_cents', private.config('referral_credit_cents')::integer,
    'invited', (select count(*) from public.referrals r where r.referrer_id = v_uid),
    'invited_unlocked', (
      select count(*) from public.referrals r
       where r.referrer_id = v_uid and r.unlocked_at is not null
    )
  );
end;
$$;

-- ─────────────────────────────────────────────────────── déblocage et restitution (déclencheurs)

-- La première commande honorée du filleul crédite les deux comptes.
create or replace function private.unlock_referral()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_referral public.referrals%rowtype;
  v_amount integer := private.config('referral_credit_cents')::integer;
begin
  select * into v_referral
    from public.referrals r
   where r.referee_id = new.customer_id and r.unlocked_at is null
   for update;
  if not found or coalesce(v_amount, 0) <= 0 then
    return new;
  end if;
  update public.referrals set unlocked_at = now() where referee_id = new.customer_id;
  insert into public.referral_credits (user_id, amount_cents, kind, referee_id)
  values
    (v_referral.referee_id, v_amount, 'filleul', v_referral.referee_id),
    (v_referral.referrer_id, v_amount, 'parrain', v_referral.referee_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger flash_orders_unlock_referral
  after update of status on public.flash_orders
  for each row
  when (new.status in ('recuperee', 'livree') and old.status not in ('recuperee', 'livree'))
  execute function private.unlock_referral();

-- Une réservation annulée (par le client ou expirée) ou une commande remboursée rend le crédit pris.
create or replace function private.restore_referral_credit()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_used integer;
begin
  select -c.amount_cents into v_used
    from public.referral_credits c
   where c.order_id = new.id and c.kind = 'utilisation';
  if coalesce(v_used, 0) > 0 then
    insert into public.referral_credits (user_id, amount_cents, kind, order_id)
    values (new.customer_id, v_used, 'restitution', new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger flash_orders_restore_referral_credit
  after update of status on public.flash_orders
  for each row
  when (new.status in ('annulee', 'remboursee') and old.status is distinct from new.status)
  execute function private.restore_referral_credit();

-- ─────────────────────────────────────────────── réserver : la réservation de 0012, plus le crédit

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
  v_commission integer;
  v_discount integer := 0;
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

  v_commission := round(v_subtotal * private.config('commission_bps') / 10000)::integer;

  -- 2) Le crédit de parrainage (0019), sous un verrou par compte : deux réservations simultanées ne
  --    dépensent pas deux fois le même crédit. Borné à la commission (Direct charges, voir en-tête).
  perform pg_advisory_xact_lock(hashtextextended('referral:' || v_uid::text, 0));
  v_discount := least(greatest(private.referral_balance(v_uid), 0), v_commission);

  -- 3) La commande, ses lignes au prix du serveur, et le stock décrémenté (les offres sont verrouillées).
  insert into public.flash_orders (
    customer_id, shop_id, fulfilment, subtotal_cents, commission_cents, discount_cents,
    delivery_address, delivery_lat, delivery_lng, delivery_phone, reserved_until
  ) values (
    v_uid, v_shop, p_fulfilment, v_subtotal, v_commission, v_discount,
    case when p_fulfilment = 'livraison' then btrim(p_address) end,
    case when p_fulfilment = 'livraison' then p_lat end,
    case when p_fulfilment = 'livraison' then p_lng end,
    nullif(btrim(coalesce(p_phone, '')), ''),
    now() + make_interval(mins => private.config('reservation_minutes')::integer)
  ) returning id into v_order;

  if v_discount > 0 then
    insert into public.referral_credits (user_id, amount_cents, kind, order_id)
    values (v_uid, -v_discount, 'utilisation', v_order);
  end if;

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

-- ─────────────────────────────────────────────────────────────────────────────────── droits

grant select on public.referral_codes to authenticated;
grant select on public.referrals to authenticated;
grant select on public.referral_credits to authenticated;

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_credits enable row level security;

create policy "referral codes: le mien" on public.referral_codes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "referrals: ceux où je figure" on public.referrals
  for select to authenticated
  using (referee_id = (select auth.uid()) or referrer_id = (select auth.uid()));

create policy "referral credits: les miens" on public.referral_credits
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke execute on function public.my_referral_code() from public, anon;
revoke execute on function public.apply_referral_code(text) from public, anon;
revoke execute on function public.referral_summary() from public, anon;
grant execute on function public.my_referral_code() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.referral_summary() to authenticated;
revoke execute on function private.referral_balance(uuid) from public;
revoke execute on function private.order_was_paid(text) from public;
revoke execute on function private.unlock_referral() from public;
revoke execute on function private.restore_referral_credit() from public;
