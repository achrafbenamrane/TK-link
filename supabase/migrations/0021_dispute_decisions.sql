-- 0021_dispute_decisions — la décision de TK LINK sur une commande en litige, gardée avec elle.
--
-- Une commande passe « litige » quand l'argent et la commande ne disent plus la même chose : payée
-- après l'expiration de sa réservation, course Uber échouée après paiement. Le back-office
-- (`/admin` → Litiges) la tranche : rembourser le client (« remboursement en cours », le
-- remboursement se fait dans Stripe et le webhook la passe « remboursée »), ou donner raison au
-- commerçant / faire un geste (la commande est honorée : « récupérée » ou « livrée »).
--
-- Une décision qui engage de l'argent est toujours MOTIVÉE et DATÉE — sinon personne ne saura, dans
-- un mois, pourquoi 89 € ont été rendus. Écrites par le back-office seul (clé de service) ; le client
-- et le commerçant de la commande peuvent les lire (la commande leur est déjà lisible).

alter table public.flash_orders
  add column dispute_outcome text check (dispute_outcome in ('refund', 'merchant', 'gesture')),
  add column dispute_note text check (char_length(btrim(dispute_note)) between 3 and 500),
  add column dispute_decided_at timestamptz;

-- Les trois ensemble, ou aucun : une décision sans motif (ou sans date) n'en est pas une.
alter table public.flash_orders
  add constraint flash_orders_dispute_decision_check check (
    (dispute_outcome is null and dispute_note is null and dispute_decided_at is null)
    or (dispute_outcome is not null and dispute_note is not null and dispute_decided_at is not null)
  );

create index flash_orders_dispute_idx on public.flash_orders (updated_at desc)
  where status = 'litige' or dispute_decided_at is not null;
