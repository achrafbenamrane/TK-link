-- pgTAP RLS tests. Run with: supabase test db
-- These assert the security INVARIANTS, not behaviour — they fail loudly if a
-- future migration disables RLS or opens a client write path on entitlements.

begin;
select plan(191);

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

-- ──────────────────────────────────────────────── décision sur un litige (migration 0021)

-- 78) Une décision est complète ou n'est pas : issue, motif ET date, ensemble.
set local request.jwt.claims to '{}';
select throws_ok(
  $$ update public.flash_orders set dispute_outcome = 'refund'
      where id = current_setting('tklink.order')::uuid $$,
  '23514',
  null,
  'a dispute decision without a reason and a date is refused'
);
select lives_ok(
  $$ update public.flash_orders
        set dispute_outcome = 'refund', dispute_note = 'Payé hors délai : remboursé.',
            dispute_decided_at = now()
      where id = current_setting('tklink.order')::uuid $$,
  'a reasoned, dated decision is kept with the order'
);

-- ──────────────────────────────────────────── réglages de la plateforme (migration 0022)

-- 79) Lire et écrire les réglages : le back-office seul (clé de service).
select ok(
  not has_function_privilege('authenticated', 'public.admin_set_platform_setting(text, numeric)', 'execute')
  and not has_function_privilege('anon', 'public.admin_set_platform_setting(text, numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_platform_settings()', 'execute'),
  'only the back-office reads and writes platform settings'
);

-- 80) Des bornes sûres ; une clé inconnue est refusée.
set local request.jwt.claims to '{}';
select throws_ok(
  $$ select public.admin_set_platform_setting('commission_bps', 30000) $$,
  '22023',
  'invalid_value',
  'a commission above 30 percent is refused'
);
select throws_ok(
  $$ select public.admin_set_platform_setting('commission_bps', 512.5) $$,
  '22023',
  'invalid_value',
  'settings are whole numbers'
);
select throws_ok(
  $$ select public.admin_set_platform_setting('not_a_setting', 1) $$,
  '22023',
  'unknown_setting',
  'an unknown setting is refused'
);

-- 81) Une commission changée s'applique aux réservations suivantes, et l'app la lit.
select lives_ok(
  $$ select public.admin_set_platform_setting('commission_bps', 700) $$,
  'the back-office sets the commission to 7 percent'
);
set local role anon;
select results_eq(
  $$ select (public.platform_public_settings() ->> 'commission_bps')::integer $$,
  $$ values (700) $$,
  'the app reads the commission the server will apply'
);
reset role;

-- ─────────────────────────────────────────────────────── commandes B2B (migration 0023)

-- Un grossiste (a5), son entreprise validée ; un commerçant (a6) dont le dossier est encore en
-- vérification ; une offre pro du grossiste (minimum 10 sacs), une autre publiée par a2 lui-même.
insert into auth.users (id, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a5', '{"first_name":"Marc","account_type":"grossiste"}'::jsonb),
       ('00000000-0000-0000-0000-0000000000a6', '{"first_name":"Inès","account_type":"commercant"}'::jsonb);
set local request.jwt.claims to '{}';
insert into public.shops (owner_id, kind, name, category, siret, address, status)
values ('00000000-0000-0000-0000-0000000000a5', 'grossiste', 'Grossiste Occitan', 'restauration',
        '52081000000007', '14 avenue des Pyrénées, 31600 Muret', 'valide'),
       ('00000000-0000-0000-0000-0000000000a6', 'commercant', 'Épicerie du Canal', 'restauration',
        '39251000000004', '3 port Saint-Sauveur, 31000 Toulouse', 'en_verification');
insert into public.flash_offers
  (shop_id, audience, title, category, price_cents, old_price_cents, stock_total, stock_left,
   min_qty, duration_minutes)
values ((select id from public.shops where siret = '52081000000007'), 'commercants',
        'Farine T65 (sac 25 kg)', 'restauration', 1800, 2400, 500, 500, 10, 1440),
       ((select id from public.shops where siret = '73282932000074'), 'commercants',
        'Lot de baguettes', 'restauration', 900, 1200, 50, 50, 5, 1440);
-- Les identifiants se lisent ICI, en superutilisateur : sous le rôle d'un client, les règles d'accès
-- cachent les offres pro, et une sous-requête dans `throws_ok` rendrait null.
select set_config('tklink.farine',
  (select id::text from public.flash_offers where title = 'Farine T65 (sac 25 kg)'), true);
select set_config('tklink.baguettes',
  (select id::text from public.flash_offers where title = 'Lot de baguettes'), true);
select set_config('tklink.pain',
  (select id::text from public.flash_offers where title = 'Pain de campagne'), true);
-- a2 a un parrain (a1) et 5 € de crédit : une commande B2B ne doit ni le prendre, ni débloquer le
-- parrainage.
insert into public.referrals (referee_id, referrer_id)
values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1');
insert into public.referral_credits (user_id, amount_cents, kind, referee_id)
values ('00000000-0000-0000-0000-0000000000a2', 500, 'filleul', '00000000-0000-0000-0000-0000000000a2');

-- 82) Un client ne commande pas une offre pro.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.farine'), 'qty', 10)),
       'touch-collect') $$,
  'P0001',
  'pro_required',
  'a customer cannot order a wholesaler offer'
);

