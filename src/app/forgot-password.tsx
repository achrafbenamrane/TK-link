import { useRouter } from 'expo-router';

import { ForgotPasswordScreen } from '@/features/auth';

/**
 * Mot de passe oublié. Une fois le nouveau mot de passe choisi, la personne est connectée : on
 * entre dans l'app (la porte du layout enchaîne sur l'accueil si le profil local est vide).
 */
export default function ForgotPasswordRoute() {
  const router = useRouter();
  return (
    <ForgotPasswordScreen
      onDone={() => router.replace('/')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
    />
  );
}
