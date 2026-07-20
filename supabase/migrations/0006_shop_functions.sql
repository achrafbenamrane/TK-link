-- 0006_shop_functions — les écritures qui ne peuvent pas passer par un INSERT.
--
-- Aucune table de 0005 n'accepte d'insert direct pour les commandes, les points
-- ou les bons. Tout passe par ces fonctions, pour trois raisons :
--
--   • les prix sont relus dans la base, jamais reçus du téléphone ;
--   • le stock est décrémenté sous verrou, donc deux acheteurs sur la dernière
--     pièce ne peuvent pas gagner tous les deux ;
--   • le solde de points est verrouillé par utilisateur, sinon deux échanges
--     simultanés lisent le même solde et le font passer sous zéro.
--
-- Toutes sont SECURITY DEFINER avec `search_path = ''` : elles franchissent RLS
-- volontairement, donc chaque chemin vérifie l'appelant lui-même.

-- ───────────────────────────────────────────────────────────────── utilitaires

-- Code de bon lisible au comptoir : ni 0/O ni 1/I, qu'on confond à l'oral.
create or replace function private.new_voucher_code()
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
      if i = 4 then v_code := v_code || '-'; end if;
    end loop;
    -- Collision quasi impossible (32^8), mais « quasi » n'est pas « jamais » et
    -- la contrainte unique ferait échouer l'échange au mauvais moment.
    exit when not exists (select 1 from public.vouchers v where v.code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Sérialise les opérations qui touchent au solde d'un utilisateur. Le solde est
-- une somme : deux transactions concurrentes le liraient identique et le
-- feraient passer sous zéro, qu'aucune contrainte de ligne ne rattrape.
create or replace function private.lock_points(p_user uuid)
  returns void
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('points:' || p_user::text));
$$;

create or replace function private.balance_of(p_user uuid)
  returns integer
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_entries where user_id = p_user;
$$;

-- ────────────────────────────────────────────────────────── passage de commande

/**
 * p_items : [{"deal_id": "d_cote", "qty": 2}, …]
 *
 * Le client dit CE QU'IL VEUT, jamais ce que ça coûte. Renvoie l'id de commande.
 */