-- 83) Pour un client, rien ne change depuis 0019 : l'adresse manquante d'abord, puis 99 par ligne.
select throws_ok(
  $$ select public.reserve_flash('[]'::jsonb, 'livraison') $$,
  '22023',
  'address_required',
  'a delivery without an address is refused before the basket is read'
);
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.pain'), 'qty', 100)),
       'touch-collect') $$,
  '22023',
  'invalid_items',
  'a consumer order line stays capped at 99'
);
reset role;

-- 84) Ni un grossiste, ni un commerçant dont le dossier n'est pas validé ne commande une offre pro.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.baguettes'), 'qty', 5)),
       'touch-collect') $$,
  'P0001',
  'pro_required',
  'a wholesaler cannot buy a wholesale offer'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.farine'), 'qty', 10)),
       'touch-collect') $$,
  'P0001',
  'pro_required',
  'a merchant whose shop is still under review cannot order'
);
reset role;

-- 85) Le commerçant validé (a2) : ni sous le minimum, ni au-delà de 999, ni sa propre offre.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.farine'), 'qty', 9)),
       'touch-collect') $$,
  '22023',
  'invalid_items',
  'a wholesale order below the minimum is refused'
);
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.farine'), 'qty', 1000)),
       'touch-collect') $$,
  '22023',
  'invalid_items',
  'a wholesale order line is capped at 999'
);
select throws_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.baguettes'), 'qty', 5)),
       'touch-collect') $$,
  'P0001',
  'own_offer',
  'a merchant cannot order their own wholesale offer'
);

-- 86) 150 sacs livrés (au-delà de 99) : à l'adresse de SON commerce, pas à celle qu'il a tapée ; sans
--     son crédit de parrainage ; commission du serveur (7 % depuis le test 81).
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.farine'), 'qty', 150)),
       'livraison', 'quai de la Joliette, 13002 Marseille') $$,
  'a validated merchant orders a wholesale volume, delivered'
);
select results_eq(
  $$ select audience, subtotal_cents, commission_cents, discount_cents, delivery_address
       from public.flash_orders where audience = 'commercants' $$,
  $$ values ('commercants'::text, 270000, 18900, 0, '8 rue des Carmes, 31000 Toulouse'::text) $$,
  'priced by the server, no referral credit, delivered to the buyer''s own shop'
);
reset role;

-- Le webhook Stripe (service_role) marque la commande payée.
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'payee', paid_at = now() where audience = 'commercants';
select set_config('tklink.b2b',
  (select id::text from public.flash_orders where audience = 'commercants'), true);

