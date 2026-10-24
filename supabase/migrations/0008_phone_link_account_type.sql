-- 0008_phone_link_account_type — le numéro s'associe sans SMS ; le type de compte se déclare une fois.
--
-- Deux décisions du client (24/10/2026) changent ce que 0007 supposait :
--
--   1. LE NUMÉRO S'ASSOCIE SANS CODE, pour l'instant (la vérification par SMS viendra avec
--      Prelude). La fonction Edge `link-phone` pose le numéro sur l'identité Auth — pour qu'on puisse
--      se connecter avec lui et le même mot de passe — en le marquant « confirmé » côté Auth, sans
--      quoi la connexion par téléphone le refuserait. Avec 0007, cette confirmation le déclarait
--      VÉRIFIÉ dans le profil. Or personne ne l'a vérifié : `phone_verified` est désormais réservé à
--      une vraie vérification (Prelude), et n'est plus jamais déduit de la confirmation Auth.
--
--   2. UN PROFESSIONNEL PEUT S'INSCRIRE AVEC GOOGLE OU APPLE. Ces fournisseurs ne transmettent pas
--      nos métadonnées : le profil naissait « consommateur ». Le type de compte peut maintenant être
--      DÉCLARÉ, une seule fois, juste après l'inscription (`declare_account_type`). C'est exactement
--      ce que l'inscription par e-mail permet déjà — une déclaration, pas un droit (règle 1 de
--      0007) — mais une seule fois : on ne change pas de type de compte à volonté.
--
-- Associer un numéro sans le vérifier dit aussi, quand ça échoue, qu'un autre compte l'utilise. Pour
-- que personne ne s'en serve pour tester des numéros en série, chaque compte peut essayer CINQ
-- numéros DIFFÉRENTS par 24 heures (`record_phone_link_attempt`, appelée par la fonction Edge).
-- Réessayer le même numéro n'apprend rien de plus : ça ne compte pas — l'app le réessaie d'ailleurs
-- toute seule à chaque ouverture tant qu'il n'est pas associé.
--
-- Et puisque AUCUN SMS ne part avant Prelude, aucun chemin client ne doit pouvoir créer ou confirmer
-- un numéro : le crochet « Send SMS » (`send_sms_disabled`) refuse tout envoi. Les crochets
-- s'exécutent dans la transaction d'Auth : une inscription par téléphone, une connexion par code SMS
-- ou un `updateUser({ phone })` échouent donc entièrement — personne ne s'approprie le numéro d'un
-- autre en dehors de `link-phone`, qui a ses propres garde-fous.

-- ──────────────────────────────────────────────────────────────────────── colonne

alter table public.profiles
  add column account_type_declared boolean not null default false;

-- Un profil qui porte déjà un autre type que celui par défaut l'a déclaré à l'inscription.
update public.profiles set account_type_declared = true where account_type <> 'consommateur';

-- (Pas de nouveau droit client : la mise à jour reste limitée au nom, voir 0007.)

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

  -- Le type de compte demandé : une liste fermée. Absent (Google, Apple) ou inconnu, le profil est
  -- « consommateur » et le type reste À DÉCLARER (`declare_account_type`).
  v_type := case
    when meta ->> 'account_type' in ('consommateur', 'commercant', 'grossiste', 'livreur')
      then meta ->> 'account_type'
  end;

  insert into public.profiles
    (id, display_name, first_name, last_name, contact_phone, phone_verified, account_type,
     account_type_declared)
  values (
    new.id,
    left(coalesce(nullif(btrim(concat_ws(' ', v_first, v_last)), ''), v_full), 80),
    v_first,
    v_last,
    v_phone,
    -- Aucune vérification par SMS n'existe encore : un numéro n'est jamais « vérifié » ici, même si
    -- l'identité Auth le dit confirmé (voir l'en-tête).
    false,
    coalesce(v_type, 'consommateur'),
    v_type is not null
  );
  return new;
end;
$$;

-- ───────────────────────────────────────────── un numéro associé devient le numéro de contact

-- Le déclencheur `on_auth_user_phone_confirmed` (0007) reste : quand `link-phone` pose le numéro, il
-- le recopie dans le profil. Mais il ne le marque plus « vérifié » ; et un AUTRE numéro repart non
-- vérifié — une vérification ne vaut que pour le numéro vérifié.
create or replace function private.sync_profile_phone()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.profiles
     set contact_phone = '+' || new.phone,
         phone_verified = case
           when contact_phone is distinct from ('+' || new.phone) then false
           else phone_verified
         end
   where id = new.id
     and ('+' || new.phone) ~ '^\+[1-9][0-9]{7,14}$';
  return new;
