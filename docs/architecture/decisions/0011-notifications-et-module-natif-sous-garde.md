# ADR-0011 — Notifications Expo, module natif chargé sous garde

- **Status:** accepted
- **Date:** 2026-11-13
- **Deciders:** opérateur + agent

## Context

Le rapport d’avancement remis au client le 13/11/2026 annonce des notifications : nouvelle commande
pour le commerçant, avancée d’une commande pour le client, réponse du support. Il faut un module
natif (`expo-notifications`, avec `expo-device`), donc une nouvelle APK. Or l’APK déjà installée chez
les testeurs doit recevoir par mise à jour OTA le paiement, les commandes et le support, et
`runtimeVersion` suit la version de l’app (`policy: 'appVersion'`) : le nouveau code JavaScript
arrivera sur une APK qui n’a PAS le module.

## Decision

- Notifications par le service Expo (`exp.host`), sans clé dans l’app : le serveur envoie
  (fonction Edge `push-events`, Database Webhooks), le téléphone enregistre son jeton par fonction
  (`register_push_token`, migration 0016) et le retire AVANT la déconnexion.
- `expo-notifications` et `expo-device` ne sont **jamais importés en tête de fichier** : ils se
  chargent par un `require` gardé dans `src/features/notifications/lib/push.ts`. Absents (ancienne
  APK, web), les notifications se taisent ; l’app ne plante pas.
- La charge d’une notification ne contient qu’un genre et un identifiant (`{ kind, id }`), validés
  avant toute navigation : ni montant, ni donnée personnelle.
- Android : `google-services.json` (projet Firebase de l’app) fourni à EAS par la variable de fichier
  `GOOGLE_SERVICES_JSON`, jamais dans le dépôt.

## Consequences

- Positive : un seul code JavaScript pour l’ancienne et la nouvelle APK ; le paiement part en OTA
  dès maintenant, les notifications marchent dès la prochaine APK.
- Negative / accepted trade-offs : un module natif ajouté SANS monter la version — contraire à la
  règle notée dans `app.config.ts`, et acceptable seulement parce que le code le charge sous garde.
  Tout autre module natif devra suivre la règle (monter `version`), ou ce même schéma.
- Enforcement : `notifications/__tests__/legacy-apk.test.ts` simule l’absence du module ;
  `routeForPush` refuse une charge inattendue (test).

## Alternatives considered

- Monter la version maintenant — l’APK actuelle ne recevrait plus rien par OTA (ni paiement ni
  commandes) jusqu’à la nouvelle APK, soumise au quota EAS mensuel.
- Notifications par FCM/APNs en direct — des clés côté serveur à gérer en plus, sans gain pour un
  pilote.
