# Design System

La charte vient du **client** (maquettes du 03/10/2026, voir
[les maquettes](../design/maquettes/README.md)) : rose `#FF1478` pour l’énergie (Flash, prix,
appels à l’action), bleu `#00B2FF` pour l’appui (localisation, infos), vert `#22C55E` pour ce qui
est validé, blanc et gris foncé `#1B1B1F`. Elle existe en **mode Nuit et mode Jour**, avec une
bascule visible.

## Une seule source

**`src/shared/theme/palette.json`** porte les valeurs, en Jour et en Nuit. Personne ne les recopie :

- `tailwind.config.js` n’y déclare que des **rôles** (`bg-brand-500`, `text-ink`, `bg-surface-muted`…),
  adossés à des variables CSS : `rgb(var(--c-brand500) / <alpha-value>)`. Les opacités (`bg-ink/10`)
  continuent donc de fonctionner.
- Le `ThemeProvider` (`src/shared/theme/theme-provider.tsx`) redéfinit ces variables à la racine
  selon le mode : **un écran n’a jamais à connaître le mode**, il utilise des classes de rôle.
- Une couleur exigée **hors className** (icône, indicateur d’activité, barre d’onglets) passe par
  `useColors()`. Jamais par une constante de module : elle ne suivrait pas le mode.
- `src/shared/theme/__tests__/theme.test.ts` vérifie que Tailwind ne référence que des jetons qui
  existent, que Jour et Nuit définissent les mêmes, et que le texte reste lisible (WCAG AA) dans
  les deux modes.

Le mode (`night`, `day`, `system`) se choisit dans `useThemeStore`. Par défaut : **Nuit**, qui est
l’identité de la marque.

## Les rôles

| Rôle                           | Sert à                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| `brand-500`                    | L’action : bouton principal, Flash, prix. Rose dans les deux modes.         |
| `brand-50/100/200`             | Les pastilles et fonds teintés de rose                                      |
| `brand-600/700`                | Le **texte** rose posé sur le fond (plus foncé en Jour, plus clair en Nuit) |
| `brand-deep`                   | Le socle du bouton 3D                                                       |
| `accent`, `accent-soft/deep`   | Le bleu d’appui : localisation, boutique, infos                             |
| `surface`, `-muted`, `-sunken` | Le fond de page, les cartes, les creux                                      |
| `surface-inverse`              | Un bloc d’emphase sombre (texte `ink-inverse` dessus)                       |
| `ink`, `-muted`, `-faint`      | Le texte, du plus fort au plus discret                                      |
| `ink-inverse`                  | **Blanc dans les deux modes** : le texte sur le rose ou sur un bloc sombre  |
| `line`                         | Les filets                                                                  |
| `danger`, `success`            | Erreur, validé                                                              |

Piège : `bg-ink` n’existe plus comme fond. Un bloc sombre est `bg-surface-inverse` ; `ink` est un
**texte**, et il devient blanc en Nuit.

## Typographie

**Manrope** (400 / 500 / 600 / 700) pour le texte, **Manrope ExtraBold** pour les titres
(`font-display`). Variantes d’`AppText` : `display` · `title` · `body` · `label` · `caption`.
Un nouveau gabarit se propose comme variante, il ne s’écrit pas en ligne.

- **Radii :** `rounded-card` (18) pour les conteneurs, `rounded-control` (12) pour les champs et
  boutons. **Espacement :** l’échelle Tailwind, gouttière d’écran `px-5` via `<Screen>`.

## Aperçu navigateur

`npm run web` ouvre l’app dans un navigateur (carte remplacée par un bouchon, rendu serveur coupé) :
c’est le moyen de **regarder** un écran à la taille d’un téléphone sans simulateur. Il ne remplace
pas un test sur appareil pour tout ce qui est natif.

## Typography copy rules

User-facing strings use real typography: curly apostrophes (’) and quotes
(“ ”), ellipsis character (…). docs-lint fails straight apostrophes in UI
text — this is the canonical example of taste encoded as a check. British vs
American spelling: American. Sentence case for headings and buttons
(“Add task”, not “Add Task”).

## Component policy

`shared/ui` is the **lean** kit: `AppText`, `Button` (primary/secondary/ghost/
destructive × md/sm, loading state), `Screen`, `TextField`, `Card`, `EmptyState`,
`Skeleton`. It grows **on demand** via `/new-component`, not by pre-building a
big library (the "lean core + generator" decision — ADR/roadmap). Extending the
kit beats local styling; new primitives need a quick design sign-off and tests.
Accessibility is part of the definition of done: roles, labels, 44pt touch
targets, `accessibilityState` for toggles — see the
[UX reviewer persona](../personas/ux-reviewer.md).

## Painted-door experiments

Designers may ship UI with a no-op backend behind an analytics event to test
demand — the UI lives in the feature's `ui/`, shows an honest interim state,
and must be flagged in the PRD + removed or wired within two sprints. **Never
ship a placeholder / “coming soon” state in a store build** — Apple 2.1 rejects
it and `npm run store:check` flags it (`docs/store/checklist.md`). Painted-door
experiments are for internal/TestFlight demand-testing, not App Store review.
