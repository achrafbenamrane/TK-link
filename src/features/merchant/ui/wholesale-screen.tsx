import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { CATEGORY_INFO } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { formatCents } from '../lib/billing';
import { discountPct, liveOffers, secondsLeft } from '../lib/offers';
import type { PublishedOffer } from '../model/schema';
import { selectLots, selectOffers, selectWholesaleOrders, useMerchantStore } from '../model/store';

type Props = {
  /**
   * Ce qui empêche de commander, s'il y a lieu — CDC §5. Calculé par la ROUTE
   * à partir du rôle et du SIRET : la feature n'a pas le profil sous la main.
   * `null` = la commande est ouverte.
   */
  blockedReason?: string | null;
  /** Aller renseigner son SIRET — proposé quand c'est lui qui bloque. */
  onFixProfile?: () => void;
  onBack?: () => void;
};

function timeLabel(seconds: number): string {
  if (seconds <= 0) return 'terminé';
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) return `${Math.floor(hours / 24)} j`;
  return hours > 0 ? `${hours} h` : `${Math.ceil(seconds / 60)} min`;
}

/**
 * LE MARCHÉ DES GROSSISTES — CDC §20.
 *
 * « Les grossistes proposent des lots aux commerçants. » C'est le même geste
 * que la vente flash, un cran plus haut dans la chaîne : on y achète pour
 * revendre, donc les quantités sont des lots et les durées des jours.
 *
 * Le blocage du §5 (pas de commande sans SIRET) s'affiche EN HAUT et non au
 * moment du clic : découvrir qu'on ne peut pas commander après avoir choisi
 * son lot et sa quantité est la pire façon de l'apprendre.
 */
