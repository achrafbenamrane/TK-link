import { useRouter } from 'expo-router';

import { ProSetupScreen } from '@/features/merchant';
import { useAuthStore } from '@/features/auth';
import { selectRole, selectSiret, useOnboardingStore } from '@/features/onboarding';
import { authenticateBiometric, useShopStore } from '@/features/shop';
import { isDemoShortcutAvailable } from '@/shared/lib/env';

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
  const saveOnboarding = useAuthStore((s) => s.saveOnboarding);
  const siret = useOnboardingStore(selectSiret);
  const role = useOnboardingStore(selectRole);
  const application = useShopStore((s) => s.merchantApplication);

  return (
    <ProSetupScreen
      role={role === 'commercant' ? 'commercant' : 'grossiste'}
      siret={siret}
      address={application?.address ?? ''}
      // Le commerce décrit à l'inscription part au serveur avec le dossier (table `shops`).
      {...(application
        ? {
            shop: {
              name: application.shopName,
              category: application.category,
              area: application.area,
              modes: application.modes,
            },
          }
        : {})}
      // IBAN d'exemple et validation simulée : démonstration SANS serveur seulement — avec un
      // serveur, c'est TK LINK qui valide.
      initialIban={isDemoShortcutAvailable ? DEMO_IBAN : ''}
      demo={isDemoShortcutAvailable}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onDone={() => {
        // Le compte est prêt : la porte du premier lancement s'ouvre — et le compte s'en souvient.
        complete();
        void saveOnboarding(useOnboardingStore.getState().interests);
        router.replace('/');
      }}
    />
  );
}