end;
$$;

-- ──────────────────────────────────────────────────── le type de compte, déclaré une fois

/**
 * Déclare le type de compte de la personne connectée, si elle ne l'a pas encore fait (inscription
 * par Google ou Apple). Renvoie le type EFFECTIF : celui qu'on vient de poser, ou celui déjà déclaré
 * — une seconde déclaration est ignorée, sans erreur, pour que l'app se range à ce que dit le serveur.
 */
create or replace function public.declare_account_type(p_type text)
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_type text;
begin
  if v_user is null then
    raise exception 'Authentification requise.' using errcode = '28000';
  end if;
  if p_type is null or p_type not in ('consommateur', 'commercant', 'grossiste', 'livreur') then
    raise exception 'Type de compte inconnu.' using errcode = '22023';
  end if;

  update public.profiles
     set account_type = p_type,
         account_type_declared = true
   where id = v_user
     and not account_type_declared
  returning account_type into v_type;

  if v_type is null then
    select p.account_type into v_type from public.profiles p where p.id = v_user;
  end if;
  return v_type;
end;
$$;

revoke all on function public.declare_account_type(text) from public, anon;
grant execute on function public.declare_account_type(text) to authenticated;

-- ─────────────────────────────────────────── les tentatives d'association d'un numéro

-- Un numéro essayé par un compte, sans « + » (comme Auth le range). Gardé 24 heures, pas plus.
create table private.phone_link_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  at timestamptz not null default now(),
  primary key (user_id, phone)
);
create index phone_link_attempts_at on private.phone_link_attempts (at);

/**
 * Note qu'un compte essaie d'associer `p_phone` et renvoie combien de numéros DIFFÉRENTS il a essayés
 * en 24 heures, celui-ci compris. Le même numéro réessayé ne compte qu'une fois (sa première date
 * fait foi). Réservée au serveur (la fonction Edge `link-phone`, en service_role) : le client ne peut
 * ni l'appeler, ni lire la table.
 */
create or replace function public.record_phone_link_attempt(p_user uuid, p_phone text)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Les essais d'un même compte passent un par un : deux appels simultanés ne lisent pas le même
  -- compte.
  perform pg_advisory_xact_lock(hashtext('phone-link:' || p_user::text));

  -- Au-delà de 24 heures, un essai ne sert plus à rien : on l'oublie (c'est un numéro de téléphone).
  delete from private.phone_link_attempts where at < now() - interval '1 day';
  insert into private.phone_link_attempts (user_id, phone)
  values (p_user, ltrim(p_phone, '+'))
  on conflict (user_id, phone) do nothing;
  select count(*)::integer into v_count
    from private.phone_link_attempts
   where user_id = p_user;
  return v_count;
end;
$$;

revoke all on function public.record_phone_link_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.record_phone_link_attempt(uuid, text) to service_role;

/**
 * Ce numéro (E.164, avec ou sans « + ») est-il déjà celui d'un AUTRE compte ? L'API
 * d'administration ne le vérifie pas avant d'écrire : un doublon n'y remonte qu'en erreur 500
 * générique (contrainte d'unicité). La fonction Edge demande donc d'abord. Réservée au serveur.
 */
create or replace function public.phone_is_taken(p_phone text, p_user uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  -- Auth range le numéro SANS le « + ».
  select exists (
    select 1 from auth.users u
     where u.phone = ltrim(p_phone, '+')
       and u.id <> p_user
  );
$$;

revoke all on function public.phone_is_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.phone_is_taken(text, uuid) to service_role;

-- ─────────────────────────────────────────────── aucun SMS avant Prelude (crochet « Send SMS »)

/**
 * Le crochet « Send SMS » d'Auth, branché sur une fonction qui refuse TOUT envoi (voir l'en-tête).
 * À activer dans le tableau de bord : Authentication → Hooks → Send SMS → Postgres →
 * `public.send_sms_disabled`. Il permet aussi d'activer le fournisseur « Phone » (connexion par
 * numéro + mot de passe) sans fournisseur de SMS. Avec Prelude, le crochet pointera vers Prelude.
 */
create or replace function public.send_sms_disabled(event jsonb)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object('error', jsonb_build_object(
    'http_code', 422,
    'message', 'L’envoi de SMS n’est pas encore disponible.'
  ));
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_disabled(jsonb) to supabase_auth_admin;
revoke execute on function public.send_sms_disabled(jsonb) from public, anon, authenticated;
