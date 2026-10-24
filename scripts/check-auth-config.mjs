#!/usr/bin/env node
/**
 * auth:check — le projet Supabase est-il prêt pour l'authentification de TK LINK ?
 *
 * LECTURE SEULE : interroge `/auth/v1/settings` (public, avec la clé anon), sonde la table des
 * profils et la présence de la fonction Edge `link-phone`. Ne crée aucun compte, n'envoie aucun
 * e-mail ni SMS.
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
  // Bloquant : `link-phone` n'associe un numéro qu'à un e-mail confirmé, et sans confirmation
  // n'importe qui s'inscrit avec l'adresse d'un autre (puis lui attache un numéro).
  fail(
    '« Confirm email » est désactivé : n’importe qui peut s’inscrire avec l’adresse d’un autre, et lui associer un numéro. Réactivez-le.',
  );
} else {
  ok('Confirmation de l’e-mail active : l’app demande le code reçu.');
  warn(
    'Vérifiez que les modèles « Confirm signup » et « Reset password » contiennent {{ .Token }} (code à 6 chiffres) — voir supabase/templates/ — et que « Email OTP Length » vaut 6 (Providers → Email ; 8 par défaut).',
  );
}
warn(
  'Vérifiez que l’envoi passe par Resend (Authentication → Emails → SMTP Settings) : sans SMTP personnalisé, Supabase n’écrit qu’à l’équipe, 2 fois par heure.',
);

console.log('\nTéléphone + mot de passe');
if (!phoneWanted) {
  ok('Connexion par téléphone masquée dans l’app (EXPO_PUBLIC_AUTH_PHONE=off).');
} else if (external.phone) {
  ok('Fournisseur « Phone » activé : un numéro associé sert à se connecter.');
  // Sans confirmation, n'importe qui crée un compte par téléphone, avec le numéro d'un autre. Aucun
  // SMS ne part quand elle est active : le crochet « Send SMS » refuse tout envoi (migration 0008).
  if (settings.phone_autoconfirm) {
    fail(
      '« Enable phone confirmations » est désactivé : n’importe qui peut s’inscrire avec le numéro d’un autre. Réactivez-le (le crochet Send SMS empêche tout envoi).',
    );
  } else ok('Confirmation du numéro active : aucune inscription par téléphone sans preuve.');
  warn(
    'Vérifiez que le crochet « Send SMS » pointe vers public.send_sms_disabled (Authentication → Hooks).',
  );
} else {
  fail(
    'Fournisseur « Phone » désactivé alors que l’app propose le téléphone : activez-le avec le crochet Send SMS (voir docs/security/authentication.md), ou passez EXPO_PUBLIC_AUTH_PHONE=off.',
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
if (external.apple) {
  ok('Fournisseur « Apple » activé.');
  warn(
    'Android passe par la page web d’Apple : « Client IDs » commence par le Services ID, le secret (JWT, 6 mois) est renseigné, et tklink://auth/callback figure dans les Redirect URLs.',
  );
} else
  warn(
    'Fournisseur « Apple » désactivé : obligatoire sur iOS dès que Google est proposé (App Store 4.8).',
  );

// Les migrations 0007 et 0008 sont-elles appliquées ? Sans droit de lecture (clé anon), Postgres répond
// « permission refusée » si la colonne existe, et « colonne inconnue » si elle n'existe pas.
console.log('\nBase de données');
const probeColumn = async (column) => {
  const res = await fetch(`${url}/rest/v1/profiles?select=${column}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  const message = body?.message ?? '';
  if (body?.code === '42P01' || res.status === 404) return 'no-table';
  const missing =
    body?.code === '42703' ||
    (message.includes(column) && /does not exist|could not find/i.test(message));
  return missing ? 'missing' : 'present';
};
try {
  const identity = await probeColumn('account_type');
  if (identity === 'no-table') {
    fail('La table profiles est introuvable : appliquez les migrations (supabase db push).');
  } else if (identity === 'missing') {
    fail(
      'La migration 0007_auth_identity n’est pas appliquée (colonne profiles.account_type absente).',
    );
  } else if ((await probeColumn('account_type_declared')) === 'missing') {
    fail(
      'La migration 0008_phone_link_account_type n’est pas appliquée (colonne profiles.account_type_declared absente).',
    );
  } else {
    ok('Profils : migrations 0007 et 0008 en place (accès anonyme refusé, comme prévu).');
  }
} catch {
  warn('Impossible de sonder la table des profils.');
}

// La fonction Edge qui associe un numéro est-elle déployée ? Une requête sans session est refusée
// (401) par une fonction présente ; une fonction absente répond 404. Rien n'est associé.
if (phoneWanted) {
  try {
    const res = await fetch(`${url}/functions/v1/link-phone`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    // Une fonction en bon état refuse cet appel sans session : 401 (passerelle ou fonction), 403.
    if (res.status === 401 || res.status === 403) ok('Fonction Edge link-phone déployée.');
    else if (res.status === 404) {
      fail('Fonction Edge link-phone absente : supabase functions deploy link-phone.');
    } else {
      fail(
        `Fonction Edge link-phone en erreur (HTTP ${res.status}) : voir ses journaux dans le tableau de bord.`,
      );
    }
  } catch {
    warn('Impossible de joindre les fonctions Edge.');
  }
}

console.log(
  blocking === 0
    ? '\nPrêt. Reste à tester sur un téléphone : inscription, code, connexion par numéro, Google, Apple.'
    : `\n${blocking} point(s) bloquant(s) à corriger.`,
);
process.exit(blocking === 0 ? 0 : 1);
