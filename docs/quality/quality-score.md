# Quality Score — living code-health notes

Agents and humans append observations here whenever work surfaces debt,
landmines or drift. The weekly platform review triages entries into issues
or deletes stale ones. Newest first; keep entries one line each:
`YYYY-MM-DD · area · note · (who)`.

## Current assessment

- 2026-07-21 · shop · Fixed a Profil crash: `useShopStore(selectUnusedVouchers)`
  subscribed to a filtering selector (new array each call) → Zustand v5
  infinite loop. Swept all subscriptions; the twin site was the cart route.
  Guarded with a ProfileScreen render test. · (opus)
- 2026-06-06 · overall · Fresh skeleton: verify suite green, boundaries
  enforced, reference feature complete. Debt: none known yet. · (bootstrap)

## Known landmines

- `src/app/` must contain zero test files — the router scans it (Jest is
  configured around this; don't fight it).
- `package-lock.json` conflicts: take main's, re-run `npm install` (see
  git-workflow doc) — never hand-merge.
- NativeWind v5 is pre-release; don't bump Tailwind to v4 until the migration
  ADR exists.
- Reanimated/worklets babel wiring is automatic via `babel-preset-expo` —
  adding the old manual plugin breaks builds.
- Zustand v5 has no built-in `equalityFn`: a selector you subscribe to
  (`useStore(select…)`) MUST return a stable reference or a primitive.
  `s.items.filter(…)`/`.map(…)` returns a fresh array each render → infinite
  loop → crash. Subscribe to the raw slice and derive with `useMemo`, or wrap
  with `useShallow`. Selectors returning `.length`/`.reduce` (a number) are safe.

- Après `npx expo install` d'un module natif (expo-camera, expo-video…), le serveur Metro
  garde son ancien cache : « Unable to resolve … » alors que le fichier existe. Relancer
  `npx expo start --clear`. Le même module exige un nouveau build natif (EAS) : un APK
  construit avant l'installation n'a pas le module.
- Le navigateur n'a ni empreinte, ni caméra, ni Mapbox : la biométrie rend « indisponible »
  (le démo propose un contournement), `QrScanner` affiche son repli et `RouteMap` son dessin.
  Ce qui s'y voit n'est pas la preuve que le téléphone fonctionne.
- `assets/videos/*.mp4` sont des diaporamas de démonstration (`scripts/make-demo-videos.mjs`),
  dont l'un tiré de photos non libres : à retirer avant toute publication (voir CREDITS.md).

## Dette connue (revue du 05/10/2026) — à régler avec le serveur ou avant publication

