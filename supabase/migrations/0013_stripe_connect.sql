-- 0013_stripe_connect — le compte Stripe du commerçant, pour être payé dans l'app.
--
-- Étape 3 du plan docs/architecture/exec-plans/2026-11-13-rapport-avancement.md. CDC V1.1 : le client
-- paie via Stripe Connect en « Direct charges » ; le commerçant reçoit le prix moins la commission.
--
-- Le compte connecté (`acct_…`) est créé et rattaché par la fonction Edge `stripe-connect`, son état
-- (« peut encaisser ») tenu par le webhook Stripe (`account.updated`). Aucune de ces colonnes n'est
-- dans un droit d'écriture client (les droits de mise à jour de `shops` sont accordés colonne par
-- colonne, 0010) : un commerçant ne se déclare pas « encaissable » lui-même.

alter table public.shops
  add column stripe_account_id text unique check (stripe_account_id is null or stripe_account_id ~ '^acct_'),
  add column stripe_charges_enabled boolean not null default false;

-- Les paiements qui ne collent pas (payés après expiration de la réservation, remboursés…) passent
-- en « litige » : TK LINK les retrouve ici, dans le SQL Editor.
create index flash_orders_litige_idx on public.flash_orders (updated_at desc) where status = 'litige';
