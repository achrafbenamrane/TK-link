import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { discountPct, liquidationLabel, sortByUrgency, urgencyOf } from '../../lib/urgency';
import { DEALS, getMerchant } from '../../model/catalog';
import type { Deal } from '../../model/schema';
import { useShopStore } from '../../model/store';
import { Countdown } from './countdown';
import { PriceTag } from './price-tag';
import { ProductImage } from './product-image';

type Props = {
  /** Combien d'invendus montrer. Au-delà, le rail devient une liste. */
  limit?: number;
  /**
   * Appelé quand l'utilisateur attrape un invendu. La route s'en sert pour
   * créditer la chasse (XP, mission « attrapez une vente flash ») — le rail
   * ignore tout de la progression.
   */
  onCatch?: (dealId: string) => void;
};

/**
 * Dimensions de la carte, en pixels et NON en classes utilitaires.
 *
 * Même raison que sur la carte flash (`flash-card.tsx`) : une classe de taille
 * inédite est silencieusement ignorée par la feuille NativeWind déjà compilée
 * sur l'appareil, et le bloc s'effondre sans rien signaler. Une largeur dont
 * dépend la lisibilité ne se confie pas à un cache de styles.
 *
 * 232 et non 192 : à l'ancienne largeur, le prix barré et le bouton
 * « Attraper » se disputaient la même ligne et le bouton se faisait rogner —
 * on lisait « Att ».
 */
const CARD_WIDTH = 232;
const IMAGE_HEIGHT = 132;

/** Le fond du badge d'urgence : rouge pour la dernière chance, ink sinon. */
function badgeColor(deal: Deal): string {
  return urgencyOf(deal) === 'critique' ? colors.danger : colors.ink;
}

/**
 * LE DÉSTOCKAGE, en rail — les invendus les plus près de disparaître.
 *
 * L'accueil déroule tout le catalogue ; ici on ne garde que la pointe : ce qui
 * meurt dans les minutes qui viennent. C'est ce qui fait de l'onglet une
 * chasse — sans l'urgence en tête, ce ne serait qu'un carrousel de promotions.
 */
export function LiquidationRail({ limit = 8, onCatch }: Props) {
  const router = useRouter();
  const addToCart = useShopStore((s) => s.addToCart);
  const deals = useMemo(() => sortByUrgency(DEALS).slice(0, limit), [limit]);

  return (
    <ScrollView
      testID="liquidation-rail"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5"
    >
      {deals.map((deal) => {
        const merchant = getMerchant(deal.merchantId);
        const pct = discountPct(deal);
        const stockPct = deal.stockTotal > 0 ? (deal.stockLeft / deal.stockTotal) * 100 : 0;
        const low = deal.stockLeft <= deal.stockTotal * 0.25;

        return (
          <Pressable
            key={deal.id}
            testID={`liquidation-${deal.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${deal.title}, ${deal.price.toFixed(2)} euros`}
            onPress={() => router.push(`/produit/${deal.id}`)}
            style={{ width: CARD_WIDTH }}
            className="overflow-hidden rounded-card border border-line bg-surface"
          >
            <View
              className="items-center justify-center"
              style={{ height: IMAGE_HEIGHT, backgroundColor: deal.tint }}
            >
              <ProductImage deal={deal} emojiSize={44} />

              {/* Les deux pastilles du haut dans UNE rangée, pas deux calages
                  indépendants. Posées chacune dans son coin, elles se
                  rejoignaient dès que le libellé s'allongeait — « DERNIÈRE
                  CHANCE » touchait le compte à rebours. Une rangée ne peut pas
                  se chevaucher : elle répartit, et le libellé cède la place. */}
              <View className="absolute left-2 right-2 top-2 flex-row items-start justify-between gap-1.5">
                <View
                  className="rounded-pill px-2 py-0.5"
                  style={{ backgroundColor: badgeColor(deal), flexShrink: 1 }}
                >
                  <AppText
                    className="font-sans-bold text-ink-inverse"
                    style={{ fontSize: 9 }}
                    numberOfLines={1}
                  >
                    {liquidationLabel(deal).toUpperCase()}
                  </AppText>
                </View>

                <View
                  className="flex-row items-center gap-1 rounded-pill bg-ink/85 px-2 py-0.5"
                  style={{ flexShrink: 0 }}
                >
                  <Feather name="clock" size={9} color={colors.inkInverse} />
                  <Countdown seconds={deal.endsInSeconds} className="text-xs text-ink-inverse" />
                </View>
              </View>

              {pct ? (
                <View className="absolute bottom-2 left-2 rounded-control bg-brand-500 px-2 py-0.5">
                  <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 11 }}>
                    -{pct}%
                  </AppText>
                </View>
              ) : null}
            </View>

            <View className="gap-1.5 p-3">
              <AppText variant="caption" className="text-ink-faint" numberOfLines={1}>
                {merchant?.emoji} {merchant?.name}
              </AppText>
              <AppText
                className="font-sans-semibold text-ink"
                style={{ fontSize: 13 }}
                numberOfLines={1}
              >
                {deal.title}
              </AppText>

              <View className="mt-0.5 gap-1">
                <View className="h-1 overflow-hidden rounded-pill bg-surface-sunken">
                  <View
                    className={cn('h-full rounded-pill', low ? 'bg-danger' : 'bg-ink')}
                    style={{ width: `${Math.max(6, Math.round(stockPct))}%` }}
                  />
                </View>
                <AppText
                  variant="caption"
                  className={cn(low ? 'font-sans-semibold text-danger' : 'text-ink-faint')}
                  style={{ fontSize: 10.5 }}
                >
                  {deal.stockLeft > 0 ? `Plus que ${deal.stockLeft}` : 'Épuisé'}
                </AppText>
              </View>

              {/* Le prix rétrécit, le bouton jamais.
                  Sans contrainte, c'est LE BOUTON que le moteur de mise en page
                  rogne quand la ligne déborde — on lisait « Att ». Un prix
                  tronqué se remarque ; un bouton tronqué ne se tape plus.
                  En `style` et non en classes `shrink` : celles-ci n'existent
                  nulle part ailleurs dans le projet, donc elles ne vaudraient
                  rien tant que Metro n'a pas recompilé la feuille — le piège
                  décrit dans docs/architecture/styling.md. */}
              <View className="mt-0.5 flex-row items-center justify-between gap-2">
                <View style={{ flexShrink: 1 }}>
                  <PriceTag price={deal.price} oldPrice={deal.oldPrice} size={17} />
                </View>

                <Pressable
                  testID={`liquidation-catch-${deal.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Attraper ${deal.title}`}
                  disabled={deal.stockLeft <= 0}
                  onPress={() => {
                    addToCart(deal.id);
                    onCatch?.(deal.id);
                  }}
                  style={{ flexShrink: 0 }}
                  className={cn(
                    'flex-row items-center gap-1 rounded-pill px-3 py-2 active:opacity-85',
                    deal.stockLeft > 0 ? 'bg-brand-500' : 'bg-surface-sunken',
                  )}
                >
                  <Feather
                    name="zap"
                    size={12}
                    color={deal.stockLeft > 0 ? colors.inkInverse : colors.inkFaint}
                  />
                  <AppText
                    className={cn(
                      'font-sans-bold',
                      deal.stockLeft > 0 ? 'text-ink-inverse' : 'text-ink-faint',
                    )}
                    style={{ fontSize: 11 }}
                  >
                    Attraper
                  </AppText>
                </Pressable>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
