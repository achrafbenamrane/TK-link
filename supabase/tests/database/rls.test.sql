-- pgTAP RLS tests. Run with: supabase test db
-- These assert the security INVARIANTS, not behaviour — they fail loudly if a
-- future migration disables RLS or opens a client write path on entitlements.

begin;
select plan(44);

-- 1) RLS is enabled on EVERY table in the public schema (deny-by-default).
select ok(
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'public'),
  'RLS is enabled on all public tables'
);

-- 2) notes exposes exactly the four owner-scoped policies (one per command).
select policies_are(
  'public', 'notes',
  array[
    'notes: select own',
    'notes: insert own',
    'notes: update own',
    'notes: delete own'
  ],
  'notes has exactly the owner-scoped CRUD policies'
);

-- 3) subscriptions has NO client write policy (only the webhook/service_role writes).
select is_empty(
  $$ select p.polname
       from pg_policy p join pg_class c on c.oid = p.polrelid
      where c.relname = 'subscriptions' and p.polcmd in ('a', 'w', 'd') $$,
  'subscriptions has no client INSERT/UPDATE/DELETE policy'
);

-- 4) anon has no table privileges (blanket grants were revoked).
select ok(
  not has_table_privilege('anon', 'public.notes', 'select'),
  'anon cannot select from notes'
);

-- ───────────────────────────────────────── profils : identité (migration 0007)

-- 5) Le client n'insère pas son profil : la ligne vient du déclencheur d'inscription.
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'insert'),
  'authenticated cannot insert into profiles'
);

-- 6) Le client ne s'attribue ni un type de compte, ni un numéro « vérifié ».
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'account_type', 'update'),
  'authenticated cannot change account_type'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'phone_verified', 'update'),
  'authenticated cannot change phone_verified'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'contact_phone', 'update'),
  'authenticated cannot change contact_phone'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'account_type_declared', 'update'),
  'authenticated cannot change account_type_declared'
);

-- 7) …mais il peut corriger son nom.
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'first_name', 'update'),
  'authenticated can update first_name'
);

-- 8) Le déclencheur d'inscription valide ce qu'il recopie : une valeur hostile est ignorée, jamais
--    propagée, et l'inscription n'échoue pas.
insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '{"first_name":"Neo","last_name":"Démo","account_type":"admin","contact_phone":"06 12"}'::jsonb
);
select results_eq(
  $$ select first_name, last_name, account_type, account_type_declared, contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Neo'::text, 'Démo'::text, 'consommateur'::text, false, null::text, false) $$,
  'signup trigger ignores an unknown account_type (left to declare) and a malformed phone'
);

-- 9) …et retient ce qui est valide.
insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a2',
  '{"first_name":"Sofia","account_type":"commercant","contact_phone":"+33612345678"}'::jsonb
);
select results_eq(
  $$ select first_name, account_type, account_type_declared, contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('Sofia'::text, 'commercant'::text, true, '+33612345678'::text, false) $$,
  'signup trigger keeps valid metadata (type declared), phone stays unverified'
);

-- 10) Un nom de Google (full_name seul) alimente display_name.
insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a3',
  '{"full_name":"Yanis Traoré"}'::jsonb
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'Yanis Traoré',
  'display_name falls back to the provider full_name'
);

-- 11) Un numéro associé (`link-phone`, migration 0008) devient le numéro de contact, SANS être
--     « vérifié » : aucune vérification par SMS n'existe avant Prelude.
update auth.users
   set phone = '33698765432', phone_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000000a2';
select results_eq(
  $$ select contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('+33698765432'::text, false) $$,
  'a linked phone becomes the contact phone, still unverified'
);

-- 12) Une inscription confirmée par téléphone ne rend pas non plus le numéro « vérifié ».
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a4', '33611112222', now(), '{}'::jsonb);
select results_eq(
  $$ select contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a4' $$,
  $$ values ('+33611112222'::text, false) $$,
  'a phone confirmed by Auth alone is never marked verified'
);

-- ───────────────────────────────── type de compte déclaré une fois (migration 0008)

-- 13) Seul un compte connecté peut déclarer son type ; anon ne peut même pas appeler la fonction.
select ok(
  not has_function_privilege('anon', 'public.declare_account_type(text)', 'execute'),
  'anon cannot call declare_account_type'
);
select ok(
  has_function_privilege('authenticated', 'public.declare_account_type(text)', 'execute'),
  'authenticated can call declare_account_type'
);

-- 14) Le compte Google (a3, sans type) déclare « grossiste » : c'est retenu…
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is(
  public.declare_account_type('grossiste'),
  'grossiste',
  'an undeclared account declares its type'
);
-- …une seconde déclaration est ignorée (le type effectif revient)…
select is(
  public.declare_account_type('livreur'),
  'grossiste',
  'a second declaration is ignored'
);
-- …et un type hors liste est refusé.
select throws_ok(
  $$ select public.declare_account_type('admin') $$,
  '22023',
  null,
  'an unknown account type is rejected'
);
reset role;

select results_eq(
  $$ select account_type, account_type_declared
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a3' $$,
  $$ values ('grossiste'::text, true) $$,
  'the declared type is stored once'
);

-- 15) Un type déjà déclaré à l'inscription (a2, commerçant) ne change pas.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is(
  public.declare_account_type('grossiste'),
  'commercant',
  'a type declared at sign-up cannot be changed'
);
reset role;

-- ─────────────────────────────── tentatives d'association d'un numéro (migration 0008)

-- 16) Le compteur est réservé au serveur : ni anon ni un compte connecté ne l'appellent.
select ok(
  not has_function_privilege('authenticated', 'public.record_phone_link_attempt(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.record_phone_link_attempt(uuid, text)', 'execute'),
  'clients cannot call record_phone_link_attempt'
);

