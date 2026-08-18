import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignInScreen } from '@/features/auth';

/**
 * Routes stay THIN — wire the URL to the feature screen. The root layout's
 * `useProtectedRoute` redirects here when there is no session.
 *
 * Après une connexion réussie on entre dans l'app. Si le profil local n'a
 * jamais été rempli (nouvelle installation), la porte du layout enchaîne sur
 * l'onboarding : l'avatar et les centres d'intérêt vivent sur le téléphone,
 * pas dans la session.
 */
export default function SignInRoute() {
  const router = useRouter();
  const onCreateAccount = useCallback(() => router.push('/sign-up'), [router]);
  const onSignedIn = useCallback(() => router.replace('/'), [router]);
  const onMerchantSignUp = useCallback(() => router.push('/commercant'), [router]);
  return (
    <SignInScreen
      onCreateAccount={onCreateAccount}
      onSignedIn={onSignedIn}
      onMerchantSignUp={onMerchantSignUp}
    />
  );
}
