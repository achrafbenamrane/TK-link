-- pgTAP RLS tests. Run with: supabase test db
-- These assert the security INVARIANTS, not behaviour — they fail loudly if a
-- future migration disables RLS or opens a client write path on entitlements.

begin;
select plan(138);

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
  $$ insert into public.shops (kind, name, category, siret, address)
     values ('commercant', 'Le Petit Toulousain', 'restauration', '44306184100047',
             '8 rue des Carmes, 31000 Toulouse') $$,
  'a merchant files their shop'
);
select results_eq(
  $$ select status::text from public.shops where siret = '44306184100047' $$,
  $$ values ('en_verification'::text) $$,
  'a filed shop starts under review'
);

-- 23) Un type qui n'est pas celui déclaré est refusé ; un SIRET mal formé aussi.
select throws_ok(
  $$ update public.shops set siret = '44306184100048' where siret = '44306184100047' $$,
  '23514',
  null,
  'a SIRET failing the Luhn key is rejected'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ insert into public.shops (kind, name, category, siret, address)
     values ('commercant', 'Faux commerce', 'mode', '73282932000074', '1 place du Capitole, Toulouse') $$,
  '42501',
  null,
  'an account cannot file a shop of another type than the one it declared'
);
-- 24) Un SIRET déjà déposé par un autre compte est refusé.
select throws_ok(
  $$ insert into public.shops (kind, name, category, siret, address)
     values ('grossiste', 'Grossiste Occitan', 'restauration', '44306184100047',
             '14 avenue des Pyrénées, 31600 Muret') $$,
  '23505',
  null,
  'a SIRET already filed by another account is rejected'
);
-- 25) Un autre compte ne voit pas un dossier en vérification.
select is_empty(
  $$ select 1 from public.shops where siret = '44306184100047' $$,
  'another account cannot see a shop under review'
);
reset role;

set local role anon;
select is_empty(
  $$ select 1 from public.shops where siret = '44306184100047' $$,
  'anon cannot see a shop under review'
);
reset role;

-- 26) TK LINK valide (tableau de bord) : le commerce devient public, la date de contrôle est posée.
-- Geste de TK LINK (SQL Editor) : sans claims JWT, `auth.role()` est nul — pas un client.
set local request.jwt.claims to '{}';
update public.shops set status = 'valide' where siret = '44306184100047';
select ok(
  (select reviewed_at is not null from public.shops where siret = '44306184100047'),
  'validating stamps the review date'
);
set local role anon;
select results_eq(
  $$ select name from public.shops where siret = '44306184100047' $$,
  $$ values ('Le Petit Toulousain'::text) $$,
  'a validated shop is public'
);
reset role;

-- 27) Le titulaire ne peut pas se valider lui-même, mais changer son SIRET le renvoie en vérification.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ update public.shops set status = 'valide' where siret = '44306184100047' $$,
  '42501',
  null,
  'an owner cannot set their own status'
);
update public.shops set siret = '73282932000074' where siret = '44306184100047';
select results_eq(
  $$ select status::text from public.shops where siret = '73282932000074' $$,
  $$ values ('en_verification'::text) $$,
  'changing the SIRET of a validated shop sends it back to review'
);
reset role;

-- ───────────────────────────────────────────────── Flash en direct (migration 0011)

-- 28) Le stock restant, l'heure de fin et le quota sont hors de portée du client.
select ok(
  not has_column_privilege('authenticated', 'public.flash_offers', 'stock_left', 'insert')
  and not has_column_privilege('authenticated', 'public.flash_offers', 'stock_left', 'update')
  and not has_column_privilege('authenticated', 'public.flash_offers', 'ends_at', 'insert')
  and not has_column_privilege('authenticated', 'public.shops', 'ops_purchased', 'update'),
  'a client cannot write stock, end time or quota'
);

-- 29) Un commerce en vérification (a2, SIRET changé plus haut) ne publie pas.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ insert into public.flash_offers
       (shop_id, title, category, price_cents, old_price_cents, stock_total, duration_minutes)
     values ((select id from public.shops where siret = '73282932000074'),
             'Pain au chocolat', 'restauration', 90, 150, 10, 30) $$,
  '42501',
  null,
  'a shop under review cannot publish'
);
reset role;

