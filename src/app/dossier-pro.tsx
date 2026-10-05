import { useRouter } from 'expo-router';

import { ProSetupScreen } from '@/features/merchant';
import { selectRole, selectSiret, useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric, useShopStore } from '@/features/shop';
import { isDemoBuild } from '@/shared/lib/env';

/**
 * DÉMONSTRATION : l'IBAN s'affiche déjà rempli (un numéro d'exemple, clé valide), comme
 * l'inscription — le client teste sans rien saisir. À retirer avec la démonstration.
 */
const DEMO_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

/**
 * Le dépôt des informations pro, la vérification et la sécurisation d'un professionnel —
 * étapes 3 à 6 des cartes « Process commerçant » et « Process grossiste / fournisseur ». L'authentification locale
 * est celle du téléphone (`shop`), passée en props : `merchant` n'importe pas la boutique.
 */
export default function ProDossierRoute() {
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);
  const siret = useOnboardingStore(selectSiret);
  const role = useOnboardingStore(selectRole);
  const application = useShopStore((s) => s.merchantApplication);

  return (
    <ProSetupScreen
      role={role === 'commercant' ? 'commercant' : 'grossiste'}
      siret={siret}
      address={application?.address ?? ''}
      initialIban={isDemoBuild ? DEMO_IBAN : ''}
      demo={isDemoBuild}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre.
        complete();
        router.replace('/');
      }}
    />
  );
}
