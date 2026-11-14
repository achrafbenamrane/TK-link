#!/usr/bin/env node
/**
 * auth:check — le projet Supabase est-il prêt pour l'authentification de TK LINK ?
 *
 * LECTURE SEULE : interroge `/auth/v1/settings` (public, avec la clé anon), sonde la table des
 * profils et la présence des fonctions Edge (`link-phone` et les autres). Ne crée aucun compte, n'envoie aucun
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

// Les migrations 0007 à 0009 sont-elles appliquées ? Sans droit de lecture (clé anon), Postgres répond
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
  } else if ((await probeColumn('onboarded_at')) === 'missing') {
    fail(
      'La migration 0009_profile_onboarding n’est pas appliquée (colonne profiles.onboarded_at absente) : une personne déjà inscrite repasserait par les centres d’intérêt à chaque connexion.',
    );
  } else {
    ok('Profils : migrations 0007 à 0009 en place (accès anonyme refusé, comme prévu).');
  }
} catch {
  warn('Impossible de sonder la table des profils.');
}

// La table des dossiers professionnels (0010) existe-t-elle ? Le public la lit (commerces validés
// seulement) : une table présente répond 200, même vide ; absente, PostgREST répond 404.
try {
  const res = await fetch(`${url}/rest/v1/shops?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.ok) {
    ok('Dossiers professionnels : migration 0010 en place.');
  } else {
    fail(
      'La migration 0010_shops n’est pas appliquée (table shops absente) : un commerçant ou un grossiste ne peut pas déposer son dossier.',
    );
  }
} catch {
  warn('Impossible de sonder la table des dossiers professionnels.');
}

// Les Flash en direct (0011) : la table, et le dossier de photos (public, lisible sans compte).
try {
  const res = await fetch(`${url}/rest/v1/flash_offers?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const bucket = await fetch(`${url}/storage/v1/bucket/flash-photos`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    fail(
      'La migration 0011_flash_offers n’est pas appliquée (table flash_offers absente) : les Flash ne partent pas au serveur et les clients ne les voient pas.',
    );
  } else {
    ok('Flash en direct : migration 0011 en place.');
    // La lecture d'un dossier de Storage demande une clé de service : un 400/404 ici n'est pas une
    // preuve d'absence. Le test réel est la publication d'une Flash avec photo.
    if (bucket.status >= 500) warn('Storage injoignable : les photos des Flash ne partiront pas.');
  }
} catch {
  warn('Impossible de sonder la table des Flash.');
}

// Les commandes (0012). Sans compte, la fonction de réservation est refusée (401/403) si elle existe ;
// absente, PostgREST répond 404. Rien n'est réservé.
try {
  // Les VRAIS noms de paramètres : sans eux, PostgREST ne trouve aucune fonction à appeler et répond
  // 404 même quand elle existe (signature introuvable). Avec eux et sans compte : refus (401).
  const res = await fetch(`${url}/rest/v1/rpc/reserve_flash`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_items: [], p_fulfilment: 'touch-collect' }),
  });
  if (res.status === 404) {
    fail(
      'La migration 0012_flash_orders n’est pas appliquée (fonction reserve_flash absente) : un client ne peut pas commander une Flash.',
    );
  } else {
    ok('Commandes : migration 0012 en place (réservation refusée sans compte, comme prévu).');
  }
} catch {
  warn('Impossible de sonder les commandes.');
}

// Les migrations 0013 à 0023. Une table ou une fonction ABSENTE répond 404 (PostgREST) ; présente,
// elle répond 200 (lecture publique) ou 401/403 (réservée aux comptes) — rien n'est écrit.
const probes = [
  {
    migration: '0013_stripe_connect',
    path: 'shops?select=stripe_charges_enabled&limit=1',
    // Colonne absente : 400 (PGRST204/42703), pas 404.
    missing: (s) => s === 400 || s === 404,
    what: 'les commerçants ne peuvent pas être payés en ligne',
  },
  {
    migration: '0014_support',
    table: 'support_tickets',
    what: 'l’aide et le support de l’app ne fonctionnent pas',
  },
  {
    migration: '0015_shop_media',
    table: 'shop_media',
    what: 'les visuels IA des commerces ne s’enregistrent pas',
  },
  {
    migration: '0016_push_tokens',
    rpc: 'register_push_token',
    // Avec ses paramètres : sans eux, PostgREST répond 404 même si la fonction existe.
    body: { p_token: 'ExponentPushToken[sonde]', p_platform: 'android' },
    what: 'les téléphones ne s’enregistrent pas pour les notifications',
  },
  {
    migration: '0017_loyalty',
    table: 'loyalty_programs',
    what: 'les commandes payées ne rapportent aucun point de fidélité',
  },
  {
    migration: '0018_reward_sharing',
    rpc: 'share_reward',
    // Réservée aux comptes : présente, elle refuse la clé publique (401) ; absente, 404.
    body: { p_reward: '00000000-0000-0000-0000-000000000000' },
    what: 'partager une récompense de fidélité ne la retire pas de l’inventaire',
  },
  {
    migration: '0019_referrals',
    rpc: 'referral_summary',
    what: 'le parrainage reste sur le téléphone : aucun crédit sur les vraies commandes',
  },
  {
    migration: '0020_checkout_cancel',
    rpc: 'cancel_order_after_checkout',
    // Réservée au serveur : présente, elle refuse la clé publique ; absente, 404. TOUS ses
    // paramètres : il en manque un, PostgREST répond 404 même si elle existe.
    body: { p_order: '00000000-0000-0000-0000-000000000000', p_checkout: 'sonde' },
    what: 'une réservation peut être annulée pendant que sa page de paiement reste ouverte',
  },
  {
    migration: '0021_dispute_decisions',
    path: 'flash_orders?select=dispute_note&limit=1',
    // Colonne absente : 400 ; présente : refusée à la clé publique (401) — rien n’est lu.
    missing: (s) => s === 400 || s === 404,
    what: 'les décisions sur les litiges ne sont pas enregistrées (onglet Litiges du back-office)',
  },
  {
    migration: '0022_platform_settings',
    rpc: 'platform_public_settings',
    // Lecture publique : présente, 200 ; absente, 404.
    what: 'la commission et le crédit réglés dans le back-office ne s’appliquent pas',
  },
  {
    migration: '0023_b2b_orders',
    path: 'flash_orders?select=audience&limit=1',
    // Colonne absente : 400 ; présente : refusée à la clé publique (401) — rien n’est lu.
    missing: (s) => s === 400 || s === 404,
    what: 'les commerçants ne peuvent pas commander les offres pro des grossistes',
  },
  {
    migration: '0025_order_ratings',
    rpc: 'shop_ratings',
    // Moyennes publiques : présente, 200 (liste vide pour aucun commerce) ; absente, 404.
    body: { p_shops: [] },
    what: 'les clients ne peuvent pas noter les commerçants, et les vitrines n’ont pas de moyenne',
  },
  {
    migration: '0026_shop_follows',
    path: 'shop_follows?select=shop_id&limit=1',
    // Table absente : 404 ; présente : refusée à la clé publique (401) — rien n’est lu.
    missing: (s) => s === 404,
    what: 'personne ne peut suivre un commerce ni être prévenu de ses ventes flash',
  },
  {
    migration: '0027_order_refunds',
    rpc: 'report_order_issue',
    // Réservée aux comptes : présente, elle refuse la clé publique (401) ; absente, 404. TOUS ses
    // paramètres, sinon 404 même quand elle existe. Rien n'est signalé.
    body: { p_order: '00000000-0000-0000-0000-000000000000', p_kind: 'autre' },
    what: '« Signaler un problème » n’atteint pas le serveur, et aucun remboursement ne part tout seul',
  },
];
for (const probe of probes) {
  try {
    const path = probe.rpc
      ? `rpc/${probe.rpc}`
      : probe.table
        ? `${probe.table}?select=*&limit=1`
        : probe.path;
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method: probe.rpc ? 'POST' : 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(probe.rpc ? { body: JSON.stringify(probe.body ?? {}) } : {}),
    });
    const missing = probe.missing ? probe.missing(res.status) : res.status === 404;
    if (missing) fail(`La migration ${probe.migration} n’est pas appliquée : ${probe.what}.`);
    else ok(`Migration ${probe.migration} en place.`);
  } catch {
    warn(`Impossible de sonder la migration ${probe.migration}.`);
  }
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

// Les autres fonctions Edge (paiement, livraison, visuels IA, notifications). Même sonde, sans
// session : une fonction présente répond 401 (appelant inconnu ou webhook non signé) ou 503 tant que
// la clé de son service manque ; 404 = pas déployée. Aucune ne fait rien sans session ni signature.
// Pas bloquant pour l'authentification : signalé seulement.
const EDGE_FUNCTIONS = [
  'delete-account',
  'stripe-connect',
  'stripe-balance',
  'stripe-payment',
  'stripe-webhook',
  'order-cancel',
  'uber-quote',
  'uber-dispatch',
  'uber-cancel',
  'uber-webhook',
  'ai-media-start',
  'ai-media-status',
  'push-events',
  'order-refund',
];
const missingKey = [];
const absent = [];
for (const name of EDGE_FUNCTIONS) {
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = await res.text();
    if (res.status === 404) absent.push(name);
    else if (res.status === 503 && /not_configured/.test(body)) missingKey.push(name);
    else if (res.status >= 500) warn(`Fonction Edge ${name} en erreur (HTTP ${res.status}).`);
  } catch {
    warn(`Impossible de joindre la fonction Edge ${name}.`);
  }
}
if (absent.length) warn(`Fonctions Edge non déployées : ${absent.join(', ')}.`);
else ok(`Les ${EDGE_FUNCTIONS.length} autres fonctions Edge sont déployées.`);
if (missingKey.length) {
  warn(
    `Clé du service manquante (Supabase → Edge Functions → Secrets) : ${missingKey.join(', ')}.`,
  );
}

console.log(
  blocking === 0
    ? '\nPrêt. Reste à tester sur un téléphone : inscription, code, connexion par numéro, Google, Apple.'
    : `\n${blocking} point(s) bloquant(s) à corriger.`,
);
process.exit(blocking === 0 ? 0 : 1);