export function WholesaleScreen({ blockedReason = null, onFixProfile, onBack }: Props) {
  const [now] = useState(() => Date.now());
  const lots = useMerchantStore(selectLots);
  const mine = useMerchantStore(selectOffers);
  const orders = useMerchantStore(selectWholesaleOrders);
  const orderLot = useMerchantStore((s) => s.orderLot);

  // Le marché, plus mes propres annonces B2B si j'en ai publié. Mémo et non
  // sélecteur abonné : un tableau recalculé ferait boucler Zustand 5.
  const market = useMemo(() => {
    const b2b = mine.filter((o) => o.audience === 'commercants');
    return liveOffers([...lots, ...b2b], now);
  }, [lots, mine, now]);

  const spent = useMemo(() => orders.reduce((sum, o) => sum + o.totalCents, 0), [orders]);

  const order = (lot: PublishedOffer) => {
    if (blockedReason) return;
    Alert.alert(
      lot.title,
      `Commander 1 lot à ${formatCents(lot.priceCents)} chez ${lot.seller || 'ce grossiste'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Commander',
          onPress: () => {
            const result = orderLot(lot.id, 1);
            if (!result.ok) {
              Alert.alert('Impossible', 'Ce lot vient de partir.');
              return;
            }
            Alert.alert(
              'Commande passée',
              `${result.order.qty} lot — ${formatCents(result.order.totalCents)}.\n\nLe grossiste est prévenu.`,
            );
          },
        },
      ],
    );
  };

  return (
    <Screen testID="wholesale-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          {onBack ? (
            <Pressable
              testID="wholesale-back"
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={10}
              onPress={onBack}
            >
              <Feather name="chevron-left" size={26} color={colors.ink} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Lots des grossistes
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              Réservé aux commerçants — CDC §20.
            </AppText>
          </View>
        </View>

        {/* Le blocage du §5, annoncé avant qu'on choisisse quoi que ce soit. */}
        {blockedReason ? (
          <Pressable
            testID="wholesale-blocked"
            accessibilityRole="button"
            accessibilityLabel={blockedReason}
            onPress={onFixProfile}
            disabled={!onFixProfile}
            className="mx-5 mb-3 flex-row items-center gap-3 rounded-card border border-line bg-surface-muted p-4"
          >
            <Feather name="lock" size={17} color={colors.brand600} />
            <AppText variant="caption" className="flex-1 text-ink-muted">
              {blockedReason}
            </AppText>
            {onFixProfile ? (
              <Feather name="chevron-right" size={17} color={colors.inkFaint} />
            ) : null}
          </Pressable>
        ) : null}

        {orders.length > 0 ? (
          <View
            testID="wholesale-summary"
            className="mx-5 mb-3 flex-row items-center justify-between rounded-card bg-surface-inverse p-4"
          >
            <View>
              <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 13.5 }}>
                {orders.length} commande{orders.length > 1 ? 's' : ''} en gros
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                Dernière : {orders[0]!.title}
              </AppText>
            </View>
            <AppText className="font-display text-lime" style={{ fontSize: 17 }}>
              {formatCents(spent)}
            </AppText>
          </View>
        ) : null}

        {market.length === 0 ? (
          <View testID="wholesale-empty" className="mt-8 items-center gap-2 px-10">
            <Feather name="package" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              Aucun lot disponible
            </AppText>
            <AppText variant="caption" className="text-center">
              Les grossistes publient leurs fins de série au fil de la semaine.
            </AppText>
          </View>
        ) : (
          <View className="gap-3 px-5">
            {market.map((lot) => {
              const pct = discountPct(lot);
              return (
                <View
                  key={lot.id}
                  testID={`lot-${lot.id}`}
                  className="overflow-hidden rounded-card border border-line bg-surface p-4"
                >
                  <View className="flex-row items-start gap-2">
                    <View className="flex-1">
                      <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                        {lot.title}
                      </AppText>
                      <AppText variant="caption" className="mt-0.5 text-ink-faint">
                        {CATEGORY_INFO[lot.category].emoji} {lot.seller || 'Grossiste'} ·{' '}
                        {timeLabel(secondsLeft(lot, now))}
                      </AppText>
                    </View>
                    {pct ? (
                      <View className="rounded-control bg-ink px-2 py-1">
                        <AppText
                          className="font-sans-bold text-ink-inverse"
                          style={{ fontSize: 10.5 }}
                        >
                          -{pct}%
                        </AppText>
                      </View>
                    ) : null}
                  </View>

                  {lot.description ? (
                    <AppText variant="caption" className="mt-1.5 text-ink-muted">
                      {lot.description}
                    </AppText>
                  ) : null}

                  <View className="mt-3 flex-row items-end justify-between">
                    <View>
                      <View className="flex-row items-baseline gap-2">
                        <AppText className="font-display text-ink" style={{ fontSize: 19 }}>
                          {formatCents(lot.priceCents)}
                        </AppText>
                        <AppText variant="caption" className="text-ink-faint line-through">
                          {formatCents(lot.oldPriceCents)}
                        </AppText>
                      </View>
                      <AppText
                        variant="caption"
                        className="text-ink-faint"
                        style={{ fontSize: 11.5 }}
                      >
                        le lot · {lot.stockLeft} disponible{lot.stockLeft > 1 ? 's' : ''}
                      </AppText>
                    </View>

                    <Pressable
                      testID={`lot-order-${lot.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Commander ${lot.title}`}
                      disabled={Boolean(blockedReason)}
                      onPress={() => order(lot)}
                      className={cn(
                        'flex-row items-center gap-1.5 rounded-pill px-4 py-2.5',
                        blockedReason ? 'bg-surface-sunken' : 'bg-brand-500 active:bg-brand-600',
                      )}
                    >
                      <Feather
                        name={blockedReason ? 'lock' : 'shopping-bag'}
                        size={14}
                        color={blockedReason ? colors.inkFaint : colors.inkInverse}
                      />
                      <AppText
                        className={cn(
                          'font-sans-bold',
                          blockedReason ? 'text-ink-faint' : 'text-ink-inverse',
                        )}
                        style={{ fontSize: 12.5 }}
                      >
                        Commander
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