-- 87) Le grossiste livre lui-même, sans étape d'acceptation : préparée, expédiée, livrée.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select lives_ok(
  $$ select public.advance_order(current_setting('tklink.b2b')::uuid, 'preparation') $$,
  'the wholesaler prepares a paid order straight away'
);
select throws_ok(
  $$ select public.advance_order(current_setting('tklink.b2b')::uuid, 'prete') $$,
  'P0001',
  'invalid_transition',
  'a wholesaler delivery does not wait at the counter'
);
select lives_ok(
  $$ select public.advance_order(current_setting('tklink.b2b')::uuid, 'en_livraison') $$,
  'the wholesaler ships the order'
);
select lives_ok(
  $$ select public.advance_order(current_setting('tklink.b2b')::uuid, 'livree') $$,
  'the wholesaler marks it delivered'
);

-- 88) Le grossiste voit la commande ; elle est livrée.
select results_eq(
  $$ select status from public.flash_orders where audience = 'commercants' $$,
  $$ values ('livree'::text) $$,
  'the wholesaler sees the delivered order'
);
reset role;

-- 89) Une commande B2B livrée ne crédite aucun point de fidélité…
select results_eq(
  $$ select count(*)::integer from public.loyalty_ledger
      where order_id = current_setting('tklink.b2b')::uuid $$,
  $$ values (0) $$,
  'a wholesale order earns no loyalty points'
);

-- 90) …et ne débloque pas le parrainage de l'acheteur (aucun crédit de plus).
select results_eq(
  $$ select r.unlocked_at is null,
            (select count(*)::integer from public.referral_credits c where c.referee_id = r.referee_id)
       from public.referrals r where r.referee_id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values (true, 1) $$,
  'a wholesale order does not unlock the buyer''s referral'
);

-- 91) Le stock de l'offre pro a baissé de 150.
select results_eq(
  $$ select stock_left from public.flash_offers where title = 'Farine T65 (sac 25 kg)' $$,
  $$ values (350) $$,
  'the ordered volume leaves the wholesaler''s stock'
);

-- 92) Une livraison de client (Uber Direct) : le commerçant ne la marque pas « expédiée » lui-même.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.reserve_flash(
       jsonb_build_array(jsonb_build_object('offer_id', current_setting('tklink.pain'), 'qty', 1)),
       'livraison', '5 place du Capitole, 31000 Toulouse') $$,
  'a customer reserves a delivery'
);
reset role;
set local request.jwt.claims to '{}';
update public.flash_orders set status = 'payee', paid_at = now()
 where customer_id = '00000000-0000-0000-0000-0000000000a1' and status = 'paiement_attente';
select set_config('tklink.uber',
  (select id::text from public.flash_orders
    where customer_id = '00000000-0000-0000-0000-0000000000a1' and fulfilment = 'livraison'
      and status = 'payee'), true);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$ select public.advance_order(current_setting('tklink.uber')::uuid, 'preparation') $$,
  'the merchant prepares the delivery'
);
select throws_ok(
  $$ select public.advance_order(current_setting('tklink.uber')::uuid, 'en_livraison') $$,
  'P0001',
  'invalid_transition',
  'only the courier moves a customer delivery on, not the merchant'
);
reset role;

-- ─── 0024 : les notifications partent des déclencheurs (pg_net, secret dans Vault) ───
-- La file de pg_net n'est lue par son processus qu'après validation : dans ce test (annulé à la
-- fin), la requête reste en file et se lit.
select has_trigger('public', 'flash_orders', 'flash_orders_push', 'a status change notifies');
select has_trigger('public', 'support_messages', 'support_messages_push', 'a staff reply notifies');
select ok(
  not has_function_privilege('authenticated', 'private.post_push_event(text, jsonb, jsonb)', 'execute'),
  'no signed-in account can send a notification payload of its choosing'
);
select vault.create_secret('http://127.0.0.1:9/functions/v1/push-events', 'push_events_url');
select vault.create_secret('secret-de-test', 'push_webhook_secret');
select set_config('tklink.queued',
  (select coalesce(max(id), 0)::text from net.http_request_queue), true);
update public.flash_orders set uber_status = 'pending', updated_at = now()
 where id = current_setting('tklink.uber')::uuid;
