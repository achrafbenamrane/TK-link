-- 0017_loyalty — la fidélité par commerce, tenue par le serveur.
--
-- Étape 4 du plan du marché (docs/architecture/exec-plans/2026-11-11-marche-sur-supabase.md), reprise
-- le 13/11/2026 : les commandes passent au serveur, les points doivent suivre — sinon un client qui
-- paie pour de vrai ne gagne rien. Mêmes règles que l'app (src/features/loyalty) :
--
--   1. CHAQUE COMMERCE A SON PROGRAMME (CDC V1.1) : une unité (euros dépensés ou nombre d'achats),
--      figée une fois enregistrée, et 1 à 4 paliers de coût croissant. Écrit par son titulaire.
--   2. LES POINTS VIENNENT DES COMMANDES HONORÉES, et du serveur seul. Une commande qui passe
--      « récupérée » ou « livrée » crédite l'acheteur chez CE commerce (une fois par commande) :
--      1 € d'articles payés = 1 point, ou 1 achat = 1 point. La livraison n'en donne pas. La
--      fidélité ne passe jamais par Stripe (CDC V1.1).
--   3. LES POINTS SE CUMULENT ; un palier atteint se réclame UNE fois et devient une récompense à
--      code (`TK-XXXXXX`), que le commerçant valide au comptoir.
--   4. LE CLIENT N'ÉCRIT RIEN DIRECTEMENT : programme, réclamation et validation passent par des
--      fonctions qui vérifient qui appelle.

-- ─────────────────────────────────────────────────────────────────────────── programmes

create table public.loyalty_programs (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  unit text not null check (unit in ('euros', 'achats')),
  -- [{ "rank": 1, "cost": 20, "reward": "1 boisson", "productId": "…" }, …]
  tiers jsonb not null,
  updated_at timestamptz not null default now()
);

-- Des paliers valides : 1 à 4, rangs 1..n dans l'ordre, coûts entiers croissants (1 à 100 000),
-- une récompense de 1 à 60 caractères.
create or replace function private.loyalty_tiers_valid(p_tiers jsonb)
  returns boolean
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_tier jsonb;
  v_i integer := 0;
  v_prev integer := 0;
  v_cost integer;
begin
  if jsonb_typeof(p_tiers) is distinct from 'array'
     or jsonb_array_length(p_tiers) not between 1 and 4 then
    return false;
  end if;
  for v_tier in select value from jsonb_array_elements(p_tiers) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_tier -> 'cost') is distinct from 'number'
       or jsonb_typeof(v_tier -> 'reward') is distinct from 'string' then
      return false;
    end if;
    v_cost := (v_tier ->> 'cost')::numeric::integer;
    if (v_tier ->> 'rank')::integer is distinct from v_i
       or v_cost not between 1 and 100000
       or v_cost <= v_prev
       or char_length(btrim(v_tier ->> 'reward')) not between 1 and 60 then
      return false;
    end if;
    v_prev := v_cost;
  end loop;
  return true;
end;
$$;

