import { useRouter } from 'expo-router';

import { WholesalerSetupScreen } from '@/features/merchant';
import { selectSiret, useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric, useShopStore } from '@/features/shop';

/**
 * DÉMONSTRATION : l'IBAN s'affiche déjà rempli (un numéro d'exemple, clé valide), comme
 * l'inscription — le client teste sans rien saisir. À retirer avec la démonstration.
 */
const DEMO_IBAN = 'FR76 3000 6000 0112 3456 7890 189';

/**
 * Le dépôt des informations pro, la vérification et la sécurisation du fournisseur —
 * étapes 3 à 6 du « Process grossiste / fournisseur » du client. L'authentification locale
 * est celle du téléphone (`shop`), passée en props : `merchant` n'importe pas la boutique.
 */
export default function BecomeSupplierRoute() {
  const router = useRouter();
  const complete = useOnboardingStore((s) => s.complete);
  const siret = useOnboardingStore(selectSiret);
  const application = useShopStore((s) => s.merchantApplication);

  return (
    <WholesalerSetupScreen
      siret={siret}
      address={application?.address ?? ''}
      initialIban={DEMO_IBAN}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre.
        complete();
        router.replace('/');
      }}
    />
  );
}
