#!/usr/bin/env node
/**
 * Le garde-fou qui empêche de redéployer TK LINK sur le site d'un autre client.
 *
 * C'est déjà arrivé. `npx vercel link` propose par défaut le projet Vercel
 * PORTANT LE MÊME NOM que le dossier — ici « landing » — et ce projet-là
 * appartient au projet Linky, avec `linkygroup.com` en alias de production.
 * Répondre « oui » à la proposition par défaut suffit donc à faire passer le
 * site d'un client sur celui d'un autre, sans le moindre avertissement.
 *
 * La procédure écrite ne suffit pas : elle se contourne en recopiant une vieille
 * commande depuis un terminal. Une vérification qui refuse de démarrer, si.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Le projet Vercel autorisé. Nommé « tklink » à sa création le 13/08/2026 —
 * ce qui compte n'est pas ce nom précis mais l'INTERDIT ci-dessous.
 */
const EXPECTED = 'tklink';
/** Les projets qu'un déploiement TK LINK ne doit jamais toucher. */
const FORBIDDEN = { landing: 'linkygroup.com — le site Linky' };

const file = path.join(process.cwd(), '.vercel', 'project.json');

if (!existsSync(file)) {
  console.error(
    `\n✗ Ce dossier n'est lié à aucun projet Vercel.\n\n` +
      `  Liez-le EXPLICITEMENT — jamais via la proposition par défaut :\n\n` +
      `      npx vercel link --project ${EXPECTED}\n\n` +
      `  Détails et procédure de retour arrière : landing/DEPLOY.md\n`,
  );
  process.exit(1);
}

let name;
try {
  name = JSON.parse(readFileSync(file, 'utf8')).projectName;
} catch (error) {
  console.error(`\n✗ .vercel/project.json est illisible : ${error.message}\n`);
  process.exit(1);
}

if (name !== EXPECTED) {
  const owner = FORBIDDEN[name];
  console.error(
    `\n✗ DÉPLOIEMENT REFUSÉ — ce dossier est lié au projet « ${name} ».\n` +
      (owner ? `  Ce projet sert ${owner}. Le déployer écraserait un site en production.\n` : '') +
      `\n  Attendu : « ${EXPECTED} ».\n\n` +
      `      rm -rf .vercel\n` +
      `      npx vercel link --project ${EXPECTED}\n\n` +
      `  Procédure de retour arrière si le mal est fait : landing/DEPLOY.md\n`,
  );
  process.exit(1);
}

console.log(`✓ lié au projet « ${name} » — déploiement autorisé`);
