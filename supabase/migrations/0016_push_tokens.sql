-- 0016_push_tokens — où envoyer les notifications d'un compte (un jeton Expo par téléphone).
--
-- Étape 4 du plan docs/architecture/exec-plans/2026-11-13-rapport-avancement.md. L'app enregistre
-- le jeton de l'appareil (`register_push_token`) ; la fonction Edge `push-events`, appelée par un
-- « Database Webhook » de Supabase à chaque changement de commande ou nouvelle réponse du support,
-- envoie la notification. Le jeton ne sort jamais vers un autre compte.

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[^\]]+\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- Enregistrer le jeton de CE téléphone pour le compte connecté. Un téléphone passé d'un compte à un
-- autre (déconnexion, autre compte) change de propriétaire : ses notifications suivent la personne
-- connectée, pas l'ancienne.
create or replace function public.register_push_token(p_token text, p_platform text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- À la déconnexion : ce téléphone ne reçoit plus rien pour ce compte.
create or replace function public.unregister_push_token(p_token text)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid()
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Aucun accès direct : ni lecture (un jeton permet d'écrire à quelqu'un), ni écriture.
-- (RLS active par le déclencheur de 0001, aucune règle, aucun droit.)
