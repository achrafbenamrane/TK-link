---
read-when: 'Touching La Chasse, XP, badges, streaks, the daily chest or the neighbourhood board'
owns: 'Les règles de la gamification : ce que chaque élément fait, d’où il vient, ce qui est encore simulé'
---

# La gamification — « La Chasse »

> **D’où ça vient.** Ce document répond à une question posée en revue le
> 11/08/2026 : « ces trophées, c’était dans un doc ou tu as improvisé ? »
> Réponse honnête : **ni le cahier des charges ni une maquette ne les
> décrivent**. Ils viennent d’une consigne produit — « un hub d’offres et de
> liquidation avec beaucoup de gamification » — dont le contenu a été décidé
> pendant l’implémentation. Ce fichier existe pour que plus personne n’ait à
> poser la question, et pour que Farid puisse arbitrer sur du concret.

## Pourquoi une couche de jeu

Un déstockage n’a d’intérêt que si l’on **revient**. Une offre qui expire dans
vingt minutes ne vaut rien pour quelqu’un qui ouvre l’app une fois par mois.
Tout ce qui suit sert un seul objectif : donner une raison d’ouvrir l’app un
mardi soir sans y être poussé par une notification.

C’est aussi ce qui sépare TK LINK d’un catalogue de promotions — la différence
que le client résume par « le cœur de l’appli, c’est les offres flash ».

## Ce qui existe, et sur quoi c’est fondé

| Élément                    | Origine                   | Règle                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offres membres**         | CDC (menu de la vidéo)    | Les offres réservées aux porteurs de la carte : `PROMO`, `CATALOGUE`. Antérieures au hub.                                                                                                                                                           |
| **Rang et XP**             | Décision d’implémentation | 6 rangs, de « Curieux » à « Légende locale ». Attraper un flash vaut 40 XP, gagner un jeu 25, ouvrir l’app 10.                                                                                                                                      |
| **Série (streak)**         | Décision d’implémentation | Jours civils consécutifs. Une coupure repart à 1, **jamais à 0** — revenir après une absence ne se punit pas deux fois.                                                                                                                             |
| **Missions du jour**       | Décision d’implémentation | Trois missions tirées **de façon déterministe à partir de la date** : tout le monde a les mêmes, elles ne changent pas si l’on rouvre l’app.                                                                                                        |
| **Coffre du jour**         | Décision d’implémentation | Un tirage par jour civil (bronze 60 %, argent 30 %, or 10 %) : XP + points + un coupon. Le **store** tient la disponibilité, pas l’écran — une garde d’interface se contournerait en changeant d’onglet.                                            |
| **Trophées**               | Décision d’implémentation | Sept badges **dérivés** de l’état existant (XP, série, compteurs du jour). Aucune donnée conservée en plus, donc rien qui puisse se désynchroniser. Les verrouillés affichent leur condition — c’est l’objectif, pas la médaille, qui fait revenir. |
| **Classement du quartier** | Décision d’implémentation | ⚠️ **Données simulées** — voir ci-dessous.                                                                                                                                                                                                          |

## Ce qui n’est pas encore vrai

**Le classement du quartier affiche de faux voisins.** Ils sont fabriqués sur
le téléphone, ancrés sur l’XP du joueur pour qu’il y ait toujours quelqu’un
juste devant (une cible) et, dès les premiers points, quelqu’un derrière. Le
plafond à 3 000 XP garantit que la première place reste atteignable.

C’est assumé et marqué comme tel dans le code
([`leaderboard.ts`](../../src/features/gamification/lib/leaderboard.ts)), et
l’écran le dit à l’utilisateur. **À ne pas présenter comme un usage réel** : la
plateforme n’a pas encore d’utilisateurs, et le classement deviendra vrai le
jour du back-end — seule la source change, pas l’écran.

Même remarque pour les **packs d’opérations** du commerçant : ils se créditent
sans paiement, en attendant la facturation réelle.

## Les valeurs, et qui les tranche

Rien de ce qui précède n’est dans le CDC : **tout est arbitrable**. Les
barèmes vivent chacun dans un seul fichier, de sorte qu’un changement de règle
ne se propage pas dans les écrans :

- XP par action et paliers de rang → `gamification/lib/progression.ts`
- Paliers et probabilités du coffre → `gamification/lib/chest.ts`
- Conditions des trophées → `gamification/lib/badges.ts`
- Voisins et plafond du classement → `gamification/lib/leaderboard.ts`

Le CDC §13 fixe en revanche le **programme de fidélité** (points par achat,
paliers, cadeaux) : c’est un système distinct, contractuel, à ne pas confondre
avec l’XP. Les points s’échangent contre des avantages réels ; l’XP ne sert
qu’à la progression.

## Questions ouvertes pour le client

1. **Le principe même de la gamification est-il validé ?** Il a été construit
   sur une consigne orale, pas sur un document.
2. **Les barèmes** (XP par action, contenu du coffre, conditions des trophées)
   demandent un accord — surtout le coffre, qui distribue de vrais coupons.
3. **Le classement social** : un classement par quartier suppose d’exposer un
   pseudonyme à d’autres utilisateurs. C’est une décision produit **et** RGPD,
   à prendre avant le branchement du serveur.
