-- 0027_order_refunds — « Signaler un problème » sur une vraie commande, et le remboursement qui part
-- tout seul.
--
-- CDC V1.1 (Utilisateur > Process, VALIDÉ) : « un point d'entrée unique sur l'écran de commande, qui
-- route automatiquement vers un remboursement ou vers une file Super Admin selon l'incident ».
-- Jusqu'ici, une commande du serveur n'ouvrait qu'une demande au support, et tout remboursement se
-- faisait à la main dans Stripe.
--
--   1. LE CLIENT DIT CE QUI S'EST PASSÉ (`report_order_issue`, trois motifs, pas de texte libre) et la
--      base décide où ça part — la règle de l'app (`src/features/shop/lib/issues.ts`) : « je n'ai rien
--      reçu » AVANT la remise (payée, acceptée, en préparation) → remboursement sans examen, l'argent
--      est pris et rien n'est sorti du commerce ; le stock revient alors aux autres clients. Tout le
--      reste → « litige », la file du back-office (0021). Un signalement par commande.
--   2. LE REMBOURSEMENT PART DE LA BASE : dès qu'une commande passe « remboursement en cours » — par
--      ce signalement, ou par la décision « Rembourser » du back-office — un déclencheur appelle la
--      fonction Edge `order-refund` (pg_net, le secret des notifications, 0024). Elle rembourse chez
--      Stripe au nom du commerce (Direct charges), frais de TK LINK compris ; le webhook Stripe passe
--      ensuite la commande « remboursée ». Stripe refuse, ou un coursier roule encore : la commande
--      revient en « litige » avec la raison (`refund_failure`), un humain tranche.
--   3. CONTESTATION BANCAIRE : un client qui conteste le paiement auprès de sa banque met la commande
--      en litige (webhook `charge.dispute.created`, `stripe_dispute_id`) — sinon personne ne le
--      saurait avant le débit.
--   4. LE COMMERÇANT REFUSE une commande payée qu'il ne peut pas honorer (`refuse_order`, avant de
--      la préparer) : « refusée », et le remboursement part de la même façon. CDC V1.1 : « refusée »
--      est une des exceptions du suivi ; l'app de démonstration le faisait déjà (payée → refusée →
--      remboursement). Le stock ne revient pas : s'il refuse, c'est qu'il n'a plus le produit.
--
-- Rien de plus à régler : l'adresse de `order-refund` se déduit de celle de `push-events` (Vault).

alter table public.flash_orders
  add column issue_kind text check (issue_kind in ('non_recue', 'non_conforme', 'autre')),
  add column issue_reported_at timestamptz,
  add column stripe_refund_id text,
  add column refund_failure text check (refund_failure is null or char_length(refund_failure) <= 200),
  add column stripe_dispute_id text;

-- Un motif sans date (ou l'inverse) n'est pas un signalement.
alter table public.flash_orders
  add constraint flash_orders_issue_check check ((issue_kind is null) = (issue_reported_at is null));

-- ─────────────────────────────────────────────────────────────── signaler (l'acheteur)

create or replace function public.report_order_issue(p_order uuid, p_kind text)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.flash_orders%rowtype;
  v_refund boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('non_recue', 'non_conforme', 'autre') then
    raise exception 'invalid_issue' using errcode = '22023';
  end if;

  select o.* into v_order
    from public.flash_orders o
   where o.id = p_order and o.customer_id = auth.uid()
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.issue_reported_at is not null then
    raise exception 'already_reported' using errcode = 'P0001';
  end if;
  -- Payée, ni close ni déjà entre les mains de TK LINK. Une réservation à payer s'annule, elle ne se
  -- signale pas.
  if v_order.status not in ('payee', 'acceptee', 'preparation', 'prete', 'en_livraison',
                            'recuperee', 'livree') then
    raise exception 'not_reportable' using errcode = 'P0001';
  end if;

  v_refund := p_kind = 'non_recue'
              and v_order.status in ('payee', 'acceptee', 'preparation')
              and v_order.stripe_payment_intent_id is not null;

  update public.flash_orders
     set status = case when v_refund then 'remboursement_en_cours' else 'litige' end,
         issue_kind = p_kind,
         issue_reported_at = now(),
         updated_at = now()
   where id = p_order;

  -- Rien n'est sorti du commerce : le stock revient aux autres clients, tant que l'offre court.
  if v_refund then
    update public.flash_offers f
       set stock_left = least(f.stock_total, f.stock_left + i.qty)
      from public.flash_order_items i
     where i.order_id = p_order and f.id = i.offer_id and f.ends_at > now();
  end if;

  return case when v_refund then 'remboursement' else 'admin' end;
end;
$$;

revoke execute on function public.report_order_issue(uuid, text) from public, anon;
grant execute on function public.report_order_issue(uuid, text) to authenticated;

-- ─────────────────────────────────── refuser (le commerçant) : payée, mais impossible à honorer

create or replace function public.refuse_order(p_order uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_order public.flash_orders%rowtype;
begin
  select o.* into v_order
    from public.flash_orders o
    join public.shops s on s.id = o.shop_id
   where o.id = p_order and s.owner_id = auth.uid()
   for update of o;
  if not found then
    raise exception 'not_your_order' using errcode = '42501';
  end if;
  -- Avant la préparation seulement : une fois commencée, la commande s'honore ou passe par TK LINK.
  if v_order.status not in ('payee', 'acceptee') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.flash_orders set status = 'refusee', updated_at = now() where id = p_order;
end;
$$;

revoke execute on function public.refuse_order(uuid) from public, anon;
grant execute on function public.refuse_order(uuid) to authenticated;

-- ───────────────────────────────── « remboursement en cours » ou « refusée » → la fonction Edge

-- La même porte que les notifications (0024) : l'adresse de `push-events` dans Vault, dont on prend
-- la voisine `order-refund`, et le même secret partagé. Sans eux, rien ne part et rien n'échoue (un
-- avertissement) : la commande reste « remboursement en cours », visible au back-office.
create or replace function private.request_order_refund()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'push_events_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'push_webhook_secret';
  if v_url is null or v_secret is null or v_url !~ '/push-events$' then
    raise warning 'order-refund non appelée : adresse ou secret absents de Vault';
    return null;
  end if;
  perform net.http_post(
    url := regexp_replace(v_url, '/push-events$', '/order-refund'),
    body := jsonb_build_object('order_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  raise warning 'order-refund non appelée : %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists flash_orders_refund on public.flash_orders;
create trigger flash_orders_refund
  after update of status on public.flash_orders
  for each row
  when (new.status in ('remboursement_en_cours', 'refusee') and old.status is distinct from new.status)
  execute function private.request_order_refund();

revoke execute on function private.request_order_refund() from public, anon, authenticated;
