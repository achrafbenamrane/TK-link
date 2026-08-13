import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, Pressable, View } from 'react-native';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { selectWallet, useCouponsStore } from '../model/store';
import { CouponTicket } from './coupon-ticket';

/**
 * LE PORTEFEUILLE — ce qu'on possède, et rien d'autre.
 *
 * La saisie d'un code promo n'est plus ici : elle vit dans La Chasse, à côté
 * des jeux, parce qu'un code arrive par un flyer ou par Instagram et se perd
 * si l'on doit le chercher trois écrans plus loin. Cette page ne fait donc
 * qu'une chose — montrer les coupons détenus — et le dit à qui vient avec un
 * code en main plutôt que de le laisser chercher un champ absent.
 */
export function CouponsScreen() {
  const router = useRouter();
  const wallet = useCouponsStore(selectWallet);
  const available = wallet.filter((c) => c.usedAt === null);

  return (
    <Screen testID="coupons-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="pb-4 pt-2">
          <AppText variant="display" className="text-3xl">
            Mes coupons
          </AppText>
          <AppText variant="caption" className="mt-1">
            Gagnés en jouant, ou reçus par code.
          </AppText>
        </View>

        {/* Les deux sources, dans l'ordre où elles servent. */}
        <Pressable
          testID="coupon-play"
          accessibilityRole="button"
          accessibilityLabel="Jouer pour gagner des coupons"
          onPress={() => router.push('/jeux')}
          className="mb-2.5 flex-row items-center gap-3 rounded-card bg-ink p-3.5 active:opacity-90"
        >
          <View className="h-10 w-10 items-center justify-center rounded-pill bg-brand-500">
            <Feather name="gift" size={18} color={colors.inkInverse} />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 14 }}>
              Jouez, gagnez des coupons
            </AppText>
            <AppText variant="caption" className="text-ink-inverse/60" style={{ fontSize: 11.5 }}>
              Cartes mémoire, quiz… un coupon à gagner.
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.inkInverse} />
        </Pressable>

        {/* Où saisir un code — la question qu'on se pose EN ARRIVANT ici. */}
        <Pressable
          testID="coupon-goto-promo"
          accessibilityRole="button"
          accessibilityLabel="Saisir un code promo dans La Chasse"
          onPress={() => router.push('/chasse')}
          className="mb-5 flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-3.5 active:opacity-80"
        >
          <Feather name="tag" size={16} color={colors.brand600} />
          <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12.5 }}>
            Vous avez un code ? Il se saisit dans{' '}
            <AppText className="font-sans-bold">La Chasse</AppText>.
          </AppText>
          <Feather name="chevron-right" size={16} color={colors.inkFaint} />
        </Pressable>

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
