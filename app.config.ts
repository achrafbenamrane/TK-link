import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Typed Expo config — the single source of truth for app identity.
 *
 * Environment-specific values come from EAS environment variables or
 * `.env` files (EXPO_PUBLIC_*). See docs/conventions/environments.md.
 *
 * TODO(company): replace name, slug, scheme, bundle identifiers and the
 * EAS projectId placeholder before first build.
 */

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

// Nom affiché (écran d'accueil du téléphone, stores).
//
// La bascule de marque est ACTÉE : plus rien ne porte l'ancien nom ici.
//
// ⚠️ Changer le `package` Android crée une NOUVELLE application aux yeux du
// système et des stores : les installations portant l'ancien identifiant ne
// se mettront pas à jour, elles cohabiteront. C'est sans conséquence avant
// publication — il n'y a pas d'utilisateur à emmener — mais ce serait
// irréversible après. Les builds de test déjà installés sont à désinstaller
// à la main.
const name = IS_DEV ? 'TK LINK (Dev)' : IS_PREVIEW ? 'TK LINK (Preview)' : 'TK LINK';
const bundleId = IS_DEV
  ? 'com.progix.tklink.dev'
  : IS_PREVIEW
    ? 'com.progix.tklink.preview'
    : 'com.progix.tklink';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  // ⚠️ `slug` doit correspondre au NOM DU PROJET EAS, aujourd'hui
  // « @tk-link/freedoo » (voir `npx eas project:info`). Le renommer ici sans
  // l'avoir renommé sur expo.dev fait échouer tous les builds. C'est la seule
  // trace de l'ancien nom qui subsiste, et elle n'est visible que dans les
  // URL du tableau de bord EAS — jamais par un utilisateur.
  // Pour la retirer : renommer le projet sur expo.dev, puis passer ce slug à
  // 'tklink'. L'identifiant du projet (`extra.eas.projectId`) ne change pas.
  slug: 'freedoo',
  owner: 'tk-link',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'tklink',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    // Pas de surcharge iOS : `assets/expo.icon` est le bundle Icon Composer
    // livré par le squelette — il contient le symbole EXPO, pas le nôtre. Sans
    // cette ligne, iOS reprend l'icône TK LINK commune définie plus haut.
    // Answers the App Store export-compliance prompt automatically (set true
    // only if you add non-exempt encryption). Store-readiness: STORE-APL-EXPORT.
    config: {
      usesNonExemptEncryption: false,
    },
    // Required-reason API manifest (enforced at App Store Connect upload since
    // 2024-05-01). These cover Expo/RN's own usage. ADD a SDK's reasons when you
    // install it (copy from node_modules/<pkg>/ios/PrivacyInfo.xcprivacy).
    // We do NOT track users → no NSPrivacyTracking / ATT. Store-readiness: STORE-APL-PRIVMANIFEST.
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
    // Add tailored NSxxxUsageDescription strings here ONLY for permissions you
    // actually use (a generic string gets rejected; an unused permission also does).
    // infoPlist: { NSCameraUsageDescription: 'Explain exactly why.' },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      // Le vert de la marque, comme android-icon-background.png : l'image
      // l'emporte, mais une couleur contradictoire ici induirait en erreur le
      // prochain lecteur — et se verrait pendant le chargement de l'image.
      backgroundColor: '#0B6C3B',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Request the minimum. Strip library-added permissions you don't need, e.g.:
    // blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#17140F',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 140,
        },
      },
    ],
    'expo-font',
    // Required by expo-secure-store ≥56 — the secrets/PII half of
    // @/shared/lib/storage is backed by it. See docs/security/checklist.md.
    'expo-secure-store',
    [
      // Vue carte. Le jeton de TÉLÉCHARGEMENT (sk.*, scope DOWNLOADS:READ) sert
      // uniquement à récupérer le SDK natif pendant le build : c'est un vrai
      // secret, il vit dans les secrets EAS et jamais dans le dépôt.
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'TK LINK utilise votre position pour afficher les commerces partenaires autour de vous et calculer le trajet jusqu’au magasin.',
      },
    ],
    [
      // Déverrouillage biométrique. L’empreinte elle-même ne quitte JAMAIS le
      // matériel sécurisé du téléphone : l’OS renvoie seulement « c’est bien le
      // propriétaire » — aucune app ne peut lire une empreinte.
      'expo-local-authentication',
      {
        faceIDPermission: 'TK LINK utilise Face ID pour déverrouiller votre compte.',
      },
    ],
    [
      // Google Play requires targeting a recent API level (35+ since 2025-08-31;
      // expect 36 ~2026-08). Store-readiness: STORE-GP-TARGETAPI.
      //
      // compileSdk is 36 while targetSdk stays 35 on purpose: androidx.core 1.18
      // and androidx.browser 1.9 (pulled in by expo-dev-client) refuse to link
      // against anything below 36, but raising targetSdk would opt the app into
      // Android 16 runtime behavior — a separate change that needs its own QA pass.
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    // TODO(company): set after `eas init` + `eas update:configure`
    // url: 'https://u.expo.dev/<EAS_PROJECT_ID>',
  },
  extra: {
    eas: {
      // Projet sous l'organisation « TK LINK » (slug tk-link, compte borzvalor).
      // Historique des organisations précédentes, pour mémoire :
      //   krunchy   → 654ee1f7-56b9-4f4e-a3f9-337598077850
      //   tklink    → 329bcddd-d9a7-404c-9325-523290072a8f
      //   (ancien)  → f8fd49f4… (compte achrafbenamrane)
      // Changer d'organisation régénère les identifiants de signature : le
      // nouvel APK ne peut donc PAS mettre à jour une installation existante,
      // il faut désinstaller l'ancienne.
      projectId: '4c764f8e-8c18-43d4-bbe6-972ee71b76c5',
    },
    /**
     * Jeton Mapbox PUBLIC (pk.*) — conçu pour être livré dans l’app ; il rend la
     * carte et appelle l’API Directions. Lu ici au moment du build, donc SANS
     * préfixe EXPO_PUBLIC_ : `scripts/check-secrets.mjs` rejette tout nom
     * EXPO_PUBLIC_* contenant « TOKEN ». Ne jamais y mettre un jeton sk.*.
     */
    mapboxPublicToken: process.env.MAPBOX_PUBLIC_TOKEN ?? '',
  },
});