-- TK LINK valide à nouveau le commerce de a2.
-- Geste de TK LINK (SQL Editor) : sans claims JWT, `auth.role()` est nul — pas un client.
set local request.jwt.claims to '{}';
update public.shops set status = 'valide' where siret = '73282932000074';

-- 30) Validé : il publie ; le serveur pose le stock restant et l'heure de fin.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ insert into public.flash_offers
       (shop_id, title, category, price_cents, old_price_cents, stock_total, duration_minutes)
     values ((select id from public.shops where siret = '73282932000074'),
             'Pain au chocolat', 'restauration', 90, 150, 10, 30) $$,
  'a validated shop publishes a Flash'
);
select results_eq(
  $$ select stock_left, ends_at - starts_at from public.flash_offers where title = 'Pain au chocolat' $$,
  $$ values (10, interval '30 minutes') $$,
  'the server sets the remaining stock and the end time'
);

-- 31) Un Flash de 3 heures est refusé (CDC V1.1 : 15 min à 2 h).
select throws_ok(
  $$ insert into public.flash_offers
       (shop_id, title, category, price_cents, old_price_cents, stock_total, duration_minutes)
     values ((select id from public.shops where siret = '73282932000074'),
             'Croissant', 'restauration', 80, 120, 10, 180) $$,
  '23514',
  null,
  'a Flash longer than 2 hours is rejected'
);
reset role;

-- 32) Le public voit le Flash en ligne.
set local role anon;
select results_eq(
  $$ select title from public.flash_offers where title = 'Pain au chocolat' $$,
  $$ values ('Pain au chocolat'::text) $$,
  'anon sees a live Flash'
);
reset role;

-- 33) Quota épuisé (une seule opération offerte) : la publication suivante est refusée.
-- Geste de TK LINK (SQL Editor) : sans claims JWT, `auth.role()` est nul — pas un client.
set local request.jwt.claims to '{}';
update public.shops set ops_free = 1 where siret = '73282932000074';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ insert into public.flash_offers
       (shop_id, title, category, price_cents, old_price_cents, stock_total, duration_minutes)
     values ((select id from public.shops where siret = '73282932000074'),
             'Chausson aux pommes', 'restauration', 100, 160, 5, 60) $$,
  'P0001',
  'quota_exhausted',
  'publishing past the free operations is refused'
);

-- 34) Retirer son offre la cache au public ; elle ne revient pas en ligne.
update public.flash_offers set offline = true where title = 'Pain au chocolat';
select throws_ok(
  $$ update public.flash_offers set offline = false where title = 'Pain au chocolat' $$,
  '23514',
  null,
  'a withdrawn offer cannot come back online'
);
reset role;

set local role anon;
select is_empty(
  $$ select 1 from public.flash_offers where title = 'Pain au chocolat' $$,
  'anon no longer sees a withdrawn Flash'
);
reset role;

-- 35) Un autre compte ne publie pas pour un commerce qui n'est pas le sien.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ insert into public.flash_offers
       (shop_id, title, category, price_cents, old_price_cents, stock_total, duration_minutes)
     values ((select id from public.shops where siret = '73282932000074'),
             'Faux Flash', 'restauration', 100, 200, 5, 30) $$,
  '42501',
  null,
  'an account cannot publish for a shop it does not own'
);
reset role;

-- ─────────────────────────────────────────────────────────── la commande (migration 0012)

-- TK LINK met en ligne un Flash de test pour le commerce de a2 (3 pièces à 2,00 €).
set local request.jwt.claims to '{}';
insert into public.flash_offers
  (shop_id, title, category, price_cents, old_price_cents, stock_total, stock_left, duration_minutes)
values ((select id from public.shops where siret = '73282932000074'),
        'Brioche', 'restauration', 200, 400, 3, 3, 60);

