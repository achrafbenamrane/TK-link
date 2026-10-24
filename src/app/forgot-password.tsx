import { useRouter } from 'expo-router';

import { ForgotPasswordScreen } from '@/features/auth';

import { useEnterApp } from './sign-in';

/**
 * Mot de passe oublié. Une fois le nouveau mot de passe choisi, la personne est connectée : on entre
 * dans l'app comme après une connexion (`useEnterApp` : le type de compte relu sur le serveur, puis
 * l'accueil ou les étapes d'accueil de ce profil).
 */
export default function ForgotPasswordRoute() {
  const router = useRouter();
  const enterApp = useEnterApp();
  return (
    <ForgotPasswordScreen
      onDone={() => void enterApp()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
    />
  );
}
