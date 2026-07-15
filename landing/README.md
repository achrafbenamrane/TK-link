# Freedoo — Landing (Next.js)

Landing page marketing de Freedoo, portée en **Next.js (App Router)**.
Même design, même contenu que la maquette HTML d'origine — architecture Next.js.

## Stack

- Next.js 15 (App Router)
- React 19
- CSS global (aucune dépendance UI)
- Polices Google : Unbounded (display) + Manrope (texte)

## Démarrer

```bash
cd landing
npm install
npm run dev
```

Ouvrez http://localhost:3000

## Build de production

```bash
npm run build
npm start
```

## Structure

```
app/
  layout.jsx        # <html>, polices, metadata
  page.jsx          # markup de la page (server component)
  interactions.jsx  # JS client : compte à rebours, bouton rouge, reveals, QR
  globals.css       # styles
```

> Projet autonome (son propre `package.json`). Lancez les commandes npm depuis
> le dossier `landing/`, pas depuis la racine du repo Expo.