create or replace function public.place_order(p_items jsonb, p_address_id uuid default null)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_order_id uuid;
  v_subtotal integer := 0;
  v_points integer;
  v_line record;
  v_deal public.deals%rowtype;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Panier vide.' using errcode = '22023';
  end if;

  -- Une adresse qui n'est pas la sienne ne doit pas être livrable : sans ce
  -- contrôle, on peut faire expédier chez n'importe qui.
  if p_address_id is not null
     and not exists (
       select 1 from public.addresses a
       where a.id = p_address_id and a.user_id = v_user
     ) then
    raise exception 'Adresse inconnue.' using errcode = '42501';
  end if;

  insert into public.orders (user_id, address_id, subtotal_cents, delivery_fee_cents, total_cents)
  values (v_user, p_address_id, 0, 0, 0)
  returning id into v_order_id;

  -- `order by deal_id` : verrouiller toujours dans le même ordre, sinon deux
  -- paniers aux mêmes articles pris en sens inverse se bloquent mutuellement.
  for v_line in
    select (e ->> 'deal_id')::text as deal_id,
           (e ->> 'qty')::integer as qty
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'Quantité invalide.' using errcode = '22023';
    end if;

    -- FOR UPDATE : la ligne est tenue jusqu'à la fin de la transaction. C'est
    -- ce qui rend impossible la double vente de la dernière pièce.
    select * into v_deal
    from public.deals d
    where d.id = v_line.deal_id
    for update;

    if not found then
      raise exception 'Offre introuvable : %.', v_line.deal_id using errcode = '23503';
    end if;

    if v_deal.ends_at <= now() then
      raise exception 'La vente flash « % » est terminée.', v_deal.title using errcode = '22023';
    end if;

    if v_deal.stock_left < v_line.qty then
      raise exception 'Stock insuffisant pour « % » : % restant(s).',
        v_deal.title, v_deal.stock_left using errcode = '22023';
    end if;

    update public.deals
    set stock_left = stock_left - v_line.qty
    where id = v_deal.id;

    insert into public.order_items (order_id, deal_id, title, emoji, unit_price_cents, qty)
    values (v_order_id, v_deal.id, v_deal.title, v_deal.emoji, v_deal.price_cents, v_line.qty);

    v_subtotal := v_subtotal + v_deal.price_cents * v_line.qty;
  end loop;

  -- Livraison offerte (promesse produit) — la colonne existe pour le jour où
  -- elle ne le sera plus, sans migration de données.
  v_points := floor(v_subtotal / 100.0)::integer;

  update public.orders
  set subtotal_cents = v_subtotal,
      total_cents = v_subtotal,
      points_earned = v_points
  where id = v_order_id;

  if v_points > 0 then
    insert into public.point_entries (user_id, amount, reason, order_id)
    values (v_user, v_points, 'achat', v_order_id);
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.place_order(jsonb, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────── fidélité

/** Échange des points contre un bon d'achat. p_points doit valoir le palier. */
create or replace function public.claim_voucher(p_points integer, p_value_cents integer)
  returns public.vouchers
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_voucher public.vouchers%rowtype;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if p_points is null or p_points <= 0 or p_value_cents is null or p_value_cents <= 0 then
    raise exception 'Palier invalide.' using errcode = '22023';
  end if;

  perform private.lock_points(v_user);

  if private.balance_of(v_user) < p_points then
    raise exception 'Points insuffisants.' using errcode = '22023';
  end if;

  insert into public.point_entries (user_id, amount, reason)
  values (v_user, -p_points, 'bon_achat');

  insert into public.vouchers (user_id, code, value_cents)
  values (v_user, private.new_voucher_code(), p_value_cents)
  returning * into v_voucher;

  return v_voucher;
end;
$$;

grant execute on function public.claim_voucher(integer, integer) to authenticated;

/**
 * Offre des points à un proche.
 *
 * Deux écritures dans le même livre : un débit chez l'émetteur, un crédit chez
 * le destinataire. Le total en circulation ne bouge pas — c'est exactement ce
 * qui rend le partage neutre pour la marge.
 */
create or replace function public.gift_points(p_to uuid, p_amount integer)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if p_to is null or p_to = v_user then
    raise exception 'Destinataire invalide.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_to) then
    raise exception 'Destinataire inconnu.' using errcode = '23503';
  end if;

  -- Verrouiller les deux comptes dans un ordre stable (uuid croissant), sinon
  -- deux dons croisés simultanés se bloquent l'un l'autre.
  if v_user < p_to then
    perform private.lock_points(v_user);
    perform private.lock_points(p_to);
  else
    perform private.lock_points(p_to);
    perform private.lock_points(v_user);
  end if;

  if private.balance_of(v_user) < p_amount then
    raise exception 'Points insuffisants.' using errcode = '22023';
  end if;

  insert into public.point_entries (user_id, amount, reason)
  values (v_user, -p_amount, 'don_envoye'), (p_to, p_amount, 'don_recu');

  return private.balance_of(v_user);
end;
$$;

grant execute on function public.gift_points(uuid, integer) to authenticated;

/** Marque un bon comme utilisé. Idempotent : un bon déjà consommé est refusé. */
create or replace function public.redeem_voucher(p_code text)
  returns public.vouchers
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_voucher public.vouchers%rowtype;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;

  select * into v_voucher
  from public.vouchers v
  where v.code = upper(trim(p_code)) and v.user_id = v_user
  for update;

  if not found then
    raise exception 'Bon introuvable.' using errcode = '23503';
  end if;
  if v_voucher.used_at is not null then
    raise exception 'Bon déjà utilisé.' using errcode = '22023';
  end if;

  update public.vouchers set used_at = now() where id = v_voucher.id
  returning * into v_voucher;

  return v_voucher;
end;
$$;

grant execute on function public.redeem_voucher(text) to authenticated;
