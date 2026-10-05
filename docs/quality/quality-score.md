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

## Wishlist (pull when convenient)

- FlashList adoption for long lists (when a real long list exists).
- TanStack Query ADR when the first API lands.
- Dark mode token pass.
