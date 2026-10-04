import { useRouter } from 'expo-router';

import { ShopSettingsScreen } from '@/features/merchant';
import { LOCAL_MERCHANT_ID } from '@/features/shop';

/**
 * La boutique du commerçant : présentation, horaires, photos, vidéos, zone, modes de
 * remise — étape 7 du parcours du client. « Voir ma vitrine » ouvre la fiche telle
 * que ses clients la voient.
 */
export default function ShopRoute() {
  const router = useRouter();
  return (
    <ShopSettingsScreen
      onPreview={() =>
        router.push({ pathname: '/enseigne/[id]', params: { id: LOCAL_MERCHANT_ID } })
      }
    />
  );
}
