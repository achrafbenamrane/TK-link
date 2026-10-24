import { useRouter } from 'expo-router';

import { AccountScreen } from '@/features/auth';

import { useSignOut } from './(tabs)/profil';

/**
 * Routes stay THIN. `/account` hosts sign-out + the required in-app account
 * deletion path, reached from the profile's « Mon compte » row.
 *
 * Se déconnecter et supprimer son compte remettent l'app à zéro de la MÊME façon : les données
 * locales (profil, panier, fidélité…) partent avec la session, et l'accueil se rejoue. La remise à
 * zéro vit dans la route du profil, qui seule connaît toutes les tranches.
 */
export default function AccountRoute() {
  const router = useRouter();
  const resetAndLeave = useSignOut();
  return (
    <AccountScreen
      onSignOut={resetAndLeave}
      onAccountDeleted={resetAndLeave}
      onSignIn={() => router.push('/sign-in')}
    />
  );
}
