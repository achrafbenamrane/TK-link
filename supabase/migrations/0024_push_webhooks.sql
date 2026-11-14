-- 0024_push_webhooks — les notifications partent d'elles-mêmes.
--
-- `push-events` (0016) attendait deux « Database Webhooks » créés à la main dans le tableau de bord,
-- le secret partagé recopié dans leur en-tête. Ici, deux déclencheurs font cet appel, et le dépôt en
-- garde la trace :
--
--   1. ASYNCHRONE (pg_net) : une commande n'attend jamais sa notification, et une erreur d'envoi ne
--      bloque ni un paiement ni une réponse du support (elle n'est qu'un avertissement).
--   2. RIEN DE SECRET ICI : l'adresse de la fonction et le secret partagé (`PUSH_WEBHOOK_SECRET`)
--      sont lus dans Supabase Vault. Ce fichier vaut pour n'importe quel projet ; tant que Vault ne
--      les a pas, rien ne part et rien n'échoue.
--   3. LE NÉCESSAIRE SEUL : on envoie les colonnes que lit `push-events` — ni code de retrait, ni
--      montant, ni adresse, ni texte du message.
--   4. SEULEMENT CE QUI SE DIT : un changement de statut d'une commande (le suivi Uber met la ligne
--      à jour souvent, sans rien à dire), une réponse de TK LINK au support. Une réservation qui se
--      crée n'est pas encore payée : rien à dire non plus.
--
-- Mise en route, une fois par projet (hors dépôt : la valeur du secret ne s'écrit pas ici) :
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/push-events', 'push_events_url');
--   select vault.create_secret('<la valeur de PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');

create extension if not exists pg_net;

-- L'appel lui-même. `push-events` lit les destinataires dans la charge utile (client, commerce,
-- demande) : personne d'autre que ces déclencheurs ne doit pouvoir l'appeler.
create or replace function private.post_push_event(p_table text, p_record jsonb, p_old jsonb)
  returns void
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
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'schema', 'public', 'table', p_table,
      'record', p_record, 'old_record', p_old
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'push-events non appelée (%) : %', p_table, sqlerrm;
end;
$$;

create or replace function private.flash_orders_push()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform private.post_push_event(
    'flash_orders',
    jsonb_build_object(
      'id', new.id, 'status', new.status, 'fulfilment', new.fulfilment,
      'audience', new.audience, 'customer_id', new.customer_id, 'shop_id', new.shop_id
    ),
    jsonb_build_object('status', old.status)
  );
  return null;
end;
$$;

create or replace function private.support_messages_push()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform private.post_push_event(
    'support_messages',
    jsonb_build_object('ticket_id', new.ticket_id, 'from_staff', new.from_staff),
    null
  );
  return null;
end;
$$;

drop trigger if exists flash_orders_push on public.flash_orders;
create trigger flash_orders_push
  after update of status on public.flash_orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.flash_orders_push();

drop trigger if exists support_messages_push on public.support_messages;
create trigger support_messages_push
  after insert on public.support_messages
  for each row
  when (new.from_staff)
  execute function private.support_messages_push();

revoke execute on function private.post_push_event(text, jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function private.flash_orders_push() from public, anon, authenticated;
revoke execute on function private.support_messages_push() from public, anon, authenticated;
