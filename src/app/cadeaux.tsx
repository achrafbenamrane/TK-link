import { useRouter } from 'expo-router';

import { GiftsScreen } from '@/features/loyalty';

/** CADEAUX — l'échange des points, ouvert depuis la carte. */
export default function CadeauxRoute() {
  const router = useRouter();
  return (
    <GiftsScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/carte'))} />
  );
}