update public.flash_orders set status = 'litige', updated_at = now()
 where id = current_setting('tklink.uber')::uuid;
select is(
  (select jsonb_build_object('n', count(*), 'secret', max(r.secret), 'keys', max(r.keys),
                            'status', max(r.status), 'old', max(r.old))
     from (select q.headers ->> 'x-webhook-secret' as secret,
                  (select string_agg(k, ',' order by k) from jsonb_object_keys(j.b -> 'record') k)
                    as keys,
                  j.b #>> '{record,status}' as status,
                  j.b #>> '{old_record,status}' as old
             from net.http_request_queue q,
                  lateral (select convert_from(q.body, 'UTF8')::jsonb as b) j
            where q.id > current_setting('tklink.queued')::bigint) r),
  jsonb_build_object(
    'n', 1, 'secret', 'secret-de-test',
    'keys', 'audience,customer_id,fulfilment,id,shop_id,status',
    'status', 'litige', 'old', 'preparation'),
  'one request per status change, with the six columns push-events reads and the shared secret'
);

-- ─── 0025 : noter le commerçant (étoiles + tags, une note par commande terminée) ───
select set_config('tklink.rate1',
  (select id::text from public.flash_orders
    where customer_id = '00000000-0000-0000-0000-0000000000a1' and audience = 'clients'
      and id <> current_setting('tklink.uber')::uuid
    order by created_at limit 1), true);
update public.flash_orders set status = 'livree', updated_at = now()
 where id = current_setting('tklink.rate1')::uuid;
select set_config('tklink.rate_shop',
  (select shop_id::text from public.flash_orders where id = current_setting('tklink.rate1')::uuid), true);
select set_config('tklink.b2b',
  (select id::text from public.flash_orders
    where audience = 'commercants' and status = 'livree' limit 1), true);
