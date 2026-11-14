# Exec Plan — Les commandes B2B sur le serveur

- **Date :** 2026-11-14
- **Auteur :** agent + opérateur
- **Intention :** CDC V1.1 §1 (Grossiste) et §2 (« consultation et commande des offres B2B via
  l’onglet grossiste »). Les offres pro se publient déjà sur le serveur (0011, `audience =
'commercants'`), mais aucun commerçant ne peut les commander : `reserve_flash` les refuse, et le
  marché, les achats et les ventes du grossiste restent des données de démonstration d’un seul
  téléphone.
- **Statut :** en cours

## Objectif et non-objectifs

Fini quand un commerçant validé commande et paie une offre pro réelle depuis l’onglet grossiste, et
que le grossiste la voit arriver, la prépare, l’expédie et la livre — prouvé par des tests (pgTAP,
Jest) et observé à l’écran. Non-objectifs : points B2B (CDC : CANDIDAT), délai de paiement (V1 :
paiement instantané), facture électronique du grossiste (chantier facturation), portail web
`/grossiste` (reste en démonstration).

## Règles retenues (toutes tirées du CDC, rien d’inventé)

- **Même moteur** : une commande B2B est une ligne de `flash_orders`, marquée `audience =
'commercants'` (recopiée de l’offre), payée par la même page Stripe Checkout au compte Connect du
  grossiste, commission 5 % (`commission_bps`, « TK Link facture sa commission au professionnel »).
- **Acheteur** : un compte `commercant` dont le commerce est **validé** (SIRET vérifié avant toute
  commande B2B), jamais sa propre offre. Un client ne commande pas une offre pro.
- **Minimum** par offre (`min_qty`, déjà tenu) ; jusqu’à 999 par ligne (commandes de volume) —
  le B2C reste à 99.
- **Aucune étape d’acceptation** : payée → « Commande reçue » → En préparation → Expédiée →
  Livrée (`payee` → `preparation` → `en_livraison` → `livree`), avancée par le grossiste. Retrait
  chez le grossiste : comme le B2C (`prete`, puis code de retrait).
- **Pas de parrainage ni de fidélité** sur une commande B2B (le crédit, les points et le
  déblocage du parrainage sont des règles du client final).
- **Livraison par le grossiste**, pas par Uber Direct : pas de devis, frais 0 (le CDC ne chiffre
  rien), adresse = celle du commerce acheteur. `uber-quote`, `uber-dispatch` refusent une commande
  B2B ; `stripe-payment` n’exige pas de devis pour elle.

## Déjà existant — réutiliser

- Serveur : `0011_flash_offers.sql` (offres pro, `min_qty`, lecture réservée aux pros),
  `0012_flash_orders.sql` (`advance_order`, `confirm_pickup`), `0019_referrals.sql`
  (`reserve_flash` actuel), `0017_loyalty.sql` (`credit_loyalty`), Edge `stripe-payment`,
  `uber-quote`, `uber-dispatch`
- App : `merchant/ui/wholesale-screen.tsx` (marché), `purchases-screen.tsx` (achats),
  `wholesaler-orders-screen.tsx` (ventes du grossiste), `lib/wholesale-orders.ts` (statuts, bon de
  préparation) ; `shop/lib/server-checkout.ts` (réserver → payer), routes `lots.tsx`, `achats.tsx`,
  `(tabs)/commandes.tsx`

## Phases

### Phase 1 — Le serveur (migration 0023)

- [x] `flash_orders.audience` ; `reserve_flash` accepte une offre pro pour un commerçant validé
      (pas la sienne), sans crédit de parrainage, 999 par ligne, adresse du commerce acheteur
- [x] `advance_order` : la livraison B2B avancée par le grossiste ; fidélité et parrainage
      ignorent le B2B
- [x] Edge : `stripe-payment` sans devis pour le B2B ; `uber-quote` et `uber-dispatch` le refusent
- [x] pgTAP (acheteur refusé, minimum, volume, pas de crédit, transitions, pas de points)
- [x] Relecture indépendante (14/11) : ordre des refus de 0019 rétabli, adresse B2B forcée à
      celle du commerce acheteur, plafond Stripe, notifications B2B, « déjà client » hors B2B ;
      tests 82–92 (le test 82 lisait l’offre sous les règles d’accès d’un client : corrigé)

### Phase 2 — L’app

- [ ] `merchant/lib/wholesale-api.ts` : offres pro du serveur, achats, ventes, avancer (tests)
- [ ] Marché : les offres réelles, commande → paiement (route `lots.tsx`, sans devis Uber)
- [ ] Achats du commerçant et ventes du grossiste lus au serveur ; actions du grossiste

### Phase 3 — Preuve et docs

- [ ] `npm run verify` ; écrans en démonstration à 360 px ; CUJ B2B ; `backend.md` ; auth:check

## Risques

- `reserve_flash` est la fonction la plus sensible (stock, argent) : la recréer à l’identique hors
  B2B, et rejouer tous ses tests pgTAP.
- Les déclencheurs de fidélité et de parrainage se recréent avec une condition de plus : un oubli
  créditerait des points sur un achat de gros.
- Pas de connexion aux vrais comptes depuis ce poste : l’écran serveur se prouve par Jest (serveur
  simulé) et par l’essai sur téléphone après la mise à jour OTA.
