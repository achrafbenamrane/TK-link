# Mettre le site en ligne (Vercel)

Le site vit dans `landing/`, à l'intérieur du dépôt de l'application mobile. Ce
n'est pas un détail : Vercel doit être pointé sur ce sous-dossier, sinon il
tente de construire l'app Expo et échoue.

## 1. Le mot de passe du back-office — à faire AVANT le premier déploiement

`/pro` et `/admin` affichent des inscrits, des SIRET, des commandes et des
revenus. Les chiffres sont simulés, mais les écrans ont l'air vrais : en ligne
sans serrure, ils passent pour un back-office ouvert.

Dans le tableau de bord Vercel → **Settings → Environment Variables** :

| Nom                   | Valeur                              | Environnements      |
| --------------------- | ----------------------------------- | ------------------- |
| `TKLINK_PRO_PASSWORD` | un mot de passe que vous choisissez | Production, Preview |

Le middleware (`middleware.js`) exige alors une authentification HTTP Basic sur
ces deux chemins — n'importe quel identifiant, ce mot de passe. **Variable
absente = aucune protection**, ce qui est voulu en développement local mais
jamais en ligne.

## 2. Déployer — et NE PAS écraser un autre projet

> ⚠️ **Le piège, rencontré le 11/08/2026.** Ce dossier s'appelle `landing`.
> `vercel link` propose par défaut le projet Vercel **portant le même nom**, et
> le compte en contenait déjà un — celui d'un autre produit, avec son propre
> domaine attaché. Accepter la proposition déploie TK LINK **par-dessus l'autre
> site**. Toujours nommer le projet explicitement.

Une procédure écrite ne suffit pas : elle se contourne en recopiant une vieille
commande depuis un terminal — c'est exactement ce qui s'est passé. **Passez donc
par les scripts npm, qui refusent de démarrer si le lien est mauvais.**

```bash
cd landing
npx vercel login                           # une seule fois
npx vercel link --project tklink-landing   # NOM EXPLICITE — jamais la proposition par défaut
npm run deploy:preview                     # prévisualisation, URL jetable
npm run deploy                             # production
```

`npm run deploy` commence par `scripts/guard-project.mjs`, qui lit
`.vercel/project.json` et **arrête tout** si le projet lié n'est pas
`tklink-landing` — en nommant le site qui serait écrasé. `npx vercel --prod`
en direct court-circuite ce garde-fou : ne l'utilisez pas.

Alternative sans CLI : importer le dépôt GitHub depuis vercel.com, **créer un
nouveau projet** (ne pas en réutiliser un existant) et régler **Root Directory
= `landing`**. Chaque `git push` déclenche alors un déploiement.

### Si le mauvais projet a été écrasé

Rien n'est perdu : Vercel garde l'historique des déploiements.

1. Dashboard → le projet concerné → **Deployments** → retrouver le dernier
   déploiement d'AVANT l'erreur → menu `…` → **Instant Rollback**.
2. Supprimer le lien local fautif : `rm -rf landing/.vercel`, puis refaire le
   `vercel link --project` ci-dessus avec le bon nom.
3. Vérifier que le domaine de l'autre projet lui est bien resté :
   `npx vercel domains inspect <domaine>`.

## 3. Vérifier après mise en ligne

- La vitrine `/` s'affiche et la scène du lecteur s'anime.
- `/pro` et `/admin` demandent le mot de passe.
- Les deux répondent `X-Robots-Tag: noindex` (`curl -I`).

## Ce qui n'est PAS déployé

L'application mobile. Elle passe par EAS Build et les stores — voir
[`docs/runbooks/release.md`](../docs/runbooks/release.md). Le site et l'app ne
partagent aujourd'hui aucune donnée : les deux tournent sur des jeux de
démonstration en attendant Supabase.