-- 36) Aucune écriture directe sur les commandes ; anon ne réserve pas.
select ok(
  not has_table_privilege('authenticated', 'public.flash_orders', 'insert')
  and not has_table_privilege('authenticated', 'public.flash_orders', 'update')
  and not has_function_privilege('anon',
    'public.reserve_flash(jsonb, text, text, double precision, double precision, text)', 'execute'),
  'orders are written only through server functions'
);

-- 37) a1 réserve 2 brioches : le stock baisse, le serveur fait le prix et la commission (5 %).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Brioche'), 'qty', 2)),
       'touch-collect') $$,
  'a customer reserves a live Flash'
);
select results_eq(
  $$ select status, subtotal_cents, commission_cents, total_cents from public.flash_orders $$,
  $$ values ('paiement_attente'::text, 400, 20, 400) $$,
  'the server prices the order and its commission'
);
reset role;
select results_eq(
  $$ select stock_left from public.flash_offers where title = 'Brioche' $$,
  $$ values (1) $$,
  'the reserved quantity leaves the stock'
);

-- 38) Plus que la dernière pièce : en demander deux est refusé.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Brioche'), 'qty', 2)),
       'touch-collect') $$,
  'P0001',
  'out_of_stock',
  'a reservation beyond the remaining stock is refused'
);

-- 39) Un autre compte ne voit pas la commande de a1.
select is_empty(
  $$ select 1 from public.flash_orders $$,
  'another account cannot see someone else''s order'
);
reset role;

-- 40) Le commerçant voit la commande de son commerce, mais pas le code de retrait.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$ select count(*)::integer from public.flash_orders $$,
  $$ values (1) $$,
  'the merchant sees the orders of their shop'
);
select is(
  public.order_pickup_code((select id from public.flash_orders limit 1)),
  null,
  'the merchant cannot read the pickup code'
);

-- 41) Pas de préparation avant paiement.
select throws_ok(
  $$ select public.advance_order((select id from public.flash_orders limit 1), 'preparation') $$,
  'P0001',
  'invalid_transition',
  'an unpaid order cannot move to preparation'
);
reset role;

-- Le webhook Stripe (service_role) marque la commande payée.
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'payee', paid_at = now();

-- 42) Payée : l'acheteur lit son code ; un autre compte ne fait pas avancer la commande.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(
  public.order_pickup_code((select id from public.flash_orders limit 1)) ~ '^[0-9]{6}$',
  'the buyer reads a six-digit pickup code once paid'
);
select throws_ok(
  $$ select public.advance_order((select id from public.flash_orders limit 1), 'preparation') $$,
  '42501',
  'not_your_order',
  'only the shop owner moves an order forward'
);
reset role;

-- 43) Le commerçant prépare ; un mauvais code de retrait est refusé, le bon remet la commande.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.advance_order((select id from public.flash_orders limit 1), 'preparation') $$,
  'the merchant starts preparing a paid order'
);
select throws_ok(
  $$ select public.confirm_pickup((select id from public.flash_orders limit 1), '000000x') $$,
  'P0001',
  'pickup_refused',
  'a wrong pickup code is refused'
);
reset role;
create temporary table pickup on commit drop as
  select code from private.order_pickup_codes limit 1;
grant select on pickup to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.confirm_pickup((select id from public.flash_orders limit 1),
                                 (select code from pickup)) $$,
  'the right pickup code hands the order over'
);
select results_eq(
  $$ select status from public.flash_orders $$,
  $$ values ('recuperee'::text) $$,
  'the order is picked up'
);
reset role;

-- 44) Annuler avant paiement rend le stock (a3 réserve la dernière pièce, puis annule).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ select public.cancel_order(public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Brioche'), 'qty', 1)),
       'touch-collect')) $$,
  'a customer cancels an unpaid reservation'
);
reset role;
select results_eq(
  $$ select stock_left from public.flash_offers where title = 'Brioche' $$,
  $$ values (1) $$,
  'cancelling gives the stock back'
);

-- 45) Une livraison sans adresse est refusée.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Brioche'), 'qty', 1)),
       'livraison') $$,
  '22023',
  'address_required',
  'a delivery needs an address'
);
reset role;

