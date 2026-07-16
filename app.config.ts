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

const name = IS_DEV ? 'Freedoo (Dev)' : IS_PREVIEW ? 'Freedoo (Preview)' : 'Freedoo';
const bundleId = IS_DEV
  ? 'com.progix.freedoo.dev'
  : IS_PREVIEW
    ? 'com.progix.freedoo.preview'
    : 'com.progix.freedoo';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name,
  slug: 'freedoo',
  owner: 'freedoo',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'freedoo',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    icon: './assets/expo.icon',
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
      backgroundColor: '#F6F2EA',
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
          imageWidth: 76,
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
          'Freedoo utilise votre position pour afficher les ventes flash autour de vous et calculer le trajet jusqu’au commerçant.',
      },
    ],
    [
      // Déverrouillage biométrique. L’empreinte elle-même ne quitte JAMAIS le
      // matériel sécurisé du téléphone : l’OS renvoie seulement « c’est bien le
      // propriétaire » — aucune app ne peut lire une empreinte.
      'expo-local-authentication',
      {
        faceIDPermission: 'Freedoo utilise Face ID pour déverrouiller votre compte.',
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
      // Projet sous l'organisation « freedoo » (compte borzvalor). L'ancien
      // projet (f8fd49f4…, compte achrafbenamrane) garde l'historique des
      // premiers builds mais n'est plus utilisé.
      projectId: '329bcddd-d9a7-404c-9325-523290072a8f',
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
