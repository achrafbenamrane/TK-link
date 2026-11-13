-- 0020_checkout_cancel — annuler une réservation dont la page de paiement Stripe est ouverte.
--
-- Relevé par la relecture de 0019 (13/11/2026), le défaut vient de 0012 : `cancel_order` ne vérifiait
-- que `stripe_payment_intent_id`, vide tant que la page Stripe Checkout est ouverte. On pouvait donc
-- annuler (le stock revenait, et pouvait être revendu), puis payer quand même sur la page restée
-- ouverte — la commande passait « litige », et le même stock était vendu deux fois.
--
--   1. SANS PAGE OUVERTE, rien ne change : le client annule sa réservation (`cancel_order`).
--   2. PAGE OUVERTE : `cancel_order` refuse (`checkout_open`). L'app passe alors par la fonction Edge
--      `order-cancel`, qui fait d'abord EXPIRER la page chez Stripe — plus personne ne peut y payer —
--      puis annule par `cancel_order_after_checkout`, réservée au serveur. Si le paiement vient
--      d'aboutir, Stripe refuse l'expiration : la commande reste payée.
--   3. L'annulation elle-même (statut + stock rendu) vit à un seul endroit : `private.cancel_reservation`.
--   4. ELLE VISE UNE PAGE PRÉCISE : on n'annule que si la commande porte encore la page qu'on vient
--      d'expirer (`is not distinct from`). Si une nouvelle page s'est ouverte entre-temps, l'annulation
--      répond `checkout_open` — sinon cette nouvelle page resterait payable (relecture du 13/11/2026).

create or replace function private.cancel_reservation(p_order uuid, p_checkout text)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.flash_orders o
     set status = 'annulee', updated_at = now()
   where o.id = p_order
     and o.status = 'paiement_attente'
     and o.stripe_payment_intent_id is null
     -- La page de paiement est celle qu'on a expirée (ou aucune) : pas une page ouverte entre-temps.
     and o.stripe_checkout_id is not distinct from p_checkout;
  if not found then
    return false;
  end if;
  update public.flash_offers f
     set stock_left = least(f.stock_total, f.stock_left + i.qty)
    from public.flash_order_items i
   where i.order_id = p_order and f.id = i.offer_id;
  return true;
end;
$$;

-- Le client annule sa réservation — tant qu'aucune page de paiement n'est ouverte.
create or replace function public.cancel_order(p_order uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.flash_orders%rowtype;
begin
  select * into v_order
    from public.flash_orders o
   where o.id = p_order and o.customer_id = auth.uid()
   for update;
  if not found
     or v_order.status <> 'paiement_attente'
     or v_order.stripe_payment_intent_id is not null then
    raise exception 'not_cancellable' using errcode = 'P0001';
  end if;
  if v_order.stripe_checkout_id is not null then
    raise exception 'checkout_open' using errcode = 'P0001';
  end if;
  perform private.cancel_reservation(p_order, null);
end;
$$;

-- Après expiration de LA page Stripe `p_checkout` (fonction Edge `order-cancel`, clé de service).
create or replace function public.cancel_order_after_checkout(p_order uuid, p_checkout text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if private.cancel_reservation(p_order, p_checkout) then
    return;
  end if;
  -- Toujours à payer, mais une autre page s'est ouverte : on ne l'annule pas dans son dos.
  if exists (
    select 1 from public.flash_orders o
     where o.id = p_order
       and o.status = 'paiement_attente'
       and o.stripe_payment_intent_id is null
  ) then
    raise exception 'checkout_open' using errcode = 'P0001';
  end if;
  raise exception 'not_cancellable' using errcode = 'P0001';
end;
$$;

revoke execute on function private.cancel_reservation(uuid, text) from public;
revoke execute on function public.cancel_order_after_checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_order_after_checkout(uuid, text) to service_role;
-- `cancel_order` garde ses droits de 0012 (create or replace) : réservé aux comptes.
