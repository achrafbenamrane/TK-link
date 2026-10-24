-- 0007_auth_identity — le profil retient ce que l'inscription a appris.
--
-- L'authentification (e-mail ou téléphone + mot de passe, Google, Apple) vit dans Supabase Auth ;
-- `auth.users` ne sort jamais par l'API (voir 0002). Ce qui sert à l'app — le nom, le numéro de
-- contact, le type de compte demandé — est recopié dans `public.profiles`.
--
-- Trois règles gouvernent ce fichier :
--
--   1. LE CLIENT NE S'ATTRIBUE PAS DE DROITS. `account_type` (consommateur / commerçant / grossiste
--      / livreur) est ce que la personne DIT être à l'inscription ; ce n'est pas une autorisation.
--      Un commerçant n'est « vérifié » qu'après examen de son SIRET par le Super Admin (CDC V1.1) :
--      les droits viendront de cette vérification, côté serveur, jamais de cette colonne. Elle n'est
--      d'ailleurs pas modifiable par le client après l'inscription.
--
--   2. UN NUMÉRO N'EST « VÉRIFIÉ » QUE PAR SMS. `contact_phone` est saisi à l'inscription (non
--      vérifié) ; `phone_verified` ne passe à vrai que lorsque Supabase Auth confirme le numéro
--      (code SMS). Ni l'un ni l'autre ne s'écrit depuis le client.
--
--   3. L'INSCRIPTION NE DOIT JAMAIS ÉCHOUER À CAUSE DU PROFIL. Le déclencheur s'exécute DANS la
--      transaction de création du compte : une exception ici bloquerait toute inscription, pour
--      tout le monde. Chaque valeur issue des métadonnées est donc validée, tronquée ou ignorée —
--      jamais propagée telle quelle.

-- ──────────────────────────────────────────────────────────────────────── colonnes

alter table public.profiles
  add column first_name text
    check (first_name is null or char_length(first_name) between 1 and 80),
  add column last_name text
    check (last_name is null or char_length(last_name) between 1 and 80),
  -- E.164, avec le « + » (Supabase stocke `auth.users.phone` SANS le « + » : on le rétablit).
  add column contact_phone text
    check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column phone_verified boolean not null default false,
  add column account_type text not null default 'consommateur'
    check (account_type in ('consommateur', 'commercant', 'grossiste', 'livreur'));

-- ───────────────────────────────────────────────────────────────── privilèges client

-- Avant : le client pouvait écrire toute la ligne. Maintenant : le nom seulement. Le reste
-- (`contact_phone`, `phone_verified`, `account_type`) est tenu par le serveur.
revoke update on public.profiles from authenticated;
grant update (display_name, first_name, last_name) on public.profiles to authenticated;

-- La ligne est créée par le déclencheur à l'inscription : le client n'a rien à insérer. Garder ce
-- droit lui laisserait choisir `account_type` si la ligne venait un jour à manquer.
drop policy if exists "profiles: insert own" on public.profiles;
revoke insert on public.profiles from authenticated;

-- ─────────────────────────────────────────────────────── création du profil à l'inscription

create or replace function private.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text;
  v_last text;
  v_full text;
  v_phone text;
  v_type text;
begin
  -- Prénom et nom : saisis à l'inscription (first_name / last_name), ou fournis par Google
  -- (given_name / family_name / name). Apple ne les donne qu'au client, une seule fois.
  v_first := nullif(btrim(left(coalesce(meta ->> 'first_name', meta ->> 'given_name', ''), 80)), '');
  v_last := nullif(btrim(left(coalesce(meta ->> 'last_name', meta ->> 'family_name', ''), 80)), '');
  v_full := nullif(btrim(left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80)), '');

  -- Numéro : celui de l'identité Auth s'il existe (sans « + » chez Supabase), sinon celui saisi
  -- à l'inscription. Tout ce qui n'est pas un E.164 valide est ignoré.
  v_phone := coalesce('+' || nullif(new.phone, ''), meta ->> 'contact_phone');
  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := null;
  end if;

  -- Le type de compte demandé : une liste fermée, « consommateur » par défaut.
  v_type := case
    when meta ->> 'account_type' in ('consommateur', 'commercant', 'grossiste', 'livreur')
      then meta ->> 'account_type'
    else 'consommateur'
  end;

  insert into public.profiles
    (id, display_name, first_name, last_name, contact_phone, phone_verified, account_type)
  values (
    new.id,
    left(coalesce(nullif(btrim(concat_ws(' ', v_first, v_last)), ''), v_full), 80),
    v_first,
    v_last,
    v_phone,
    -- Vérifié seulement si l'identité Auth elle-même l'est (inscription par SMS confirmé).
    (new.phone is not null and new.phone_confirmed_at is not null),
    v_type
  );
  return new;
end;
$$;

-- Le déclencheur `on_auth_user_created` existe depuis 0002 : `create or replace` ci-dessus suffit.

-- ──────────────────────────────────────────────── un numéro confirmé devient « vérifié »

-- Quand un utilisateur confirme son numéro par SMS (inscription par téléphone, ou ajout d'un numéro
-- à un compte e-mail), Supabase Auth renseigne `auth.users.phone` et `phone_confirmed_at`. On
-- recopie le numéro dans le profil et on le marque vérifié.
create or replace function private.sync_profile_phone()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.profiles
     set contact_phone = '+' || new.phone,
         phone_verified = true
   where id = new.id
     and ('+' || new.phone) ~ '^\+[1-9][0-9]{7,14}$';
  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_confirmed on auth.users;
create trigger on_auth_user_phone_confirmed
  after update of phone, phone_confirmed_at on auth.users
  for each row
  when (
    new.phone is not null
    and new.phone_confirmed_at is not null
    and (
      old.phone is distinct from new.phone
      or old.phone_confirmed_at is distinct from new.phone_confirmed_at
    )
  )
  execute function private.sync_profile_phone();