select set_config('tklink.b2b_buyer',
  (select customer_id::text from public.flash_orders
    where id = current_setting('tklink.b2b')::uuid), true);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.uber')::uuid, 4, '{}') $$,
  'P0001', 'not_finished', 'an order that is not finished cannot be rated'
);
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 6, '{}') $$,
  '22023', 'invalid_rating', 'six stars is not a rating'
);
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 4, array['Très sympa']) $$,
  '22023', 'invalid_rating', 'no free text: only the closed list of tags'
);
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 4, array['Rapide', 'Rapide']) $$,
  '22023', 'invalid_rating', 'a tag counts once'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 1, '{}') $$,
  'P0001', 'order_not_found', 'nobody rates someone else''s order'
);
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('tklink.b2b_buyer'), 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.b2b')::uuid, 5, '{}') $$,
  'P0001', 'not_ratable', 'a B2B purchase is not rated (customer rule)'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 5,
       array['Rapide', 'Conforme à l’offre']) $$,
  'the customer rates a finished order'
);
select throws_ok(
  $$ select public.rate_order(current_setting('tklink.rate1')::uuid, 3, '{}') $$,
  'P0001', 'already_rated', 'one rating per order'
);
select is(
  (select stars::integer from public.order_ratings where order_id = current_setting('tklink.rate1')::uuid),
  5, 'the customer reads back their own rating'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is(
  (select count(*)::integer from public.order_ratings),
  0, 'nobody else reads the rating itself'
);
reset role;
set local role anon;
set local request.jwt.claims to '{}';
select is(
  (select jsonb_build_object('average', r.average, 'count', r.count)
     from public.shop_ratings(array[current_setting('tklink.rate_shop')::uuid]) r),
  jsonb_build_object('average', 5.0, 'count', 1),
  'the storefront average is public'
);
reset role;

-- ─── 0026 : suivre un commerce, alerte à la publication d'une Flash ───
select set_config('tklink.shop_a2',
  (select id::text from public.shops where owner_id = '00000000-0000-0000-0000-0000000000a2'), true);
select set_config('tklink.shop_a5',
  (select id::text from public.shops where owner_id = '00000000-0000-0000-0000-0000000000a5'), true);
select set_config('tklink.shop_a6',
  (select id::text from public.shops where owner_id = '00000000-0000-0000-0000-0000000000a6'), true);

set local role authenticated;
set local request.jwt.claims to '{sub:00000000-0000-0000-0000-0000000000a1,role:authenticated}';
select lives_ok(
  $$ insert into public.shop_follows (user_id, shop_id)
     values ('00000000-0000-0000-0000-0000000000a1', current_setting('tklink.shop_a2')::uuid) $$,
  'a customer follows a validated shop'
);
select throws_ok(
  $$ insert into public.shop_follows (user_id, shop_id)
     values ('00000000-0000-0000-0000-0000000000a2', current_setting('tklink.shop_a5')::uuid) $$,
  '42501', null, 'nobody follows a shop on someone else''s behalf'
);
select throws_ok(
  $$ insert into public.shop_follows (user_id, shop_id)
     values ('00000000-0000-0000-0000-0000000000a1', current_setting('tklink.shop_a6')::uuid) $$,
  '42501', null, 'a shop that is not validated cannot be followed'
);
reset role;
set local role authenticated;
set local request.jwt.claims to '{sub:00000000-0000-0000-0000-0000000000a2,role:authenticated}';
select is(
  (select count(*)::integer from public.shop_follows),
  0, 'nobody reads someone else''s follows'
);
reset role;
set local request.jwt.claims to '{}';

select set_config('tklink.queued_follow',
  (select coalesce(max(id), 0)::text from net.http_request_queue), true);
insert into public.flash_offers
  (shop_id, audience, title, category, price_cents, old_price_cents, stock_total, stock_left,
   duration_minutes, ends_at)
values (current_setting('tklink.shop_a2')::uuid, 'clients', 'Tarte du jour', 'restauration',
        300, 600, 5, 5, 60, now() + interval '1 hour');
select is(
  (select jsonb_build_object(
            'n', count(*),
            'table', max(convert_from(q.body, 'UTF8')::jsonb ->> 'table'),
            'title', max(convert_from(q.body, 'UTF8')::jsonb #>> '{record,title}'))
     from net.http_request_queue q
    where q.id > current_setting('tklink.queued_follow')::bigint),
  jsonb_build_object('n', 1, 'table', 'flash_offers', 'title', 'Tarte du jour'),
  'a followed shop publishes a Flash: its followers are alerted'
);
insert into public.flash_offers
  (shop_id, audience, title, category, price_cents, old_price_cents, stock_total, stock_left,
   duration_minutes, ends_at)
values (current_setting('tklink.shop_a2')::uuid, 'clients', 'Quiche du jour', 'restauration',
        300, 600, 5, 5, 60, now() + interval '1 hour');
select is(
  (select count(*)::integer from net.http_request_queue q
    where q.id > current_setting('tklink.queued_follow')::bigint),
  1, 'a second Flash within 30 minutes does not wake followers again'
);
insert into public.shop_follows (user_id, shop_id)
values ('00000000-0000-0000-0000-0000000000a1', current_setting('tklink.shop_a5')::uuid);
insert into public.flash_offers
  (shop_id, audience, title, category, price_cents, old_price_cents, stock_total, stock_left,
   min_qty, duration_minutes, ends_at)
values (current_setting('tklink.shop_a5')::uuid, 'commercants', 'Farine T55 (sac 25 kg)',
        'restauration', 1500, 1900, 100, 100, 10, 60, now() + interval '1 hour');
select is(
  (select count(*)::integer from net.http_request_queue q
    where q.id > current_setting('tklink.queued_follow')::bigint),
  1, 'a wholesaler pro offer alerts nobody'
);
set local role authenticated;
set local request.jwt.claims to '{sub:00000000-0000-0000-0000-0000000000a1,role:authenticated}';
select lives_ok(
  $$ delete from public.shop_follows where shop_id = current_setting('tklink.shop_a2')::uuid $$,
  'the customer unfollows'
);
select is(
  (select count(*)::integer from public.shop_follows
    where shop_id = current_setting('tklink.shop_a2')::uuid),
  0, 'and the follow is gone'
);
reset role;

select * from finish();
rollback;
