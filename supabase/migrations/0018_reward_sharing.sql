-- 0018_reward_sharing — partager une récompense de fidélité, tenue par le serveur.
--
-- CDC V1.1 (arbitrage des maquettes du 03/10/2026) : « pas de transfert de points ; partage d'une
-- récompense ». Une récompense débloquée peut s'offrir ; les points, jamais.
--
--   1. LE COMMERÇANT VALIDE UN CODE, PAS UNE PERSONNE : `redeem_reward` accepte le code de qui le
--      présente. Partager une récompense, c'est donc envoyer son code — rien à transférer.
--   2. CELUI QUI PARTAGE S'EN DÉFAIT : la récompense passe « partagée » et quitte son inventaire
--      (elle reste dans son historique). Sans ce statut, les deux pourraient la présenter ; le
--      premier servi l'emporterait et l'autre se verrait refuser au comptoir.
--   3. UNE RÉCOMPENSE PARTAGÉE RESTE VALABLE chez le commerçant, une seule fois, comme toute autre.
--   4. Seul son titulaire partage une récompense, et seulement tant qu'elle est disponible.

alter table public.loyalty_rewards drop constraint loyalty_rewards_status_check;
alter table public.loyalty_rewards
  add constraint loyalty_rewards_status_check
  check (status in ('disponible', 'partagee', 'utilisee'));
alter table public.loyalty_rewards add column shared_at timestamptz;

-- Partager MA récompense : rend son code, à envoyer.
create or replace function public.share_reward(p_reward uuid)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.loyalty_rewards
     set status = 'partagee', shared_at = now()
   where id = p_reward and customer_id = auth.uid() and status = 'disponible'
  returning code into v_code;
  if v_code is null then
    raise exception 'reward_not_shareable' using errcode = 'P0001';
  end if;
  return v_code;
end;
$$;

-- Valider une récompense au comptoir : disponible OU partagée (celui qui la présente a le code).
create or replace function public.redeem_reward(p_code text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_label text;
  v_rank integer;
begin
  update public.loyalty_rewards r
     set status = 'utilisee', used_at = now()
    from public.shops s
   where r.code = upper(btrim(coalesce(p_code, '')))
     and s.id = r.shop_id and s.owner_id = auth.uid()
     and r.status in ('disponible', 'partagee')
  returning r.label, r.rank into v_label, v_rank;
  if v_label is null then
    raise exception 'reward_refused' using errcode = 'P0001';
  end if;
  return jsonb_build_object('label', v_label, 'rank', v_rank);
end;
$$;

revoke execute on function public.share_reward(uuid) from public, anon;
grant execute on function public.share_reward(uuid) to authenticated;
revoke execute on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;