- ~~**Codes de remise dérivés de l'identifiant de commande**~~ et ~~**pièces d'identité et selfie du
  livreur**~~ : sans objet depuis le retrait du livreur (13/11/2026, Uber Direct). `handover.ts` et le
  magasin du livreur ont été supprimés ; l'ancien magasin `tklink-courier-v1` est effacé des
  téléphones au démarrage (`shared/lib/retired-stores.ts`). L'IBAN des pros, lui, est dans le coffre
  sécurisé (seul un repère masqué reste dans l'état).
- **Récompense partagée** (`shareReward`) : elle quitte l'inventaire du donneur, mais il n'existe pas
  encore de chemin pour la récupérer chez le destinataire (il faut un compte et un serveur).
- **Démonstration** : réglée. `isDemoBuild` (`src/shared/lib/env.ts`, faux seulement quand
  `EXPO_PUBLIC_APP_ENV=production`, posé par le profil EAS) commande, depuis les routes, le bouton « Démo »,
  l'inscription pré-remplie, l'IBAN d'exemple, la vitrine d'exemple et les boutons
  « simuler la validation ». Vérifié : un Metro lancé en production n'en montre aucun.

## Authentification (24/10/2026)

E-mail ou téléphone + mot de passe, codes à 6 chiffres, Google et Apple natifs : livrés et testés côté
client (faux client Supabase), SQL vérifié par l’analyseur PostgreSQL. **Jamais exécutés contre un
vrai projet** : connecteur Supabase non branché, ni Docker ni CLI Supabase sur la machine. Avant de
déclarer l’authentification terminée : `npm run auth:check` sur le projet réel, `supabase test db`
(pgTAP), puis CUJ-007 sur téléphone. Restent à faire avant la publication iOS : la révocation du jeton
Apple à la suppression du compte (clé `.p8` côté serveur). Guide : [authentification](../security/authentication.md).

**Mise à jour (ADR-0010) :** compte obligatoire, numéro associé SANS SMS (fonction Edge `link-phone`),
e-mails par Resend, Apple sur Android par sa page web. Landmines connues :

- **Le domaine `tklink.fr` n’est pas enregistré** : Resend ne peut rien envoyer tant qu’un domaine à
  soi n’est pas vérifié — bloquant pour toute inscription réelle par e-mail.
- **Un numéro associé n’est pas prouvé** (squat possible, borné : un numéro par compte, cinq
  numéros essayés par jour). Prelude le vérifiera ; `phone_verified` reste faux d’ici là.
- **Le secret Apple expire tous les 180 jours** (`npm run apple:secret`) : sans rappel, Apple tombe
  sur Android sans prévenir.
- **Ne pas pousser `[auth]` avec `supabase config push`** : la CLI inverse la confirmation des SMS et
  coupe la connexion par numéro. Tout se règle dans le tableau de bord.
- **Les trois variantes partagent le schéma `tklink`** : avec plusieurs installées, le retour d’Apple
  peut ouvrir la mauvaise (l’échange échoue alors sans risque). Un schéma par variante : plus tard.
- **Flows Maestro** : `smoke.yaml` est réécrit pour le compte obligatoire (non exécuté : pas de
  simulateur sur cette machine) ; `commercant-cuj.yaml` était déjà périmé (lien `tklink://commercant`
  hors liste, formulaire jamais validé) — à réécrire depuis le choix du profil.
- **Les données locales appartiennent à un compte** (`ownerId` du profil local, `AccountSync`) :
  un AUTRE compte qui se connecte remet tout à zéro. Exception assumée : pendant une inscription, rien
  n’est effacé (ce qui vient d’être saisi est celui du nouveau compte).
- **Énumération sans compte** : `signUp({ phone })` répond autrement pour un numéro associé et pour
  un numéro libre — bornée par les limites d’Auth par IP seulement. Prelude ou un CAPTCHA d’Auth.
- **Lancement hors ligne, jeton expiré** : l’app montre la connexion (supabase-js rend une session
  vide) ; elle entre seule dès que le jeton est renouvelé. La déconnexion hors ligne efface la session
  locale elle-même (supabase-js ne le fait pas dans ce cas) et n’attend pas plus de 5 s.

## Livreur retiré (13/11/2026)

Les livraisons sont confiées à **Uber Direct** : le rôle livreur, ses écrans, ses missions, FranceConnect
(qui ne servait qu'à lui), le scan QR (`expo-camera`) et la carte d'itinéraire ont été supprimés de l'app.
Un `role: 'livreur'` relu du disque ou du serveur devient client (`RoleSchema`, testé). Depuis : le
back-office n'a plus de livreurs d'exemple ; la messagerie locale (`features/messages`) est
remplacée par le support TK LINK sur le serveur (`features/support`, « Profil → Aide et support »),
et son ancien magasin local est effacé au démarrage. Reste : `expo-camera` (dépendance et plugin)
n'est plus utilisé et peut partir à la prochaine APK.

## Réglages de démonstration

Trois valeurs que le CDC ne chiffre pas ont été **arrêtées le 24/10/2026** (Farid a laissé le
développeur trancher) : frais de livraison du client 3,00 €, zone de base de la livraison 3 km ; la
réservation du panier est de 10 min. (Le seuil du colis « important », 100 €, est parti avec le
livreur le 13/11/2026.) Ce sont des **défauts**, dans
`PLATFORM_SETTINGS` : le Super Admin les change depuis Réglages (web). L'écran de démonstration
(`src/features/demo`, `src/shared/lib/platform-overrides.ts`) permet d'essayer d'autres montants sur un
appareil, dans les builds de démonstration seulement ; une build de production ignore tout ajustement.

Le client paie 3,00 € puis 0,80 €/km au-delà de 3 km (`shop/lib/delivery.ts`), en attendant le devis
Uber Direct. Limite connue : la distance n'est connue que pour « Ma position actuelle »
(les adresses du carnet n'ont pas de coordonnées) ; elle est mesurée en ligne droite, donc plus courte
que le trajet réel. Pour une adresse du carnet, le forfait seul s'applique. Le jour où
les adresses sont géocodées, la majoration s'appliquera sans autre changement.

Les modales sortent de la racine du thème **sur le web** (les variables CSS ne les atteignent pas) :
tout contenu de `Modal` s'enveloppe dans `ThemeScope` (fait pour la galerie et l'éditeur d'avatar).
Sur téléphone ce n'est pas nécessaire, mais c'est ce qui rend l'aperçu web fidèle.

## Wishlist (pull when convenient)

- FlashList adoption for long lists (when a real long list exists).
- TanStack Query ADR when the first API lands.
- Dark mode token pass.
