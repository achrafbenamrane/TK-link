#!/usr/bin/env node
/**
 * apple:secret — fabrique le « secret » qu'Apple exige pour la connexion par sa PAGE WEB (Apple sur
 * Android, ADR-0010) : un JWT ES256 signé avec la clé `.p8` de Sign in with Apple.
 *
 * Usage (depuis la racine du dépôt) :
 *   npm run apple:secret -- <TEAM_ID> <KEY_ID> <SERVICES_ID> <chemin/vers/AuthKey_KEYID.p8>
 *
 * Le résultat se colle dans Supabase → Authentication → Providers → Apple → « Secret Key ».
 * Il EXPIRE au bout de 180 jours (Apple refuse plus de six mois) : la date est affichée, notez-la et
 * refaites-le avant. La clé `.p8` et le secret ne vont JAMAIS dans le dépôt ni dans une variable
 * EXPO_PUBLIC_* : seulement dans Supabase. Aucune dépendance, rien n'est envoyé sur le réseau.
 */
import { createPrivateKey, sign } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';

const [teamId, keyId, servicesId, keyPath] = process.argv.slice(2);
if (!teamId || !keyId || !servicesId || !keyPath) {
  console.error(
    'Usage : npm run apple:secret -- <TEAM_ID> <KEY_ID> <SERVICES_ID> <chemin/vers/AuthKey_KEYID.p8>',
  );
  process.exit(1);
}
if (!/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId)) {
  console.error('Team ID et Key ID font 10 caractères (lettres majuscules et chiffres).');
  process.exit(1);
}

const LIFETIME_DAYS = 180;
const issuedAt = Math.floor(Date.now() / 1000);
const expiresAt = issuedAt + LIFETIME_DAYS * 24 * 3600;

const encode = (part) => Buffer.from(JSON.stringify(part)).toString('base64url');
const input = `${encode({ alg: 'ES256', kid: keyId })}.${encode({
  iss: teamId,
  iat: issuedAt,
  exp: expiresAt,
  aud: 'https://appleid.apple.com',
  sub: servicesId,
})}`;

let key;
try {
  key = createPrivateKey(readFileSync(keyPath));
} catch {
  console.error(`Clé illisible : ${keyPath} (attendu : le fichier AuthKey_${keyId}.p8 d'Apple).`);
  process.exit(1);
}
const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });

console.log(`${input}.${signature.toString('base64url')}`);
console.error(
  `\nValable jusqu'au ${new Date(expiresAt * 1000).toLocaleDateString('fr-FR')} — à renouveler avant.`,
);
