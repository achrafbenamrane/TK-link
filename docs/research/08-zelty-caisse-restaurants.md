---
id: research-zelty
read-when: Vous évaluez, chiffrez ou implémentez le raccordement de TK LINK à une caisse de restaurant (ZELTY ou une autre), ou le routage POS/KDS du CDC §6.4.
owns: L'étude de pertinence et de faisabilité ZELTY demandée le 18/08/2026.
---

# ZELTY — pertinence et faisabilité

> **D'où vient la demande.** Conduite de projet, 18/08/2026 : « Le client voudrait intégrer un outil
> de facturation pour les restaurateurs, ça s'appelle Zelty apparemment. Check le cahier des
> charges, fais une étude voir si c'est 1) pertinent 2) réalisable. »
>
> Le [CDC V1.0](../architecture/exec-plans/2026-08-16-cdc-v1.md) mentionne « la qualification
> ZELTY » parmi les points **volontairement laissés ouverts** (§14). Cette étude est donc l'apport
> qui manquait au dossier, pas une décision prise à la place du client.

## Rectification préalable : ZELTY n'est pas un outil de facturation

C'est un **logiciel de caisse** (POS) pour la restauration — service à table, restauration rapide,
franchises et chaînes — avec plan de salle, écran cuisine, gestion clients, livraison, réservations
et commande en ligne. La facturation n'en est qu'une conséquence.

La nuance change tout le raisonnement. TK LINK **produit déjà ses propres documents** : le §9.1 du
CDC définit quatre types distincts (préparation, ticket, facture, garantie), et ils sont
implémentés. Brancher ZELTY n'ajouterait donc pas une facturation manquante — **ce n'est pas le
problème à résoudre.**

## 1 — Pertinence

### Le vrai problème, c'est la double caisse

Sans raccordement, une vente flash payée dans TK LINK **n'existe pas dans la caisse du
restaurant**. Conséquences concrètes, dans cet ordre de gravité :

1. **La cuisine ne voit rien.** Le ticket de préparation du §6.3 s'imprime… ailleurs. Le personnel
   doit surveiller un second écran pendant un service.
2. **La clôture de caisse est fausse.** Le Z de fin de journée ne comptabilise pas les ventes TK
   LINK. Le restaurateur fait la ressaisie à la main, ou son chiffre d'affaires est faux.
3. **Le stock diverge.** Les mêmes croissants sont vendus deux fois, par deux systèmes qui
   s'ignorent.

C'est exactement ce que décrit le **§6.4 (routage POS / KDS / impression)**. **ZELTY n'est donc pas
un ajout de périmètre : c'est une implémentation possible d'une exigence qui existe déjà.**

### Pertinence : ÉLEVÉE, mais partielle

| Pour qui                       | Pertinence | Pourquoi                                                                  |
| ------------------------------ | ---------- | ------------------------------------------------------------------------- |
| Restaurateurs équipés ZELTY    | **Forte**  | Supprime la double saisie et la double caisse                             |
| Restaurateurs équipés d'autres | Nulle      | ZELTY n'est qu'un acteur parmi d'autres                                   |
| Les 7 autres catégories        | Nulle      | High-tech, mode, maison, beauté, sport, auto, services n'utilisent pas ça |

Le catalogue TK LINK couvre **huit** catégories ; la restauration en est une. Un raccordement ZELTY
sert donc une fraction des commerçants — réelle et stratégique, mais une fraction. **À ne jamais
laisser devenir un préalable pour les autres.**

### Le risque à porter au client : qui est la caisse de référence ?

ZELTY se conforme à la **loi anti-fraude TVA** française. C'est précisément ce qui pose la question
que personne n'a encore posée :

> Quand un client paie une vente flash dans TK LINK, **quel système est le système de caisse au sens
> de la loi** ? TK LINK, qui encaisse et émet le ticket ? Ou ZELTY, qui tient la caisse certifiée du
> restaurant ?

Ce n'est pas une question d'API, c'est une question de conformité et de responsabilité. Elle
conditionne l'architecture entière et **doit être tranchée avant d'écrire une ligne de code**. Elle
rejoint le §9.7 (« e-invoicing ready ») et les échéances 2026/2027 que le client a lui-même
vérifiées.

