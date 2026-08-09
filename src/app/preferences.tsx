import { useRouter } from 'expo-router';

import { PreferencesScreen } from '@/features/shop';

/** « Ma Fan Zone » — les préférences de recherche. */
export default function PreferencesRoute() {
  const router = useRouter();
  return (
    <PreferencesScreen onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
  );
}
