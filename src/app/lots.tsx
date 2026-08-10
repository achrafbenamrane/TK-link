import { useRouter } from 'expo-router';

import { WholesaleScreen } from '@/features/merchant';
import { selectRole, selectSiret, useOnboardingStore } from '@/features/onboarding';
import { WHOLESALE_BLOCK_MESSAGE, wholesaleOrderBlock } from '@/shared/lib/roles';

/**
 * LE MARCHÉ B2B — CDC §20, gardé par le §5.
 *
 * La route croise le profil (rôle + SIRET, feature `onboarding`) avec le
 * marché (feature `merchant`). Le CDC est catégorique : « un commerçant ne
 * doit pas pouvoir passer une commande auprès d'un grossiste sans avoir
 * renseigné son SIRET ». La règle vit dans `shared/lib/roles`, testée à part ;
 * ici on ne fait que la brancher.
 */
export default function LotsRoute() {
  const router = useRouter();
  const role = useOnboardingStore(selectRole);
  const siret = useOnboardingStore(selectSiret);

  const block = wholesaleOrderBlock(role, siret);

  return (
    <WholesaleScreen
      blockedReason={block ? WHOLESALE_BLOCK_MESSAGE[block] : null}
      // Un SIRET manquant se répare en trente secondes : on y mène.
      onFixProfile={block === 'siret' ? () => router.push('/sign-up') : undefined}
      onBack={() => router.back()}
    />
  );
}
