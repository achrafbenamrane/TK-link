import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { formatDiscount } from '../lib/coupons';
import type { HeldCoupon } from '../model/schema';

/**
 * Un coupon dessiné comme un vrai ticket : bloc réduction à gauche, code à
 * droite, séparés par une ligne perforée et deux encoches. La forme dit
 * « coupon » d'un coup d'œil, sans avoir à lire.
 *
 * ⚠️ La hauteur est FIXE, et c'est délibéré. Le ticket n'en imposait aucune :
 * dans une liste, il s'étirait pour occuper la place libre, et un portefeuille
 * ne contenant qu'un coupon affichait une carte haute d'un demi-écran. Un
 * ticket a la taille d'un ticket, quel que soit le nombre de ses voisins.
 */
const HEIGHT = 84;
export function CouponTicket({ coupon }: { coupon: HeldCoupon }) {
  const used = coupon.usedAt !== null;
  const fromGame = coupon.source === 'game';

  return (
    <View
      testID={`coupon-${coupon.id}`}
      style={{ height: HEIGHT }}
      className={cn(
        'mb-2.5 flex-row overflow-hidden rounded-card border',
        used ? 'border-line bg-surface-muted' : 'border-brand-200 bg-surface',
      )}
    >
      {/* Bloc réduction */}
      <View
        className={cn(
          'w-24 items-center justify-center px-2',
          used ? 'bg-surface-sunken' : 'bg-brand-500',
        )}
      >
        <AppText
          className={cn('font-display', used ? 'text-ink-faint' : 'text-ink-inverse')}
          style={{ fontSize: coupon.discount.kind === 'percent' ? 20 : 17, lineHeight: 24 }}
        >
          {formatDiscount(coupon.discount)}
        </AppText>
        <AppText
          variant="caption"
          className={cn('mt-0.5 text-[10px]', used ? 'text-ink-faint' : 'text-ink-inverse/80')}
        >
          {coupon.discount.kind === 'percent' ? 'de remise' : 'offerts'}
        </AppText>
      </View>

      {/* Perforation : deux encoches + pointillé */}
      <View className="items-center justify-center">
        <View className="absolute -top-2 h-4 w-4 rounded-pill bg-surface-muted" />
        <View className="h-full border-l border-dashed border-line" />
        <View className="absolute -bottom-2 h-4 w-4 rounded-pill bg-surface-muted" />
      </View>

      {/* Code + contexte */}
      <View className="flex-1 justify-center gap-0.5 px-3.5">
        <View className="flex-row items-center gap-1.5">
          <Feather
            name={fromGame ? 'award' : 'tag'}
            size={11}
            color={used ? colors.inkFaint : colors.brand500}
          />
          <AppText variant="caption" className="text-[11px] text-ink-faint">
            {coupon.label || (fromGame ? 'Gagné en jouant' : 'Code promo')}
          </AppText>
        </View>

        <AppText
          className={cn(
            'font-display tracking-wide',
            used ? 'text-ink-faint line-through' : 'text-ink',
          )}
          style={{ fontSize: 15.5, lineHeight: 20 }}
        >
          {coupon.code}
        </AppText>

        <AppText
          variant="caption"
          className={cn('text-[11px]', used ? 'text-ink-faint' : 'text-success')}
        >
          {used ? 'Déjà utilisé' : 'À usage unique · valable à la commande'}
        </AppText>
      </View>
    </View>
  );
}
