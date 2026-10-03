import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignUpScreen, type SignUpProfile } from '@/features/auth';
import { AvatarPicker, selectRole, useOnboardingStore } from '@/features/onboarding';
import { useShopStore } from '@/features/shop';
import type { Role } from '@/shared/lib/roles';

/**
 * INSCRIPTION — CDC V1.0 §2.2.
 *
 * La route compose : le rôle et l'avatar viennent de l'onboarding, le
 * formulaire vit dans `auth`, la demande du commerçant dans `shop`. Les trois
 * features s'ignorent ; c'est ici qu'elles se rencontrent.
 *
 * Le compte ouvre le parcours (étape 2 du parcours du client) ; une fois
 * inscrit — ou en continuant sans compte — on enchaîne sur les centres
 * d'intérêt, la localisation et la sécurisation. La porte du layout laisse
 * passer tant que l'onboarding n'est pas terminé.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const setRole = useOnboardingStore((s) => s.setRole);
  const setFirstName = useOnboardingStore((s) => s.setFirstName);
  const setSiret = useOnboardingStore((s) => s.setSiret);
  const submitMerchantApplication = useShopStore((s) => s.submitMerchantApplication);

  const onProfile = useCallback(
    (p: SignUpProfile) => {
      setFirstName(p.firstName);
      setSiret(p.siret);
      // Un professionnel dépose en même temps la fiche de son commerce.
      if (role !== 'consommateur' && p.category !== '') {
        submitMerchantApplication({
          shopName: p.shopName,
          category: p.category,
          contactName: `${p.firstName} ${p.lastName}`.trim(),
          phone: p.phone,
          email: p.email,
          area: p.location || p.address,
          address: p.address,
          modes: p.modes,
        });
      }
    },
    [role, setFirstName, setSiret, submitMerchantApplication],
  );

  const onRoleChange = useCallback((next: Role) => setRole(next), [setRole]);
  const toOnboarding = useCallback(() => router.replace('/onboarding'), [router]);
  const toSignIn = useCallback(() => router.replace('/sign-in'), [router]);

  return (
    <SignUpScreen
      role={role}
      renderAvatar={() => <AvatarPicker />}
      onRoleChange={onRoleChange}
      onProfile={onProfile}
      onSignedUp={toOnboarding}
      onSignIn={toSignIn}
      {...(role === 'consommateur' ? { onSkip: toOnboarding } : {})}
    />
  );
}
