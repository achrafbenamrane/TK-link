import Constants from 'expo-constants';

/**
 * Jeton Mapbox PUBLIC (pk.*), injecté au build par `app.config.ts` depuis
 * `MAPBOX_PUBLIC_TOKEN`. Il est public par conception : il part dans le bundle
 * pour afficher la carte. Le jeton de téléchargement (sk.*) n'existe qu'au
 * moment du build, côté EAS — il n'atteint jamais l'app.
 *
 * Vide si la variable n'est pas définie : l'app doit le dire clairement plutôt
 * que d'afficher une carte grise sans explication.
 */
export const MAPBOX_PUBLIC_TOKEN: string =
  (Constants.expoConfig?.extra?.mapboxPublicToken as string | undefined) ?? '';

export const hasMapboxToken = MAPBOX_PUBLIC_TOKEN.startsWith('pk.');