-- 46) Le code de retrait n'est pas exposé par l'API.
select ok(
  not has_table_privilege('authenticated', 'private.order_pickup_codes', 'select'),
  'pickup codes are not readable through the API'
);

-- ─────────────────────────────────────────────────────── support TK LINK (migration 0014)

-- 47) Un compte n'écrit ni au nom de TK LINK, ni le statut d'une demande.
select ok(
  not has_column_privilege('authenticated', 'public.support_messages', 'from_staff', 'insert')
  and not has_column_privilege('authenticated', 'public.support_tickets', 'status', 'insert')
  and not has_table_privilege('authenticated', 'public.support_tickets', 'update'),
  'a client cannot speak as TK LINK nor set a ticket status'
);

-- 48) a1 ouvre une demande sur sa commande, et écrit son premier message.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ insert into public.support_tickets (category, subject, order_id)
     values ('commande', 'Brioche manquante', (select id from public.flash_orders limit 1)) $$,
  'a customer opens a support ticket about their order'
);
select lives_ok(
  $$ insert into public.support_messages (ticket_id, body)
     values ((select id from public.support_tickets where subject = 'Brioche manquante'),
             'Il manquait une brioche dans ma commande.') $$,
  'a customer writes in their ticket'
);
select results_eq(
  $$ select t.status, m.from_staff from public.support_tickets t
       join public.support_messages m on m.ticket_id = t.id $$,
  $$ values ('ouvert'::text, false) $$,
  'a new ticket is open and the message is not from staff'
);
reset role;

-- 49) Un autre compte ne voit pas la demande, et ne la rattache pas à une commande qui n'est pas la
--     sienne.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.support_tickets $$,
  'another account cannot see someone else''s ticket'
);
select throws_ok(
  $$ insert into public.support_tickets (category, subject, order_id)
     values ('commande', 'Pas la mienne', (select id from public.flash_orders limit 1)) $$,
  '42501',
  'not_your_order',
  'a ticket cannot point at someone else''s order'
);
reset role;

-- 50) TK LINK répond depuis le back-office (clé de service) : la demande passe « en cours ».
set local request.jwt.claims to '{}';
insert into public.support_messages (ticket_id, from_staff, body)
values ((select id from public.support_tickets where subject = 'Brioche manquante'), true,
        'Nous contactons le commerçant et revenons vers vous.');
select results_eq(
  $$ select status from public.support_tickets where subject = 'Brioche manquante' $$,
  $$ values ('en_cours'::text) $$,
  'a staff reply moves the ticket to in progress'
);

-- 51) Une demande close ne reçoit plus de message.
update public.support_tickets set status = 'ferme' where subject = 'Brioche manquante';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ insert into public.support_messages (ticket_id, body)
     values ((select id from public.support_tickets where subject = 'Brioche manquante'), 'Et alors ?') $$,
  'P0001',
  'ticket_closed',
  'a closed ticket refuses new messages'
);

-- 52) Le client voit la réponse de TK LINK dans sa demande.
select results_eq(
  $$ select count(*)::integer from public.support_messages where from_staff $$,
  $$ values (1) $$,
  'the customer reads the staff reply'
);
reset role;

-- ───────────────────────────────────────────────── visuels IA des commerces (migration 0015)

-- 53) Rien ne s'écrit depuis l'app, et le quota n'est pas lisible par un compte.
select ok(
  not has_table_privilege('authenticated', 'public.shop_media', 'insert')
  and not has_table_privilege('authenticated', 'public.shop_media', 'update')
  and not has_function_privilege('authenticated', 'public.shop_media_quota_left(uuid, text)', 'execute'),
  'AI media are written by the server only'
);

-- Le serveur (clé de service) range deux visuels prêts pour le commerce de a2 : un montré, un caché.
set local request.jwt.claims to '{}';
insert into public.shop_media (shop_id, kind, status, prompt, fal_model, url, visible)
values
  ((select id from public.shops where siret = '73282932000074'), 'image', 'pret', 'p', 'm',
   'https://example.supabase.co/storage/v1/object/public/shop-media/a.jpg', true),
  ((select id from public.shops where siret = '73282932000074'), 'image', 'pret', 'p', 'm',
   'https://example.supabase.co/storage/v1/object/public/shop-media/b.jpg', false);

