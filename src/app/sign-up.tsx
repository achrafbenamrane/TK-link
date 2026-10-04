import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { SignUpScreen, type SignUpProfile } from '@/features/auth';
import { AvatarPicker, selectRole, useOnboardingStore } from '@/features/onboarding';
import { useShopStore } from '@/features/shop';

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
/**
 * DÉMONSTRATION : l'inscription s'ouvre déjà REMPLIE, pour que le client puisse tester
 * sans rien saisir. Le SIRET est un numéro valide au sens de la clé de Luhn ; l'e-mail,
 * le téléphone et le mot de passe sont des exemples. À retirer avec la démonstration.
 */
const DEMO_DRAFT = {
  firstName: 'Neo',
  lastName: 'Démo',
  email: 'demo@tklink.fr',
  phone: '06 12 34 56 78',
  password: 'demo12345',
  confirm: 'demo12345',
  location: 'Toulouse',
};
const DEMO_SHOP = {
  shopName: 'Le Petit Toulousain',
  category: 'restauration',
  siret: '44306184100047',
  address: '8 rue des Carmes, 31000 Toulouse',
};

export default function SignUpRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
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

  // Un livreur dépose ses justificatifs ; les autres choisissent leurs centres d'intérêt.
  const toOnboarding = useCallback(
    () => router.replace(role === 'livreur' ? '/devenir-livreur' : '/onboarding'),
    [router, role],
  );
  const toSignIn = useCallback(() => router.replace('/sign-in'), [router]);

  return (
    <SignUpScreen
      role={role}
      initialDraft={
        role === 'commercant' || role === 'grossiste' ? { ...DEMO_DRAFT, ...DEMO_SHOP } : DEMO_DRAFT
      }
      initialAccepted
      renderAvatar={() => <AvatarPicker size={48} />}
      onProfile={onProfile}
      onSignedUp={toOnboarding}
      onSignIn={toSignIn}
      onBack={() => router.replace('/role')}
      {...(role === 'consommateur' ? { onSkip: toOnboarding } : {})}
    />
  );
}
