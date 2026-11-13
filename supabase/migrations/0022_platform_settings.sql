-- 0022_platform_settings — les réglages de la plateforme, enfin réglables depuis le back-office.
--
-- CDC §12.3 : « ce que le Super Admin doit pouvoir régler sans qu'on touche au code ». Le serveur
-- tient ses réglages dans `private.platform_config` (commission, crédit de parrainage, durée et
-- nombre de réservations, visuels IA par jour), mais l'onglet Réglages de `/admin` n'écrivait que
-- dans le navigateur : changer la commission là ne changeait AUCUNE vraie commande.
--
--   1. LE BACK-OFFICE LIT ET ÉCRIT (clé de service seule) : `admin_platform_settings`,
--      `admin_set_platform_setting` — une clé connue, un entier, dans des bornes sûres.
--   2. L'APP LIT ce qu'elle affiche (`platform_public_settings`) : la commission et le crédit de
--      parrainage — pour que le panier estime la même chose que ce que le serveur calculera.

create or replace function public.admin_platform_settings()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) from private.platform_config c
$$;

-- Les réglages modifiables, et leurs bornes : rien d'absurde ne passe (une commission de 300 %, une
-- réservation de zéro minute…).
create or replace function public.admin_set_platform_setting(p_key text, p_value numeric)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_min numeric;
  v_max numeric;
begin
  select b.lo, b.hi into v_min, v_max
    from (values
      ('commission_bps', 0, 3000),          -- 0 à 30 %
      ('referral_credit_cents', 0, 10000),  -- 0 à 100 €
      ('reservation_minutes', 5, 60),
      ('max_pending_orders', 1, 10),
      ('ai_images_per_day', 0, 100),
      ('ai_videos_per_day', 0, 20)
    ) as b(key, lo, hi)
   where b.key = p_key;
  if v_min is null then
    raise exception 'unknown_setting' using errcode = '22023';
  end if;
  if p_value is null or p_value <> trunc(p_value) or p_value < v_min or p_value > v_max then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  insert into private.platform_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;

-- Ce que l'app affiche ; rien de sensible (la commission est écrite dans les CGU).
create or replace function public.platform_public_settings()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select jsonb_build_object(
    'commission_bps', private.config('commission_bps'),
    'referral_credit_cents', coalesce(private.config('referral_credit_cents'), 0)
  )
$$;

revoke execute on function public.admin_platform_settings() from public, anon, authenticated;
revoke execute on function public.admin_set_platform_setting(text, numeric)
  from public, anon, authenticated;
grant execute on function public.admin_platform_settings() to service_role;
grant execute on function public.admin_set_platform_setting(text, numeric) to service_role;
revoke execute on function public.platform_public_settings() from public;
grant execute on function public.platform_public_settings() to anon, authenticated;