-- 54) Le public voit le visuel montré, pas le caché ; le commerçant voit les deux.
set local role anon;
select results_eq(
  $$ select count(*)::integer from public.shop_media $$,
  $$ values (1) $$,
  'the public sees only the shown, ready media'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$ select count(*)::integer from public.shop_media $$,
  $$ values (2) $$,
  'the shop owner sees all their media'
);
reset role;

-- 55) Un autre compte ne cache pas les visuels d'un commerce ; le titulaire, oui.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.set_shop_media_visible((select id from public.shop_media limit 1), false) $$,
  '42501',
  'not_your_media',
  'another account cannot hide a shop''s media'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.set_shop_media_visible(id, false) from public.shop_media where visible $$,
  'the owner hides a media'
);
reset role;
set local role anon;
select is_empty(
  $$ select 1 from public.shop_media $$,
  'a hidden media leaves the public shop page'
);
reset role;

-- ──────────────────────────────────────────────────── jetons de notification (migration 0016)

-- 56) Un jeton ne se lit pas (il permet d'écrire à quelqu'un) ; il s'enregistre par fonction.
select ok(
  not has_table_privilege('authenticated', 'public.push_tokens', 'select')
  and not has_table_privilege('authenticated', 'public.push_tokens', 'insert')
  and not has_function_privilege('anon', 'public.register_push_token(text, text)', 'execute'),
  'push tokens are neither readable nor writable directly'
);

-- 57) a1 enregistre son téléphone ; le même téléphone connecté ensuite à a3 suit a3.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[test-a1]', 'android') $$,
  'a signed-in account registers its device token'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ select public.register_push_token('ExponentPushToken[test-a1]', 'android') $$,
  'the same device signed in to another account re-registers'
);
reset role;
select results_eq(
  $$ select user_id::text from public.push_tokens where token = 'ExponentPushToken[test-a1]' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3'::text) $$,
  'notifications follow the account signed in on the device'
);

-- ─────────────────────────────────────────────────────── fidélité par commerce (migration 0017)

-- 58) Rien ne s'écrit directement : programme, points et récompenses passent par le serveur.
select ok(
  not has_table_privilege('authenticated', 'public.loyalty_programs', 'insert')
  and not has_table_privilege('authenticated', 'public.loyalty_ledger', 'insert')
  and not has_table_privilege('authenticated', 'public.loyalty_rewards', 'insert'),
  'loyalty is written by the server only'
);

-- 59) La commande de a1 retirée plus haut (test 43, 4,00 € d'articles) l'a crédité de 4 points.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$ select coalesce(sum(points), 0)::integer from public.loyalty_ledger $$,
  $$ values (4) $$,
  'a picked-up order credits the buyer, 1 point per euro of goods'
);
reset role;

-- 60) Le commerçant (a2) enregistre son programme ; des paliers incohérents sont refusés.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.save_loyalty_program('euros',
       '[{"rank":1,"cost":3,"reward":"1 café"},{"rank":2,"cost":50,"reward":"1 brioche"}]'::jsonb) $$,
  'a merchant saves their loyalty program'
);
select throws_ok(
  $$ select public.save_loyalty_program('euros',
       '[{"rank":1,"cost":50,"reward":"x"},{"rank":2,"cost":10,"reward":"y"}]'::jsonb) $$,
  '22023',
  'invalid_program',
  'tiers must have increasing costs'
);
reset role;

