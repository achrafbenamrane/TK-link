# Exec Plan — Livrer ce qu’annonce le rapport d’avancement

- **Date :** 2026-11-13
- **Auteur :** agent + opérateur
- **Intention :** le chef de projet a remis au client un « Rapport d’avancement – Application
  mobile » (WhatsApp, 13/11/2026) qui annonce onze chantiers ; il faut que l’app les tienne, au plus
  vite. Décision du même jour : **Uber Direct remplace les livreurs TK LINK**.
- **Statut :** en cours

## Objectif et non-objectifs

Fini quand chaque ligne du rapport est vraie dans l’app, prouvée par un test et observée à l’écran.
Non-objectifs : immatriculation de la société et activation commerciale d’Uber Direct
(administratif, côté client) ; modèle économique de l’IA (le rapport le reporte).

## Décisions (13/11/2026, opérateur)

- **Paiement : Stripe Connect** (CDC V1.1 §2) — le client paie dans l’app, le commerçant reçoit le
  prix moins la commission (5 %, réglable), TK LINK la commission. Mode test tant que la société
  n’est pas immatriculée.
- **IA : fal.ai**, appelé par le serveur seulement (clé en secret Supabase) — images et vidéos.
- **Livreurs : retirés.** La livraison est commandée à Uber Direct par le serveur et suivie dans la
  commande ; le code livreur reste dans l’historique git.
- **Messagerie : support TK LINK.** Clients et commerçants écrivent à TK LINK ; chaque demande est
  un ticket suivi et répondu depuis le back-office.
- Les deux modules natifs nouveaux (Stripe, notifications) partent dans **une seule** APK.

## Déjà existant — réutiliser

- Compte à rebours : `src/features/shop/ui/components/countdown.tsx`
- Programmation : `src/features/merchant/ui/publish-form.tsx`, `merchant/lib/schedule.ts`
- Panier et commande locale : `shop/ui/cart-screen.tsx`, `shop/model/store.ts`, `lib/order-status.ts`
- Marché sur Supabase : [2026-11-11-marche-sur-supabase.md](2026-11-11-marche-sur-supabase.md)
  (étape 3 « la commande » = le socle du paiement)
- Messagerie locale : `src/features/messages/`, routes `(tabs)/messages`, `conversation/[id]`
- Packs : `packs/push-notifications`, `packs/chat-realtime`, `packs/media-upload`
- Back-office : `landing/app/admin/` (Vercel, mot de passe)

## Étapes

### 1 — Expérience utilisateur (sans dépendance externe)

- [ ] Compte à rebours au centième de seconde, calculé sur le fil d’interface (Reanimated), arrêté
      à zéro pour une vraie Flash, sans centièmes si « réduire les animations »
- [ ] Bloc du commerçant = un seul chemin vers sa boutique (carte Flash, fiche produit, carte)
- [ ] Programmation d’une Flash simplifiée côté commerçant

### 2 — Uber Direct à la place des livreurs

- [ ] Retrait du rôle livreur (inscription, onglets, écrans, store)
- [ ] Edge Functions : devis, création, annulation, suivi (webhook) ; secrets Uber côté serveur
- [ ] La commande en livraison affiche le statut et le lien de suivi Uber

### 3 — La commande et le paiement (Stripe Connect)

- [ ] `flash_orders` + `reserve_flash()` atomique (étape 3 du plan du marché)
- [ ] Compte Stripe Connect du commerçant (lien d’inscription), PaymentSheet dans le panier,
      commission en `application_fee`, webhook qui passe la commande à « payée »
- [ ] Onglet Versements lu depuis Stripe

### 4 — Notifications

- [ ] Jetons push enregistrés au serveur ; envoi sur les changements de statut de commande et les
      nouvelles commandes du commerçant

### 5 — Messagerie support et tickets

- [ ] Tables `support_tickets` / `support_messages` ; écran « Aide » dans l’app ; boîte de
      réception et réponses dans `/admin`

### 6 — Contenu IA de la boutique

- [ ] Edge Function fal.ai : image ou vidéo de présentation à partir du nom, de la catégorie et
      d’une photo ; rangée dans Storage, affichée sur la vitrine

## Risques

- Disque presque plein sur ce poste (cf. mémoire) : vérifier `df -h` avant export ou build.
- Stripe et notifications exigent une nouvelle APK (quota EAS gratuit mensuel).
- Uber Direct et fal.ai : rien ne s’éprouve sans les clés ; le code est testé sur des réponses
  enregistrées de la documentation, l’essai réel attend les comptes.
