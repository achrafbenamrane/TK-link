-- pgTAP RLS tests. Run with: supabase test db
-- These assert the security INVARIANTS, not behaviour — they fail loudly if a
-- future migration disables RLS or opens a client write path on entitlements.

begin;
select plan(13);

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
  $$ select first_name, last_name, account_type, contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Neo'::text, 'Démo'::text, 'consommateur'::text, null::text, false) $$,
  'signup trigger ignores an unknown account_type and a malformed phone'
);

-- 9) …et retient ce qui est valide.
insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000a2',
  '{"first_name":"Sofia","account_type":"commercant","contact_phone":"+33612345678"}'::jsonb
);
select results_eq(
  $$ select first_name, account_type, contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('Sofia'::text, 'commercant'::text, '+33612345678'::text, false) $$,
  'signup trigger keeps valid metadata, phone stays unverified'
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

-- 11) Confirmer un numéro par SMS le recopie dans le profil et le marque vérifié.
update auth.users
   set phone = '33698765432', phone_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000000a2';
select results_eq(
  $$ select contact_phone, phone_verified
       from public.profiles where id = '00000000-0000-0000-0000-0000000000a2' $$,
  $$ values ('+33698765432'::text, true) $$,
  'a confirmed phone becomes the verified contact phone'
);

select * from finish();
rollback;