-- 61) a1 réclame le palier 1 (atteint) ; pas le 2 (pas assez de points) ; pas deux fois le 1.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(
  public.claim_reward((select id from public.shops where siret = '73282932000074'), 1)
    ~ '^TK-[A-Z2-9]{6}$',
  'a reached tier becomes a reward with a readable code'
);
select throws_ok(
  $$ select public.claim_reward((select id from public.shops where siret = '73282932000074'), 2) $$,
  'P0001',
  'not_enough_points',
  'a tier out of reach cannot be claimed'
);
select throws_ok(
  $$ select public.claim_reward((select id from public.shops where siret = '73282932000074'), 1) $$,
  'P0001',
  'already_claimed',
  'a tier is claimed once'
);
reset role;

-- 61 bis) Partager une récompense (migration 0018) : seul son titulaire, une fois ; elle reste
-- valable chez le commerçant (le test 62 la valide ensuite). L'identifiant est lu en
-- administrateur : sous l'identité de a3, la récompense de a1 est invisible et la sous-requête
-- rendrait null — le refus ne prouverait rien.
set local request.jwt.claims to '{}';
select set_config('tklink.reward', (select id::text from public.loyalty_rewards limit 1), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.share_reward(current_setting('tklink.reward')::uuid) $$,
  'P0001',
  'reward_not_shareable',
  'nobody shares a reward that is not theirs'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(
  public.share_reward((select id from public.loyalty_rewards limit 1)) ~ '^TK-[A-Z2-9]{6}$',
  'the owner shares a reward and gets its code to send'
);
select results_eq(
  $$ select status from public.loyalty_rewards $$,
  $$ values ('partagee'::text) $$,
  'a shared reward leaves the inventory of the one who shared it'
);
select throws_ok(
  $$ select public.share_reward((select id from public.loyalty_rewards limit 1)) $$,
  'P0001',
  'reward_not_shareable',
  'a reward is shared once'
);
reset role;

-- 62) Seul le commerçant de CE commerce valide la récompense, et une seule fois.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.redeem_reward('TK-AAAAAA') $$,
  'P0001',
  'reward_refused',
  'another account cannot redeem a reward'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.redeem_reward((select code from public.loyalty_rewards limit 1)) $$,
  'the shop owner redeems the reward at the counter, even a shared one'
);
select throws_ok(
  $$ select public.redeem_reward((select code from public.loyalty_rewards limit 1)) $$,
  'P0001',
  'reward_refused',
  'a reward is redeemed once'
);
reset role;

-- ─────────────────────────────────────────────────────────── parrainage (migration 0019)

-- 63) Rien ne s'écrit directement : codes, parrainages et crédit passent par le serveur.
select ok(
  not has_table_privilege('authenticated', 'public.referral_codes', 'insert')
  and not has_table_privilege('authenticated', 'public.referrals', 'insert')
  and not has_table_privilege('authenticated', 'public.referral_credits', 'insert'),
  'referrals are written by the server only'
);

-- 64) a1 obtient son code ; il ne se parraine pas lui-même.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(
  public.my_referral_code() ~ '^TK-[A-HJ-NP-Z2-9]{6}$',
  'every account gets a readable referral code'
);
select throws_ok(
  $$ select public.apply_referral_code(public.my_referral_code()) $$,
  'P0001',
  'own_code',
  'nobody refers themselves'
);
reset role;

-- 65) a3 a son code aussi ; a1, qui a déjà acheté, ne peut plus être parrainé.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select ok(public.my_referral_code() is not null, 'a second account gets its own code');
reset role;
set local request.jwt.claims to '{}';
select set_config('tklink.code_a1',
  (select code from public.referral_codes where user_id = '00000000-0000-0000-0000-0000000000a1'), true);
select set_config('tklink.code_a3',
  (select code from public.referral_codes where user_id = '00000000-0000-0000-0000-0000000000a3'), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ select public.apply_referral_code(current_setting('tklink.code_a3')) $$,
  'P0001',
  'already_customer',
  'referral invites new customers only'
);
reset role;

