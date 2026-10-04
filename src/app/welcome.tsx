import { useRouter } from 'expo-router';

import { selectCompleted, useOnboardingStore } from '@/features/onboarding';
import { useWelcomeStore, WelcomeScreen } from '@/features/welcome';

/**
 * L'OUVERTURE : le logo s'anime, puis on passe à la suite sans rien toucher —
 * le choix du profil au premier lancement, l'accueil quand le compte existe déjà.
 */
export default function WelcomeRoute() {
  const router = useRouter();
  const completed = useOnboardingStore(selectCompleted);
  const markSplashDone = useWelcomeStore((s) => s.markSplashDone);

  return (
    <WelcomeScreen
      onDone={() => {
        markSplashDone();
        router.replace(completed ? '/' : '/role');
      }}
    />
  );
}
