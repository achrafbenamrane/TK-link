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

- **Codes de remise dérivés de l'identifiant de commande** (`handover.ts`) : le livreur pourrait
  recalculer le code client sans rencontrer le client. Acceptable en démonstration (documenté), pas en
  production : le serveur doit émettre et vérifier les deux codes (4 et 6 chiffres).
- **Pièces d'identité et selfie** : le magasin du livreur ne garde que des adresses de fichiers ; en
  production, ces images sont envoyées au serveur puis supprimées de l'appareil. L'IBAN, lui, est
  déjà dans le coffre sécurisé (seul un repère masqué reste dans l'état).
- **Récompense partagée** (`shareReward`) : elle quitte l'inventaire du donneur, mais il n'existe pas
  encore de chemin pour la récupérer chez le destinataire (il faut un compte et un serveur).
- **Démonstration** : réglée. `isDemoBuild` (`src/shared/lib/env.ts`, faux seulement quand
  `EXPO_PUBLIC_APP_ENV=production`, posé par le profil EAS) commande, depuis les routes, le bouton « Démo »,
  l'inscription pré-remplie, l'IBAN d'exemple, les missions et la vitrine d'exemple et les boutons
  « simuler la validation ». Vérifié : un Metro lancé en production n'en montre aucun.

## FranceConnect (identité du livreur)

Branché côté écran et données, **pas côté service** : il faut l'habilitation de l'État, un serveur OpenID
Connect et un lien de retour (détail dans `docs/product/parcours-clients.md`). Le simulateur n'existe
qu'en build de démonstration ; ailleurs l'app dit « pas encore disponible ». Les anciens comptes livreur
(avec une pièce déposée) n'ont pas d'identité FranceConnect : le compte les affiche « Non vérifiée ».

## Réglages de démonstration

Trois valeurs que le CDC ne chiffre pas (frais de livraison du client, zone de base du livreur, montant
d'un « colis important ») se règlent en direct depuis Compte, dans les builds de démonstration
(`src/features/demo`, `src/shared/lib/platform-overrides.ts`). Ce n'est pas une décision : sans
valeur, l'app garde son comportement prudent (livraison offerte, gain « dès 3,00 € », empreinte exigée
pour tous les colis). Quand le client tranche, la valeur va dans `PLATFORM_SETTINGS` et l'écran peut
disparaître. Une build de production ignore tout ajustement.

## Wishlist (pull when convenient)

- FlashList adoption for long lists (when a real long list exists).
- TanStack Query ADR when the first API lands.
- Dark mode token pass.
