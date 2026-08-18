import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { MerchantScreen } from '@/features/shop';
import { useOnboardingStore } from '@/features/onboarding';

/**
 * Inscription d'une boutique — et seul point où `shop` et `onboarding` se
 * rencontrent.
 *
 * L'espace commerçant existe déjà : pour un compte `commercant`, l'accueil
 * devient « Lots des grossistes » et les commandes deviennent « Mes achats ».
 * Mais le rôle ne se choisissait qu'à l'accueil des nouveaux : qui était entré
 * comme particulier ne pouvait plus jamais y accéder. C'est la route qui bascule
 * le rôle, parce qu'une tranche n'importe pas sa voisine.
 */
export default function MerchantRoute() {
  const router = useRouter();
  const setRole = useOnboardingStore((s) => s.setRole);

  const onOpenMerchantSpace = useCallback(() => {
    setRole('commercant');
    // `replace` et non `push` : on ne revient pas sur un formulaire déjà envoyé.
    router.replace('/');
  }, [router, setRole]);

  return <MerchantScreen onOpenMerchantSpace={onOpenMerchantSpace} />;
}
