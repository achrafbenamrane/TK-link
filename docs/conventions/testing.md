# Testing

Strategy: a fast deterministic pyramid in CI plus an agentic exploratory
layer. A change without proof doesn't merge.

## Layers

| Layer                         | Tool                 | Lives in               | Gate                 |
| ----------------------------- | -------------------- | ---------------------- | -------------------- |
| Unit (logic, stores, schemas) | Jest                 | `__tests__/*.test.ts`  | every PR             |
| Component (render + interact) | jest-expo + RNTL 13  | `__tests__/*.test.tsx` | every PR             |
| E2E deterministic (CUJs)      | Maestro              | `.maestro/flows/`      | every PR (sim build) |
| Agentic exploratory QA        | Claude Code + Argent | nightly workflow       | report, not gate     |

## Rules

- Tests are colocated in `__tests__/` next to the code — **never in
  `src/app/`** (router scans it).
- Render through `@/shared/testing/render` (it wraps required providers);
  `react-test-renderer` is dead (React 19) — RNTL only.
- Query priority: `getByTestId` for structure, `getByText/Role` for behavior
  visible to users. Every interactive element ships a kebab-case, feature-
  prefixed `testID` (`tasks-add-button`) — that contract is shared by RNTL,
  Maestro and Argent.
- Store tests reset state in `beforeEach` (pattern in
  `src/features/tasks/__tests__/store.test.ts`).
- Bug fix ⇒ regression test _first_, watch it fail, then fix.
- Coverage floor: 60% lines globally (jest.config.js). Raise it as the app
  grows; never lower it to merge.
- Mock at the boundary (AsyncStorage, network), not the middle. Global mocks
  live in `jest.setup.ts`; feature mocks next to the feature's tests.
- A local `jest.mock('expo-router', …)` replaces the global one entirely: spread
  `require('@/shared/testing/expo-router-mock').expoRouterDefaults()` first, then
  override. When a screen starts using a new `expo-router` hook, add it to
  `expoRouterDefaults` — not to each test (14 suites broke at once on
  `useFocusEffect`, 13/11/2026).

## Base de données (pgTAP)

`supabase/tests/database/rls.test.sql` prouve les règles du serveur (`supabase test db`, sur un
poste avec Docker ; le garde Jest `sql-quoting` vérifie au moins ses guillemets). Deux pièges :

- **Une sous-requête dans `throws_ok`/`lives_ok` s’exécute sous le rôle et les règles d’accès du
  compte simulé.** Pour une ligne qu’il ne voit pas (une offre pro sous un compte client, la
  commande d’un autre), elle rend `null` et le test échoue pour une autre raison que celle annoncée.
  Lire l’identifiant AVANT, en superutilisateur, puis le passer par `set_config('tklink.x', …, true)`
  et `current_setting('tklink.x')` (relecture de 0023, 14/11/2026).
- **Une règle n’est prouvée que si le test peut échouer sans elle.** Un « pas de crédit » se teste
  sur un compte qui EN A un ; un « réservé aux commerces validés » se teste avec un commerce en
  vérification ET un autre type de compte.

## E2E (Maestro)

Each Critical User Journey in
[../quality/critical-user-journeys.md](../quality/critical-user-journeys.md)
gets one YAML flow. Keep flows short, assert on testIDs and user-visible
text. Local run: build a dev-client sim build, then `npm run e2e:ios`.

## Agentic QA (Argent)

Nightly, an agent boots the simulator build and _plays tester_: walks each
CUJ, tries edge cases, screenshots anomalies, profiles slow screens, and
files a structured report. Runbook:
[../runbooks/agentic-qa.md](../runbooks/agentic-qa.md).
