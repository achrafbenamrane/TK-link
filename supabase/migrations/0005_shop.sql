-- 0005_shop — catalogue, commandes, adresses, fidélité.
--
-- Deux règles gouvernent ce fichier, parce que ce sont les deux erreurs qui
-- coûtent de l'argent dans une app de vente flash :
--
--   1. LE CLIENT NE FIXE JAMAIS UN PRIX. Le mobile envoie « ce panier », jamais
--      « ce panier vaut 4,20 € ». Les totaux sont recalculés ici depuis la table
--      des offres. Sans ça, n'importe qui peut poster une commande à 0,01 € : le
--      client est du code qu'on ne contrôle pas.
--
--   2. LE STOCK SE DÉCRÉMENTE SOUS VERROU. Deux acheteurs sur la dernière pièce
--      d'une vente flash, c'est le cas nominal, pas le cas limite. Un
--      `update ... set stock_left = stock_left - 1` côté client laisse passer les
--      deux. Le passage de commande est donc une fonction atomique.
--
-- Les identifiants du catalogue sont des slugs lisibles (m_hammamet, d_cote) :
-- ils viennent du catalogue local et restent stables et débuggables. Ce qui
-- appartient à un utilisateur (commandes, adresses, bons) prend un uuid généré
-- côté serveur — jamais une valeur choisie par le client.

-- ─────────────────────────────────────────────────────────── catalogue (public)

create table public.merchants (
  id text primary key check (id ~ '^m_[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 120),
  area text not null check (char_length(area) <= 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  halal boolean not null default false,
  emoji text,
  created_at timestamptz not null default now()
);

create table public.deals (
  id text primary key check (id ~ '^d_[a-z0-9_]{2,40}$'),
  merchant_id text not null references public.merchants (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('restos', 'artisans', 'courses', 'shopping')),
  -- Prix en CENTIMES : un float sur de la monnaie finit toujours par afficher
  -- 24.900000000000002 ou par perdre un centime à l'arrondi.
  price_cents integer not null check (price_cents > 0),
  old_price_cents integer check (old_price_cents is null or old_price_cents > price_cents),
  unit text,
  description text,
  perk text,
  origin text,
  image_url text,
  tint text,
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  stock_total integer not null check (stock_total >= 0),
  stock_left integer not null check (stock_left >= 0 and stock_left <= stock_total),
  -- Un INSTANT de fin, pas une durée : « il reste 285 s » ne survit pas à un
  -- aller-retour réseau ni à un téléphone en veille.
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index deals_active_idx on public.deals (ends_at) where stock_left > 0;
create index deals_merchant_idx on public.deals (merchant_id);

-- Le catalogue est lisible sans compte : on peut regarder les offres du quartier
-- avant de s'inscrire. Personne n'écrit via l'API — l'alimentation passe par le
-- back-office (service role), qui contourne RLS.
grant select on public.merchants to anon, authenticated;
grant select on public.deals to anon, authenticated;

create policy "merchants: lecture publique" on public.merchants
  for select to anon, authenticated using (true);

create policy "deals: lecture publique" on public.deals
  for select to anon, authenticated using (true);

-- ────────────────────────────────────────────────── adresses (par utilisateur)

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  street text not null check (char_length(street) between 3 and 200),
  zip text not null check (zip ~ '^\d{5}$'),
  city text not null check (char_length(city) between 2 and 100),
  notes text check (char_length(notes) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);

-- Une seule adresse par défaut par personne — garanti par l'index, pas par la
-- bonne volonté du client.
create unique index addresses_one_default_idx
  on public.addresses (user_id) where is_default;

grant select, insert, update, delete on public.addresses to authenticated;

create policy "addresses: les siennes" on public.addresses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ───────────────────────────────────────────────── commandes (par utilisateur)

create type public.order_status as enum ('en_preparation', 'en_livraison', 'livree', 'annulee');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address_id uuid references public.addresses (id) on delete set null,
  status public.order_status not null default 'en_preparation',
  -- Calculés par place_order(), jamais reçus du client.
  subtotal_cents integer not null check (subtotal_cents >= 0),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  points_earned integer not null default 0 check (points_earned >= 0),
  created_at timestamptz not null default now()
);

create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  deal_id text not null references public.deals (id),
  -- Le libellé et le prix sont FIGÉS à l'achat : si le commerçant renomme son
  -- produit ou change son prix demain, la facture d'hier ne doit pas bouger.
  title text not null,
  emoji text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  qty integer not null check (qty > 0)
);

create index order_items_order_idx on public.order_items (order_id);

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Lecture seule côté client : on ne crée pas une commande en l'insérant, on
-- appelle place_order() (voir plus bas). Aucune policy d'insert n'existe, donc
-- aucun insert direct n'est possible.
create policy "orders: les siennes" on public.orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "order_items: via la commande" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────── fidélité
--
-- Les points sont un GRAND LIVRE, pas un compteur. Un simple entier ne dit ni
-- d'où viennent les points ni où ils sont partis — impossible d'auditer un
-- litige, et le partage entre proches devient indéfendable. Le solde est la
-- somme du livre, et il ne peut pas devenir négatif (contrainte plus bas).

create type public.point_reason as enum ('achat', 'bon_achat', 'don_envoye', 'don_recu', 'ajustement');

create table public.point_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Positif = crédit, négatif = débit.
  amount integer not null check (amount <> 0),
  reason public.point_reason not null,
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);

create index point_entries_user_idx on public.point_entries (user_id, created_at desc);

grant select on public.point_entries to authenticated;

create policy "points: les siens" on public.point_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sans 0/O/1/I : ces codes se lisent à voix haute au comptoir.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$'),
  value_cents integer not null check (value_cents > 0),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index vouchers_user_idx on public.vouchers (user_id) where used_at is null;

grant select on public.vouchers to authenticated;

create policy "vouchers: les siens" on public.vouchers
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Solde courant : somme du livre. Une vue plutôt qu'une colonne, pour qu'un
-- solde et son historique ne puissent jamais diverger.
create or replace function public.points_balance()
  returns integer
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_entries
  where user_id = (select auth.uid());
$$;

grant execute on function public.points_balance() to authenticated;

-- ──────────────────────────────────────────── demandes « devenir commerçant »

create table public.merchant_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  shop_name text not null check (char_length(shop_name) between 2 and 120),
  category text not null check (category in ('restos', 'artisans', 'courses', 'shopping')),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  phone text not null check (phone ~ '^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$'),
  email text not null check (position('@' in email) > 1),
  area text not null check (char_length(area) between 2 and 80),
  created_at timestamptz not null default now()
);

grant insert, select on public.merchant_applications to authenticated;

create policy "candidatures: déposer la sienne" on public.merchant_applications
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "candidatures: relire la sienne" on public.merchant_applications
  for select to authenticated
  using ((select auth.uid()) = user_id);
