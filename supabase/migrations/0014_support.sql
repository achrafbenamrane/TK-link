-- 0014_support — écrire à TK LINK : chaque demande est un ticket, suivi et répondu depuis le
-- back-office.
--
-- Étape 5 du plan docs/architecture/exec-plans/2026-11-13-rapport-avancement.md. Décision du
-- 13/11/2026 : la messagerie est celle du SUPPORT (clients et commerçants écrivent à TK LINK), pas
-- une messagerie entre utilisateurs.
--
-- Quatre règles :
--
--   1. CHACUN NE VOIT QUE SES DEMANDES. Un ticket et ses messages ne sont lus que par leur auteur
--      (et par TK LINK, côté serveur, avec la clé de service).
--   2. LE CLIENT NE PARLE PAS AU NOM DE TK LINK. `from_staff` est forcé à faux pour tout message
--      venu de l'app ; seules les réponses écrites avec la clé de service (back-office) le portent.
--   3. LE STATUT SUIT LA CONVERSATION. Un message du client rouvre un ticket résolu ; une réponse de
--      TK LINK le met « en cours ». Le client ne choisit pas le statut (aucun droit sur la colonne).
--   4. PAS D'INONDATION. Cinq nouvelles demandes par compte et par 24 heures ; un message fait 2 000
--      caractères au plus ; une demande close (« fermé ») ne reçoit plus de message.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('commande', 'paiement', 'livraison', 'compte', 'commerce', 'autre')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  -- La commande concernée, s'il y en a une (vérifiée : ce doit être une commande de l'auteur ou de
  -- son commerce).
  order_id uuid references public.flash_orders (id) on delete set null,
  status text not null default 'ouvert' check (status in ('ouvert', 'en_cours', 'resolu', 'ferme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index support_tickets_author_idx on public.support_tickets (author_id, last_message_at desc);
-- La file du back-office : ce qui attend une réponse, le plus ancien d'abord.
create index support_tickets_queue_idx on public.support_tickets (last_message_at)
  where status in ('ouvert', 'en_cours');

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  from_staff boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────── gardiens

create or replace function private.support_tickets_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
begin
  if v_client then
    new.author_id := auth.uid();
    new.status := 'ouvert';
    new.created_at := now();
    new.last_message_at := now();
    if (select count(*) from public.support_tickets t
         where t.author_id = new.author_id and t.created_at > now() - interval '24 hours') >= 5 then
      raise exception 'too_many_tickets' using errcode = 'P0001';
    end if;
    if new.order_id is not null and not exists (
      select 1 from public.flash_orders o
       where o.id = new.order_id
         and (o.customer_id = new.author_id
              or exists (select 1 from public.shops s where s.id = o.shop_id and s.owner_id = new.author_id))
    ) then
      raise exception 'not_your_order' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger support_tickets_guard
  before insert on public.support_tickets
  for each row execute function private.support_tickets_guard();

create or replace function private.support_messages_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_client boolean := coalesce(auth.role(), '') in ('authenticated', 'anon');
  v_status text;
begin
  select t.status into v_status from public.support_tickets t where t.id = new.ticket_id for update;
  if v_status is null then
    raise exception 'ticket_not_found' using errcode = 'P0001';
  end if;

  if v_client then
    new.author_id := auth.uid();
    new.from_staff := false;
    new.created_at := now();
    if v_status = 'ferme' then
      raise exception 'ticket_closed' using errcode = 'P0001';
    end if;
  end if;

  update public.support_tickets t
     set last_message_at = now(),
         updated_at = now(),
         status = case
           when new.from_staff and t.status = 'ouvert' then 'en_cours'
           when not new.from_staff and t.status = 'resolu' then 'ouvert'
           else t.status
         end
   where t.id = new.ticket_id;
  return new;
end;
$$;

create trigger support_messages_guard
  before insert on public.support_messages
  for each row execute function private.support_messages_guard();

-- ──────────────────────────────────────────────────────────────────────────────── droits

grant select on public.support_tickets to authenticated;
grant insert (category, subject, order_id) on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;
grant insert (ticket_id, body) on public.support_messages to authenticated;

create policy "support: ses demandes" on public.support_tickets
  for select to authenticated
  using (author_id = (select auth.uid()));

create policy "support: ouvrir une demande" on public.support_tickets
  for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy "support: les messages de ses demandes" on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id and t.author_id = (select auth.uid())
    )
  );

create policy "support: écrire dans ses demandes" on public.support_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
       where t.id = ticket_id and t.author_id = (select auth.uid())
    )
  );

-- Les réponses de TK LINK arrivent en direct dans l'app (sous RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end;
$$;
