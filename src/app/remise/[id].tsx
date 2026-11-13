import { useLocalSearchParams, useRouter } from 'expo-router';

import { HandoverScreen } from '@/features/shop';

/**
 * La remise d'une commande en livraison au coursier partenaire (Uber Direct), côté commerçant.
 * TK LINK n'a plus de livreurs à lui depuis le 13/11/2026 : la commande passe « En livraison »
 * quand le commerçant la confie au coursier.
 */
export default function HandoverRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return (
    <HandoverScreen
      orderId={id ?? ''}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/commandes'))}
    />
  );
}
