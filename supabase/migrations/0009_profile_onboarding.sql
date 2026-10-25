-- 0009_profile_onboarding — le COMPTE retient que l'accueil est fait, et les centres d'intérêt.
--
-- Jusqu'ici, « accueil terminé » (centres d'intérêt, dossier pro, dossier livreur) ne vivait que sur
-- l'appareil. Or la déconnexion remet l'appareil à zéro (la personne suivante ne doit rien hériter),
-- et un nouveau téléphone part de rien : une personne déjà inscrite repassait par les centres
-- d'intérêt à chaque connexion. Le profil s'en souvient désormais ; l'app le relit à la connexion
-- (`syncProfile`) et entre directement.
--
-- Ce sont des PRÉFÉRENCES de la personne, pas des droits : elle peut les écrire elle-même (privilège
-- par colonne, comme son nom). Le type de compte et le numéro restent tenus par le serveur (0007).

alter table public.profiles
  add column onboarded_at timestamptz,
  -- Les catégories du catalogue (identifiants courts : « restauration », « high-tech »…). Bornées :
  -- une liste courte d'identifiants, pas un champ de texte libre.
  add column interests text[] not null default '{}'
    check (
      cardinality(interests) <= 20
      and array_to_string(interests, ',') ~ '^[a-z0-9-]{0,40}(,[a-z0-9-]{1,40})*$'
    );

grant update (interests, onboarded_at) on public.profiles to authenticated;