-- 66) a3 (rien acheté) saisit le code de a1 — une fois ; un code inconnu est refusé.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$ select public.apply_referral_code('TK-ZZZZZZ') $$,
  'P0001',
  'invalid_code',
  'an unknown code is refused'
);
select lives_ok(
  $$ select public.apply_referral_code(lower(current_setting('tklink.code_a1'))) $$,
  'a new customer enters a referrer code'
);
select throws_ok(
  $$ select public.apply_referral_code(current_setting('tklink.code_a1')) $$,
  'P0001',
  'already_referred',
  'a customer has one referrer'
);
select results_eq(
  $$ select (s ->> 'unlocked')::boolean, (s ->> 'balance_cents')::integer
       from public.referral_summary() s $$,
  $$ values (false, 0) $$,
  'the credit waits for a first real purchase'
);
reset role;

-- 67) La première commande récupérée de a3 crédite a3 ET a1 de 5 €.
set local request.jwt.claims to '{}';
insert into public.flash_offers
  (shop_id, title, category, price_cents, old_price_cents, stock_total, stock_left, duration_minutes)
values ((select id from public.shops where siret = '73282932000074'),
        'Pain de campagne', 'restauration', 700, 1000, 10, 10, 60);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Pain de campagne'), 'qty', 1)),
       'touch-collect') $$,
  'the referee places a first order'
);
reset role;
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'payee', paid_at = now()
 where customer_id = '00000000-0000-0000-0000-0000000000a3' and status = 'paiement_attente';
update public.flash_orders set status = 'recuperee'
 where customer_id = '00000000-0000-0000-0000-0000000000a3' and status = 'payee';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'unlocked')::boolean, (s ->> 'balance_cents')::integer
       from public.referral_summary() s $$,
  $$ values (true, 500) $$,
  'the referee is credited after a first real purchase'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'balance_cents')::integer, (s ->> 'invited')::integer,
            (s ->> 'invited_unlocked')::integer
       from public.referral_summary() s $$,
  $$ values (500, 1, 1) $$,
  'the referrer is credited too'
);
reset role;

-- 68) Le crédit se déduit à hauteur de la commission (Direct charges) ; annuler le rend.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Pain de campagne'), 'qty', 1)),
       'touch-collect') $$,
  'the referee orders again'
);
select results_eq(
  $$ select commission_cents, discount_cents, total_cents
       from public.flash_orders where status = 'paiement_attente' $$,
  $$ values (35, 35, 665) $$,
  'the credit pays up to TK LINK''s commission, never more'
);
select results_eq(
  $$ select (s ->> 'balance_cents')::integer from public.referral_summary() s $$,
  $$ values (465) $$,
  'the used credit leaves the balance'
);
select lives_ok(
  $$ select public.cancel_order((select id from public.flash_orders where status = 'paiement_attente')) $$,
  'the referee cancels the reservation'
);
select results_eq(
  $$ select (s ->> 'balance_cents')::integer from public.referral_summary() s $$,
  $$ values (500) $$,
  'a cancelled reservation gives the credit back'
);
reset role;

-- 69) Une deuxième commande honorée du filleul ne crédite plus personne ; elle garde le crédit pris.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Pain de campagne'), 'qty', 1)),
       'touch-collect') $$,
  'the referee orders a second time with credit'
);
reset role;
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'payee', paid_at = now()
 where customer_id = '00000000-0000-0000-0000-0000000000a3' and status = 'paiement_attente';
update public.flash_orders set status = 'recuperee'
 where customer_id = '00000000-0000-0000-0000-0000000000a3' and status = 'payee';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'balance_cents')::integer, (s ->> 'invited_unlocked')::integer
       from public.referral_summary() s $$,
  $$ values (500, 1) $$,
  'a referral is credited once, not at every order'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'balance_cents')::integer from public.referral_summary() s $$,
  $$ values (465) $$,
  'an honoured order keeps the credit it used'
);
reset role;

-- 70) Remboursée, la commande rend le crédit qu'elle avait pris.
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'remboursee'
 where customer_id = '00000000-0000-0000-0000-0000000000a3'
   and status = 'recuperee' and referral_credit_cents > 0;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'balance_cents')::integer from public.referral_summary() s $$,
  $$ values (500) $$,
  'a refunded order gives the credit back'
);