-- Enregistrer le programme de SON commerce. Déjà enregistré, son unité ne change plus (CDC V1.1) :
-- seuls les paliers sont remplacés.
create or replace function public.save_loyalty_program(p_unit text, p_tiers jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_shop uuid;
begin
  select s.id into v_shop from public.shops s where s.owner_id = auth.uid();
  if v_shop is null then
    raise exception 'no_shop' using errcode = '42501';
  end if;
  if p_unit not in ('euros', 'achats') or not private.loyalty_tiers_valid(p_tiers) then
    raise exception 'invalid_program' using errcode = '22023';
  end if;
  insert into public.loyalty_programs (shop_id, unit, tiers)
  values (v_shop, p_unit, p_tiers)
  on conflict (shop_id) do update set tiers = excluded.tiers, updated_at = now();
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────── points

create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  points integer not null check (points > 0),
  -- Une commande ne crédite qu'une fois.
  order_id uuid unique references public.flash_orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index loyalty_ledger_customer_idx on public.loyalty_ledger (customer_id, shop_id);
create index loyalty_ledger_shop_idx on public.loyalty_ledger (shop_id);

create or replace function private.credit_loyalty()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_unit text;
  v_points integer;
begin
  select p.unit into v_unit from public.loyalty_programs p where p.shop_id = new.shop_id;
  v_points := case
    when coalesce(v_unit, 'euros') = 'achats' then 1
    else floor((new.subtotal_cents - new.discount_cents) / 100.0)::integer
  end;
  if v_points > 0 then
    insert into public.loyalty_ledger (customer_id, shop_id, points, order_id)
    values (new.customer_id, new.shop_id, v_points, new.id)
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger flash_orders_credit_loyalty
  after update of status on public.flash_orders
  for each row
  when (new.status in ('recuperee', 'livree') and old.status not in ('recuperee', 'livree'))
  execute function private.credit_loyalty();

-- ─────────────────────────────────────────────────────────────────────────── récompenses

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  rank integer not null check (rank between 1 and 4),
  label text not null,
  cost integer not null check (cost > 0),
  code text not null unique check (code ~ '^TK-[A-Z2-9]{6}$'),
  status text not null default 'disponible' check (status in ('disponible', 'utilisee')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  -- Un palier se réclame une fois.
  unique (customer_id, shop_id, rank)
);

create index loyalty_rewards_shop_idx on public.loyalty_rewards (shop_id, status);

-- Réclamer un palier atteint : rend le code de la récompense.
create or replace function public.claim_reward(p_shop uuid, p_rank integer)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tier jsonb;
  v_balance integer;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select t.value into v_tier
    from public.loyalty_programs p, jsonb_array_elements(p.tiers) t
   where p.shop_id = p_shop and (t.value ->> 'rank')::integer = p_rank;
  if v_tier is null then
    raise exception 'no_such_tier' using errcode = 'P0001';
  end if;
  select coalesce(sum(l.points), 0) into v_balance
    from public.loyalty_ledger l
   where l.customer_id = v_uid and l.shop_id = p_shop;
  if v_balance < (v_tier ->> 'cost')::integer then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.loyalty_rewards r
     where r.customer_id = v_uid and r.shop_id = p_shop and r.rank = p_rank
  ) then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;

  -- Six caractères lisibles (pas de 0/O ni 1/I), tirés d'un UUID v4 (aléa cryptographique).
  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := 'TK-';
    for v_i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.loyalty_rewards r where r.code = v_code);
  end loop;

  insert into public.loyalty_rewards (customer_id, shop_id, rank, label, cost, code)
  values (v_uid, p_shop, p_rank, v_tier ->> 'reward', (v_tier ->> 'cost')::integer, v_code);
  return v_code;
end;
$$;

-- Le commerçant valide une récompense de SON commerce, au comptoir : rend ce qu'il doit remettre.
create or replace function public.redeem_reward(p_code text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_label text;
  v_rank integer;
begin
  update public.loyalty_rewards r
     set status = 'utilisee', used_at = now()
    from public.shops s
   where r.code = upper(btrim(coalesce(p_code, '')))
     and s.id = r.shop_id and s.owner_id = auth.uid()
     and r.status = 'disponible'
  returning r.label, r.rank into v_label, v_rank;
  if v_label is null then
    raise exception 'reward_refused' using errcode = 'P0001';
  end if;
  return jsonb_build_object('label', v_label, 'rank', v_rank);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────── droits

grant select on public.loyalty_programs to anon, authenticated;
grant select on public.loyalty_ledger to authenticated;
grant select on public.loyalty_rewards to authenticated;

revoke execute on function public.save_loyalty_program(text, jsonb) from public, anon;
revoke execute on function public.claim_reward(uuid, integer) from public, anon;
revoke execute on function public.redeem_reward(text) from public, anon;
grant execute on function public.save_loyalty_program(text, jsonb) to authenticated;
grant execute on function public.claim_reward(uuid, integer) to authenticated;
grant execute on function public.redeem_reward(text) to authenticated;
revoke execute on function private.loyalty_tiers_valid(jsonb) from public;
revoke execute on function private.credit_loyalty() from public;

-- Le programme d'un commerce validé est public (le client voit ce qu'il peut gagner) ; le
-- titulaire voit le sien même avant validation.
create policy "loyalty programs: ceux des commerces validés" on public.loyalty_programs
  for select to anon, authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.status = 'valide'));

create policy "loyalty programs: le sien" on public.loyalty_programs
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

create policy "loyalty ledger: mes points" on public.loyalty_ledger
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "loyalty ledger: ceux de mon commerce" on public.loyalty_ledger
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

create policy "loyalty rewards: les miennes" on public.loyalty_rewards
  for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "loyalty rewards: celles de mon commerce" on public.loyalty_rewards
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
