-- 0010_shops — le dossier du professionnel (commerçant ou grossiste) sur le serveur.
--
-- Étape 1 du branchement du marché (docs/architecture/exec-plans/2026-11-11-marche-sur-supabase.md).
-- Jusqu'ici, « dossier déposé » et « dossier validé » ne vivaient que sur le téléphone, et la
-- validation était un bouton de démonstration. Le dossier part désormais au serveur, et c'est TK LINK
-- qui le valide.
--
-- Trois règles :
--
--   1. LE PROFESSIONNEL NE SE VALIDE PAS LUI-MÊME. Le statut n'est dans aucun droit client : seul le
--      tableau de bord (service role / postgres) le change. Un dossier refusé que l'on corrige, ou un
--      dossier validé dont on change le SIRET ou le nom, repart en vérification (déclencheur).
--   2. UN COMPTE, UN COMMERCE ; UN SIRET, UN COMPTE. Le type (`kind`) est celui que le compte a
--      DÉCLARÉ (0007/0008) : un client ne dépose pas un dossier de grossiste.
--   3. LE PUBLIC NE VOIT QUE LES COMMERCES VALIDÉS. Le titulaire voit toujours le sien, pour suivre
--      sa vérification.
--
-- Les tables `merchants` et `deals` de 0005 (avant le CDC V1.1, sans propriétaire) ne sont pas
-- réutilisées : elles seront retirées par une migration de nettoyage.

create type public.shop_status as enum ('en_verification', 'valide', 'refuse');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() unique references auth.users (id) on delete cascade,
  kind text not null check (kind in ('commercant', 'grossiste')),
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (
    category in ('restauration', 'high-tech', 'maison', 'mode', 'beaute', 'sport', 'auto', 'services')
  ),
  -- 14 chiffres, sans espaces ; la clé de Luhn est vérifiée par le déclencheur ci-dessous.
  siret text not null unique check (siret ~ '^[0-9]{14}$'),
  address text not null check (char_length(address) between 5 and 200),
  area text not null default '' check (char_length(area) <= 80),
  modes text[] not null default '{touch-collect}' check (
    cardinality(modes) between 1 and 2 and modes <@ array['touch-collect', 'livraison']
  ),
  -- Les coordonnées viennent du géocodage de l'adresse (étape 2) : facultatives pour l'instant.
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  status public.shop_status not null default 'en_verification',
  -- Motif d'un refus, écrit par TK LINK et montré au titulaire.
  review_note text check (char_length(review_note) <= 500),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index shops_status_idx on public.shops (status);

-- ─────────────────────────────────────────────── le gardien : SIRET, statut, dates

create or replace function private.siret_is_valid(p_siret text)
  returns boolean
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_sum integer := 0;
  v_digit integer;
  i integer;
begin
  if p_siret !~ '^[0-9]{14}$' then
    return false;
  end if;
  -- La Poste (SIREN 356 000 000) échappe à Luhn : la somme des chiffres est un multiple de 5.
  if left(p_siret, 9) = '356000000' then
    for i in 1..14 loop
      v_sum := v_sum + substr(p_siret, i, 1)::integer;
    end loop;
    return v_sum % 5 = 0;
  end if;
  -- Luhn : on double un chiffre sur deux en partant de la droite (même règle que l'app, roles.ts).
  for i in 0..13 loop
    v_digit := substr(p_siret, 14 - i, 1)::integer;
    if i % 2 = 1 then
      v_digit := v_digit * 2;
      if v_digit > 9 then
        v_digit := v_digit - 9;
      end if;
    end if;
    v_sum := v_sum + v_digit;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

create or replace function private.shops_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if not private.siret_is_valid(new.siret) then
    raise exception 'SIRET invalide' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if v_client then
      -- Un dépôt part TOUJOURS en vérification, quoi que le client ait tenté d'écrire.
      new.status := 'en_verification';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;

  new.updated_at := now();
  if v_client then
    new.owner_id := old.owner_id;
    new.kind := old.kind;
    if old.status = 'refuse'
       or (old.status = 'valide' and (new.siret <> old.siret or new.name <> old.name)) then
      new.status := 'en_verification';
      new.review_note := null;
      new.reviewed_at := null;
    end if;
  elsif new.status is distinct from old.status then
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger shops_guard
  before insert or update on public.shops
  for each row execute function private.shops_guard();

-- ──────────────────────────────────────────────────────────────────────── droits

grant select on public.shops to anon, authenticated;
-- Ni `status`, ni `review_note`, ni les dates : le client n'écrit que ce qu'il déclare.
grant insert (kind, name, category, siret, address, area, modes, lat, lng)
  on public.shops to authenticated;
grant update (name, category, siret, address, area, modes, lat, lng)
  on public.shops to authenticated;

create policy "shops: les commerces validés sont publics" on public.shops
  for select to anon, authenticated
  using (status = 'valide');

create policy "shops: le sien" on public.shops
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "shops: déposer le sien, du type déclaré" on public.shops
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and kind = (
      select p.account_type from public.profiles p
       where p.id = (select auth.uid()) and p.account_type_declared
    )
  );

create policy "shops: corriger le sien" on public.shops
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