-- 71) Une réservation expirée rend son crédit, dès la lecture suivante.
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Pain de campagne'), 'qty', 1)),
       'touch-collect') $$,
  'the referee reserves with credit, then lets it expire'
);
reset role;
set local request.jwt.claims to '{}';
update public.flash_orders set reserved_until = now() - interval '1 minute'
 where customer_id = '00000000-0000-0000-0000-0000000000a3' and status = 'paiement_attente';
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$ select (s ->> 'balance_cents')::integer from public.referral_summary() s $$,
  $$ values (500) $$,
  'an expired reservation gives the credit back'
);
reset role;

-- 72) Les fonctions du parrainage sont réservées aux comptes.
select ok(
  not has_function_privilege('anon', 'public.my_referral_code()', 'execute')
  and not has_function_privilege('anon', 'public.apply_referral_code(text)', 'execute')
  and not has_function_privilege('anon', 'public.referral_summary()', 'execute'),
  'anonymous callers cannot use referrals'
);

-- 73) Garde du schéma : une colonne qu'une clé étrangère remet à null (« on delete set null ») ne doit
-- être exigée non nulle nulle part — sinon la suppression de compte échoue (relecture de 0019).
select is_empty(
  $$ select f.conrelid::regclass::text, a.attname::text
       from pg_constraint f
       join pg_attribute a on a.attrelid = f.conrelid and a.attnum = any (f.conkey)
       left join pg_constraint c on c.conrelid = f.conrelid and c.contype = 'c'
      where f.contype = 'f' and f.confdeltype = 'n'
        and f.connamespace = 'public'::regnamespace
        and (a.attnotnull or pg_get_constraintdef(c.oid) ~ ('\m' || a.attname || ' IS NOT NULL')) $$,
  'no column set to null by a foreign key is required elsewhere'
);

-- 74) Un filleul qui a utilisé son crédit peut supprimer son compte ; le crédit du parrain reste.
set local request.jwt.claims to '{}';
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'a referee who used credit can still delete their account'
);

-- ─────────────────────────────────────── annuler avec une page de paiement ouverte (migration 0020)

-- 75) a1 réserve ; sa page Stripe s'ouvre : il ne peut plus annuler directement.
set local request.jwt.claims to '{}';
select set_config('tklink.stock',
  (select stock_left::text from public.flash_offers where title = 'Pain de campagne'), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object(
         'offer_id', (select id from public.flash_offers where title = 'Pain de campagne'), 'qty', 1)),
       'touch-collect') $$,
  'a customer reserves, then opens the payment page'
);
reset role;
set local request.jwt.claims to '{}';
update public.flash_orders set stripe_checkout_id = 'cs_test_open'
 where customer_id = '00000000-0000-0000-0000-0000000000a1' and status = 'paiement_attente';
select set_config('tklink.order',
  (select id::text from public.flash_orders
    where customer_id = '00000000-0000-0000-0000-0000000000a1' and status = 'paiement_attente'),
  true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ select public.cancel_order(current_setting('tklink.order')::uuid) $$,
  'P0001',
  'checkout_open',
  'a reservation with an open payment page is not cancelled behind Stripe''s back'
);
reset role;

-- 76) L'annulation après expiration de la page est réservée au serveur.
select ok(
  not has_function_privilege('authenticated', 'public.cancel_order_after_checkout(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_order_after_checkout(uuid, text)', 'execute'),
  'only the server cancels after expiring the payment page'
);

-- 77) Le serveur (page expirée) annule : la réservation est close, le stock revient.
set local request.jwt.claims to '{}';
select lives_ok(
  $$ select public.cancel_order_after_checkout(current_setting('tklink.order')::uuid, 'cs_test_open') $$,
  'the server cancels once the payment page has expired'
);
select results_eq(
  $$ select status from public.flash_orders where id = current_setting('tklink.order')::uuid $$,
  $$ values ('annulee'::text) $$,
  'the reservation is cancelled'
);
select results_eq(
  $$ select stock_left from public.flash_offers where title = 'Pain de campagne' $$,
  $$ values (current_setting('tklink.stock')::integer) $$,
  'its stock is given back'
);

select * from finish();
rollback;