## 2 — Faisabilité

### Ce qui est acquis

- **ZELTY expose une API ouverte** et revendique plus de 85 intégrations, avec une place de marché
  d'une cinquantaine d'outils partenaires activables.
- Les intégrations existantes échangent **commandes, statuts de commande, informations client et
  catalogue** — soit exactement les objets dont TK LINK a besoin.
- Le catalogue circule **de ZELTY vers l'extérieur** : la carte du restaurant peut alimenter les
  offres, sans double saisie du commerçant.

### Ce qui bloque, par ordre

| Blocage                                                       | Nature     | Levée                                                                                     |
| ------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| **Aucun back-end TK LINK**                                    | Structurel | Le §12.2 rend le serveur autoritaire. Une app mobile ne s'appaire pas seule à une caisse. |
| **Accès à l'API ZELTY**                                       | Commercial | À confirmer auprès de ZELTY : contrat, partenariat, coût, quotas                          |
| **Le stock ne se synchronise pas** dans l'intégration de base | Technique  | L'offre « Bridge » de ZELTY couvre le bidirectionnel et l'inventaire — à qualifier        |
| **Un restaurant pilote**                                      | Terrain    | Rien ne se valide sans une vraie caisse, en vrai service                                  |

Le troisième point mérite une insistance particulière : **le §4.3 du CDC exige un stock à quatre
compartiments** (total, disponible, réservé, vendu) et le §4.4 une réservation au panier. Si
l'intégration retenue ne synchronise pas les stocks, ZELTY **ne résout pas** le problème de la
survente — il ne résout que la double saisie comptable. C'est une différence majeure de valeur, et
elle décide de l'offre à souscrire.

### Verdict

**Réalisable — mais pas maintenant, et pas en premier.**

Ordre imposé par les dépendances, pas par les préférences :

1. le back-end (§12.2) — sans lui, rien de ce qui suit n'existe ;
2. l'arbitrage juridique sur la caisse de référence ;
3. la qualification commerciale ZELTY (accès, offre, coût) ;
4. un connecteur, derrière une **abstraction** — jamais un couplage direct.

Ce dernier point est une décision d'architecture à prendre dès maintenant, même sans écrire le
connecteur : le §6.4 parle de « routage POS », **pas de ZELTY**. Le jour où un restaurateur arrive
avec une autre caisse — et il arrivera — l'interface doit déjà exister.

## Ce qu'il faut demander au client

1. **Combien** de restaurateurs pressentis sont équipés ZELTY ? Un raccordement pour deux commerces
   ne se finance pas.
2. **Qui est la caisse de référence** au sens de la loi anti-fraude ? Réponse attendue de son
   expert-comptable, pas de nous.
3. **Quelle offre ZELTY** est visée — l'intégration de base, ou celle qui synchronise les stocks ?
   Le prix et la valeur ne sont pas les mêmes.
4. **A-t-il un contact chez ZELTY ?** Un partenariat existant raccourcit de plusieurs semaines la
   qualification commerciale.

## Ce que cette étude ne dit pas

Le §14 du CDC interdit d'inventer un paramètre que le client a laissé ouvert. **Aucun coût, aucun
délai et aucune offre ZELTY ne sont chiffrés ici** : ces valeurs demandent un échange avec ZELTY
qui n'a pas eu lieu. Les capacités décrites viennent de la documentation publique d'une intégration
tierce, pas d'un accès à la documentation développeur.

## Sources

- [Zelty — présentation générale (HubRise)](https://www.hubrise.com/fr/apps/zelty) — périmètre
  fonctionnel, données échangées, conformité anti-fraude, limites de l'intégration de base
- [Zelty — solution de caisse et intégrations API](https://blog.zelty.fr/solution-caisse-complete-integrations-api)
- [Zelty — commandes et encaissements pour la restauration](https://www.zelty.fr/en)
- [Zelty — digitalisation et click & collect](https://www.zelty.fr/en/besoins/zelty-digitalisation-restaurant)
