import { useRouter } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding';

/** L'accueil des nouveaux utilisateurs : impact, avatar, profil, intérêts. */
export default function OnboardingRoute() {
  const router = useRouter();
  return <OnboardingScreen onDone={() => router.replace('/')} />;
}