-- 17) Il compte les numéros DIFFÉRENTS des dernières 24 heures, celui-ci compris : réessayer le même
--     numéro (avec ou sans « + ») ne coûte rien, un autre numéro si.
select is(
  public.record_phone_link_attempt('00000000-0000-0000-0000-0000000000a1', '+33600000011'),
  1,
  'a first number counts as one'
);
select is(
  public.record_phone_link_attempt('00000000-0000-0000-0000-0000000000a1', '33600000011'),
  1,
  'retrying the same number does not count'
);
select is(
  public.record_phone_link_attempt('00000000-0000-0000-0000-0000000000a1', '+33600000012'),
  2,
  'another number counts'
);

-- 18) L'unicité d'un numéro se vérifie AVANT l'écriture (l'API d'administration ne le fait pas) :
--     le numéro de a2 est pris pour a1, pas pour a2 lui-même — avec ou sans « + ».
select ok(
  public.phone_is_taken('+33698765432', '00000000-0000-0000-0000-0000000000a1')
  and public.phone_is_taken('33698765432', '00000000-0000-0000-0000-0000000000a1'),
  'a number held by another account is taken'
);
select ok(
  not public.phone_is_taken('+33698765432', '00000000-0000-0000-0000-0000000000a2'),
  'an account''s own number is not taken for it'
);
select ok(
  not has_function_privilege('authenticated', 'public.phone_is_taken(text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.phone_is_taken(text, uuid)', 'execute'),
  'clients cannot probe numbers with phone_is_taken'
);

-- 19) Un AUTRE numéro repart non vérifié.
update public.profiles set phone_verified = true
 where id = '00000000-0000-0000-0000-0000000000a2';
update auth.users set phone = '33611113333'
 where id = '00000000-0000-0000-0000-0000000000a2';
select results_eq(
  $$ select contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('+33611113333'::text, false) $$,
  'a new number resets phone_verified'
);

-- 20) Le crochet « Send SMS » refuse tout envoi, et seul Auth peut l'appeler.
select is(
  public.send_sms_disabled('{}'::jsonb) -> 'error' ->> 'http_code',
  '422',
  'the send-sms hook refuses every SMS'
);
select ok(
  has_function_privilege('supabase_auth_admin', 'public.send_sms_disabled(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.send_sms_disabled(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.send_sms_disabled(jsonb)', 'execute'),
  'only Auth can call the send-sms hook'
);

-- ─────────────────────────────────────── dossier du professionnel (migration 0010)

-- 21) Le statut, le motif et les dates sont hors de portée du client.
select ok(
  not has_column_privilege('authenticated', 'public.shops', 'status', 'insert')
  and not has_column_privilege('authenticated', 'public.shops', 'status', 'update')
  and not has_column_privilege('authenticated', 'public.shops', 'review_note', 'update'),
  'a client cannot write the shop status or review note'
);

-- 22) Le commerçant (a2) dépose son dossier : il part en vérification.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $ insert into public.shops (kind, name, category, siret, address)
     values ('commercant', 'Le Petit Toulousain', 'restauration', '44306184100047',
             '8 rue des Carmes, 31000 Toulouse') $,
  'a merchant files their shop'
);
select results_eq(
  $ select status::text from public.shops where siret = '44306184100047' $,
  $ values ('en_verification'::text) $,
  'a filed shop starts under review'
);

-- 23) Un type qui n'est pas celui déclaré est refusé ; un SIRET mal formé aussi.
select throws_ok(
  $ update public.shops set siret = '44306184100048' where siret = '44306184100047' $,
  '23514',
  null,
  'a SIRET failing the Luhn key is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $ insert into public.shops (kind, name, category, siret, address)
     values ('commercant', 'Faux commerce', 'mode', '73282932000074', '1 place du Capitole, Toulouse') $,
  '42501',
  null,
  'an account cannot file a shop of another type than the one it declared'
);
-- 24) Un SIRET déjà déposé par un autre compte est refusé.
select throws_ok(
  $ insert into public.shops (kind, name, category, siret, address)
     values ('grossiste', 'Grossiste Occitan', 'restauration', '44306184100047',
             '14 avenue des Pyrénées, 31600 Muret') $,
  '23505',
  null,
  'a SIRET already filed by another account is rejected'
);
-- 25) Un autre compte ne voit pas un dossier en vérification.
select is_empty(
  $ select 1 from public.shops where siret = '44306184100047' $,
  'another account cannot see a shop under review'
);
reset role;

set local role anon;
select is_empty(
  $ select 1 from public.shops where siret = '44306184100047' $,
  'anon cannot see a shop under review'
);
reset role;

-- 26) TK LINK valide (tableau de bord) : le commerce devient public, la date de contrôle est posée.
update public.shops set status = 'valide' where siret = '44306184100047';
select ok(
  (select reviewed_at is not null from public.shops where siret = '44306184100047'),
  'validating stamps the review date'
);
set local role anon;
select results_eq(
  $ select name from public.shops where siret = '44306184100047' $,
  $ values ('Le Petit Toulousain'::text) $,
  'a validated shop is public'
);
reset role;

-- 27) Le titulaire ne peut pas se valider lui-même, mais changer son SIRET le renvoie en vérification.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $ update public.shops set status = 'valide' where siret = '44306184100047' $,
  '42501',
  null,
  'an owner cannot set their own status'
);
update public.shops set siret = '73282932000074' where siret = '44306184100047';
select results_eq(
  $ select status::text from public.shops where siret = '73282932000074' $,
  $ values ('en_verification'::text) $,
  'changing the SIRET of a validated shop sends it back to review'
);
reset role;

select * from finish();
rollback;
