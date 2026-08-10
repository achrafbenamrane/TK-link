# Critical User Journeys

The flows that must never break. Every entry has: an owner, a Maestro flow
(deterministic gate), and agentic QA coverage (exploratory). Changing a CUJ's
behavior requires updating this file + its flow in the same PR (QA persona
enforces).

## CUJ-001 — Capture a task

- **Owner:** platform squad
- **Flow:** `.maestro/flows/tasks-cuj.yaml` · Smoke: `.maestro/flows/smoke.yaml`
- **Journey:** open app → type title → Add → task appears at top, count
  updates → toggle done → count updates → relaunch app → task persisted.
- **Edge cases agents must try:** empty title (inline error, no crash),
  201-char title (rejected), emoji/unicode titles, rapid double-tap Add,
  delete during entering animation, kill app mid-write then relaunch.
- **Performance budget:** add-task interaction < 100ms to visible row on a
  mid-range Android emulator.

## CUJ-002 — La boucle de la chasse

- **Owner:** squad produit TK LINK
- **Flow:** `.maestro/flows/chasse-cuj.yaml`
- **Journey:** ouvrir l’app → onglet du milieu « La Chasse » → ouvrir le
  coffre du jour (points + XP + coupon crédités, une seule fois par jour
  civil) → attraper un invendu du rail « Dernière chance » (panier +
  mission `catch`) → lancer un mini-jeu depuis le rail et en ressortir sur le
  hub → trophées et classement visibles en bas d’écran.
- **Edge cases agents must try:** rouvrir le coffre après un aller-retour
  d’onglet (doit rester fermé), tuer l’app juste après l’ouverture du coffre
  puis relancer (récompense persistée, pas de second tirage), attraper un
  invendu à stock 0 (bouton inerte), lancer un jeu quand le catalogue est
  filtré au point de vider les réservoirs (tuiles verrouillées, pas de
  plantage), passer minuit avec l’app ouverte.
- **Performance budget:** le hub s’affiche en < 500 ms après le tap sur
  l’onglet, sur un Android milieu de gamme ; les rails défilent à 60 fps.

## Template for new CUJs

```
## CUJ-NNN — <name>
- Owner / Flow / Journey / Edge cases / Performance budget
```

Keep this list short (≤ 10) — if everything is critical, nothing is.
