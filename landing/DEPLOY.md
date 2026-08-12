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

## 2. Déployer

```bash
cd landing
npx vercel login          # une seule fois
npx vercel link           # créer/associer le projet ; Root Directory = ce dossier
npx vercel                # prévisualisation, URL jetable
npx vercel --prod         # production
```

Alternative sans CLI : importer le dépôt GitHub depuis vercel.com et régler
**Root Directory = `landing`**. Chaque `git push` déclenche alors un
déploiement.

## 3. Vérifier après mise en ligne

- La vitrine `/` s'affiche et la scène du lecteur s'anime.
- `/pro` et `/admin` demandent le mot de passe.
- Les deux répondent `X-Robots-Tag: noindex` (`curl -I`).

## Ce qui n'est PAS déployé

L'application mobile. Elle passe par EAS Build et les stores — voir
[`docs/runbooks/release.md`](../docs/runbooks/release.md). Le site et l'app ne
partagent aujourd'hui aucune donnée : les deux tournent sur des jeux de
démonstration en attendant Supabase.
