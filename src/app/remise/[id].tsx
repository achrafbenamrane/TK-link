import { useLocalSearchParams, useRouter } from 'expo-router';

import { useCourierStore, VEHICLE_LABEL } from '@/features/courier';
import { HandoverScreen } from '@/features/shop';

/**
 * La validation de la remise au livreur, côté commerçant. La route met en
 * relation le livreur (feature `courier`) et la commande (`shop`).
 *
 * Sans serveur, le livreur qui se présente est celui de CET appareil s'il s'est
 * inscrit ; sinon un livreur d'exemple, pour montrer l'écran.
 */
export default function HandoverRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const vehicle = useCourierStore((s) => s.vehicle);
  const status = useCourierStore((s) => s.status);

  const real = status === 'valide' && vehicle;
  return (
    <HandoverScreen
      orderId={id ?? ''}
      courier={{
        name: real ? 'Votre livreur' : 'Alex Martin',
        vehicle: real ? VEHICLE_LABEL[vehicle] : 'Vélo électrique',
        verified: true,
        present: true,
      }}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/commandes'))}
    />
  );
}
