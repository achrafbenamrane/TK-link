import { Feather } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { colors } from '@/shared/theme/colors';

import { selectWallet, useCouponsStore } from '../model/store';
import { CouponTicket } from './coupon-ticket';

/**
 * LE PORTEFEUILLE — ce qu'on possède, et RIEN d'autre.
 *
 * Gagner des coupons se fait dans La Chasse : le champ de code et l'accès aux
 * jeux y sont réunis, et c'est de là qu'on arrive ici. Reproduire ces deux
 * raccourcis en tête de page les faisait pointer vers l'écran d'où l'on
 * venait — un aller-retour, pas un chemin. Une page qui montre une chose n'a
 * pas besoin de proposer autre chose avant de l'avoir montrée.
 *
 * Seul l'état vide garde une indication : là, il n'y a rien à regarder, et ne
 * rien dire laisserait devant un écran blanc.
 */
export function CouponsScreen() {
  const wallet = useCouponsStore(selectWallet);
  const available = wallet.filter((c) => c.usedAt === null);

  return (
    <Screen testID="coupons-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="pb-4 pt-2">
          <BackButton fallbackHref="/chasse" />
          <AppText variant="display" className="text-3xl">
            Mes coupons
          </AppText>
          <AppText variant="caption" className="mt-1">
            Gagnés en jouant, ou reçus par code.
          </AppText>
        </View>

        <View className="mb-2 flex-row items-baseline justify-between">
          <AppText variant="title" className="text-lg">
            Portefeuille
          </AppText>
          <AppText variant="caption" className="text-ink-faint">
            {available.length} disponible{available.length > 1 ? 's' : ''}
          </AppText>
        </View>

        {wallet.length === 0 ? (
          <View className="items-center px-8 pt-10" testID="coupons-empty">
            <Feather name="tag" size={28} color={colors.inkFaint} />
            <AppText variant="title" className="mt-3 text-center text-ink-faint">
              Aucun coupon pour l’instant
            </AppText>
            <AppText variant="caption" className="mt-1 text-center">
              Jouez pour en gagner un, ou saisissez un code dans La Chasse.
            </AppText>
          </View>
        ) : (
          wallet.map((c) => <CouponTicket key={c.id} coupon={c} />)
        )}
      </ScrollView>
    </Screen>
  );
}
