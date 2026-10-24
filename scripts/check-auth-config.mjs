#!/usr/bin/env node
/**
 * auth:check — le projet Supabase est-il prêt pour l'authentification de TK LINK ?
 *
 * LECTURE SEULE : interroge `/auth/v1/settings` (public, avec la clé anon) et sonde la table des
 * profils. Ne crée aucun compte, n'envoie aucun e-mail ni SMS.
 *
 * Usage (depuis la racine du dépôt) :
 *   node --env-file=.env scripts/check-auth-config.mjs
 *   # ou, avec les variables déjà dans l'environnement :
 *   npm run auth:check
 *
 * Ce que l'app attend est décrit dans docs/security/authentication.md.
 */

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const googleWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const phoneWanted = (process.env.EXPO_PUBLIC_AUTH_PHONE ?? 'on') === 'on';

let blocking = 0;
const line = (mark, text) => console.log(`${mark} ${text}`);
const ok = (text) => line('✓', text);
const warn = (text) => line('!', text);
const fail = (text) => {
  blocking++;
  line('✗', text);
};

if (
  !url ||
  !key ||
  url.includes('localhost.supabase.co') ||
  key === 'public-anon-key-placeholder'
) {
  fail(
    'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY ne sont pas renseignés : l’app reste en démonstration.',
  );
  process.exit(1);
}
if (key.includes('service_role') || key.startsWith('sb_secret_')) {
  fail(
    'La clé fournie ressemble à une clé SECRÈTE (service_role) : utilisez la clé publique « anon ».',
  );
  process.exit(1);
}

console.log(`Projet : ${url}\n`);

let settings;
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res.ok) {
    fail(`/auth/v1/settings a répondu ${res.status} — l’URL ou la clé anon est-elle la bonne ?`);
    process.exit(1);
  }
  settings = await res.json();
} catch (error) {
  fail(`Projet injoignable (${error instanceof Error ? error.message : 'erreur réseau'}).`);
  process.exit(1);
}

const external = settings.external ?? {};

console.log('Inscription');
if (settings.disable_signup)
  fail('Les inscriptions sont fermées (« Allow new users to sign up » est désactivé).');
else ok('Inscriptions ouvertes.');

console.log('\nE-mail + mot de passe');
if (external.email) ok('Fournisseur « Email » activé.');
else fail('Fournisseur « Email » désactivé : personne ne peut créer de compte par e-mail.');
if (settings.mailer_autoconfirm) {
  warn(
    'Confirmation de l’e-mail désactivée : n’importe qui peut s’inscrire avec l’adresse d’un autre.',
  );
} else {
  ok('Confirmation de l’e-mail active : l’app demande le code reçu.');
  warn(
    'Vérifiez que les modèles « Confirm signup » et « Reset password » contiennent {{ .Token }} (code à 6 chiffres) — voir supabase/templates/.',
  );
}

console.log('\nTéléphone + mot de passe');
if (!phoneWanted) {
  ok('Connexion par téléphone masquée dans l’app (EXPO_PUBLIC_AUTH_PHONE=off).');
} else if (external.phone) {
  ok(
    `Fournisseur « Phone » activé${settings.sms_provider ? ` (SMS : ${settings.sms_provider})` : ''}.`,
  );
  if (settings.phone_autoconfirm) {
    warn('Confirmation du numéro désactivée : un numéro n’est jamais vérifié par SMS.');
  }
} else {
  fail(
    'Fournisseur « Phone » désactivé alors que l’app propose le téléphone : branchez un fournisseur de SMS, ou passez EXPO_PUBLIC_AUTH_PHONE=off.',
  );
}

console.log('\nGoogle');
if (external.google) ok('Fournisseur « Google » activé.');
else warn('Fournisseur « Google » désactivé dans Supabase : le bouton échouera.');
if (googleWeb) ok('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID renseigné (le bouton s’affiche).');
else warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID vide : le bouton Google est masqué dans l’app.');
if (googleWeb && !googleIos)
  warn('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID vide : Google ne fonctionnera pas sur iPhone.');

console.log('\nApple');
if (external.apple)
  ok('Fournisseur « Apple » activé (ajoutez les identifiants de bundle dans « Client IDs »).');
else
  warn(
    'Fournisseur « Apple » désactivé : obligatoire sur iOS dès que Google est proposé (App Store 4.8).',
  );

// La migration 0007 est-elle appliquée ? Sans droit de lecture (clé anon), Postgres répond « permission
// refusée » si la colonne existe, et « colonne inconnue » si elle n'existe pas : c'est ce qu'on lit.
console.log('\nBase de données');
try {
  const res = await fetch(`${url}/rest/v1/profiles?select=account_type&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  const code = body?.code ?? '';
  const missingColumn =
    /account_type/.test(body?.message ?? '') &&
    /does not exist|could not find/i.test(body?.message ?? '');
  if (code === '42703' || missingColumn) {
    fail(
      'La migration 0007_auth_identity n’est pas appliquée (colonne profiles.account_type absente).',
    );
  } else if (code === '42P01' || res.status === 404) {
    fail('La table profiles est introuvable : appliquez les migrations (supabase db push).');
  } else {
    ok('Profils : migration 0007 en place (accès anonyme refusé, comme prévu).');
  }
} catch {
  warn('Impossible de sonder la table des profils.');
}

console.log(
  blocking === 0
    ? '\nPrêt. Reste à tester sur un téléphone : inscription, code, connexion par numéro, Google, Apple.'
    : `\n${blocking} point(s) bloquant(s) à corriger.`,
);
process.exit(blocking === 0 ? 0 : 1);
