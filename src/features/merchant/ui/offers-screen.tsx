import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { CATEGORY_INFO } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  canPublish,
  commissionCents,
  formatCents,
  freeLeft,
  netCents,
  operationsLeft,
  PACKS,
  unitPriceCents,
} from '../lib/billing';
import { discountPct, secondsLeft, soldCents, STATE_LABEL, stateOf } from '../lib/offers';
import { selectOffers, selectPurchased, selectUsed, useMerchantStore } from '../model/store';
import type { OfferDraft, PublishedOffer } from '../model/schema';
import { PublishForm } from './publish-form';

type Props = {
  onBack?: () => void;
};

/** Couleur de la pastille d'état. Une offre en ligne doit sauter aux yeux. */
const STATE_CLASS: Record<string, string> = {
  'en-ligne': 'bg-brand-50 text-brand-700',
  epuisee: 'bg-surface-sunken text-ink-muted',
  terminee: 'bg-surface-sunken text-ink-muted',
  retiree: 'bg-surface-sunken text-ink-faint',
};

function timeLabel(seconds: number): string {
  if (seconds <= 0) return 'terminée';
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
}

/**
 * MES VENTES FLASH — l'espace du commerçant (CDC §9).
 *
 * Deux informations dominent, parce que ce sont les deux questions qu'il se
 * pose : combien d'opérations me reste-t-il, et qu'est-ce que mes offres ont
 * rapporté. Le reste est du détail.
 *
 * L'écran fait aussi le service après-vente du modèle économique : le quota du
 * §9 et la commission du §21 s'affichent AVANT d'être subis, jamais après.
 */
export function MerchantOffersScreen({ onBack }: Props) {
  const [mode, setMode] = useState<'list' | 'publish'>('list');
  const [now] = useState(() => Date.now());

  const offers = useMerchantStore(selectOffers);
  const used = useMerchantStore(selectUsed);
  const purchased = useMerchantStore(selectPurchased);
  const publish = useMerchantStore((s) => s.publish);
  const takeOffline = useMerchantStore((s) => s.takeOffline);
  const buyPack = useMerchantStore((s) => s.buyPack);

  const left = operationsLeft(used, purchased);
  const free = freeLeft(used);
  const allowed = canPublish(used, purchased);

  const revenue = useMemo(() => offers.reduce((sum, o) => sum + soldCents(o), 0), [offers]);

  const onPublish = (draft: OfferDraft) => {
    const result = publish(draft);
    if (!result.ok) {
      Alert.alert(
        'Quota épuisé',
        'Vos opérations sont consommées. Prenez un pack pour continuer à publier.',
      );
      return;
    }
    setMode('list');
    Alert.alert('En ligne 🎉', `« ${result.offer.title} » est visible dans l’app des clients.`);
  };

  const onBuy = (packId: string) => {
    const pack = PACKS.find((p) => p.id === packId);
    if (!pack) return;
    Alert.alert(
      pack.label,
      `${pack.operations} opérations pour ${formatCents(pack.priceCents)}.\n\nLe paiement arrivera avec le back-office ; le pack est crédité immédiatement pour la démonstration.`,
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Créditer', onPress: () => buyPack(packId) },
      ],
    );
  };

  if (mode === 'publish') {
    return (
      <Screen testID="merchant-publish" padded={false}>
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          <Pressable
            testID="merchant-publish-back"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={10}
            onPress={() => setMode('list')}
          >
            <Feather name="chevron-left" size={26} color={colors.ink} />
          </Pressable>
          <View className="flex-1">
            <AppText variant="display" className="text-2xl">
              Nouvelle vente flash
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {left} opération{left > 1 ? 's' : ''} restante{left > 1 ? 's' : ''}
            </AppText>
          </View>
        </View>
        <PublishForm onPublish={onPublish} onCancel={() => setMode('list')} />
      </Screen>
    );
  }

  return (
    <Screen testID="merchant-offers" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-2">
          {onBack ? (
            <Pressable
              testID="merchant-back"
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
              Mes ventes flash
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              Ce que vos clients voient dans l’app.
            </AppText>
          </View>
        </View>

        {/* Le quota — CDC §9 */}
        <View className="mx-5 gap-3 rounded-card bg-surface-inverse p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <AppText className="font-display text-ink-inverse" style={{ fontSize: 15 }}>
                {left} opération{left > 1 ? 's' : ''} disponible{left > 1 ? 's' : ''}
              </AppText>
              <AppText variant="caption" className="mt-0.5 text-ink-inverse/60">
                {free > 0
                  ? `Dont ${free} offerte${free > 1 ? 's' : ''} — les 5 premières sont gratuites.`
                  : 'Vos opérations gratuites sont consommées.'}
              </AppText>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-pill bg-lime">
              <AppText
                testID="merchant-quota"
                className="font-display text-forest"
                style={{ fontSize: 17 }}
              >
                {left}
              </AppText>
            </View>
          </View>

          {revenue > 0 ? (
            <View className="flex-row items-center justify-between border-t border-ink-inverse/15 pt-2.5">
              <AppText className="text-ink-inverse/70" style={{ fontSize: 12.5 }}>
                Vendu · commission déduite
              </AppText>
              <AppText className="font-sans-bold text-lime" style={{ fontSize: 13 }}>
                {formatCents(netCents(revenue))}
                <AppText className="text-ink-inverse/50" style={{ fontSize: 11 }}>
                  {'  '}sur {formatCents(revenue)}
                </AppText>
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Publier */}
        <Pressable
          testID="merchant-new-offer"
          accessibilityRole="button"
          accessibilityLabel="Publier une vente flash"
          disabled={!allowed}
          onPress={() => setMode('publish')}
          className={cn(
            'mx-5 mt-3 flex-row items-center justify-center gap-2 rounded-control py-4',
            allowed ? 'bg-brand-500 active:bg-brand-600' : 'bg-surface-sunken',
          )}
        >
          <Feather
            name={allowed ? 'plus' : 'lock'}
            size={17}
            color={allowed ? colors.inkInverse : colors.inkFaint}
          />
          <AppText
            className={cn('font-sans-bold', allowed ? 'text-ink-inverse' : 'text-ink-faint')}
            style={{ fontSize: 15 }}
          >
            {allowed ? 'Publier une vente flash' : 'Quota épuisé'}
          </AppText>
        </Pressable>

        {/* Les packs — proposés quand il reste peu, pas en permanence */}
        {left <= 2 ? (
          <View testID="merchant-packs" className="mt-5">
            <View className="mb-2 px-5">
              <AppText variant="title" className="text-lg">
                Continuer à publier
              </AppText>
              <AppText variant="caption" className="mt-0.5 text-ink-faint">
                Les packs n’expirent pas. Le prix à l’opération baisse avec le volume.
              </AppText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-3 px-5"
            >
              {PACKS.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`merchant-pack-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}, ${p.operations} opérations`}
                  onPress={() => onBuy(p.id)}
                  className="w-40 gap-1 rounded-card border border-line bg-surface p-4 active:opacity-85"
                >
                  <AppText className="font-sans-bold text-ink" style={{ fontSize: 13.5 }}>
                    {p.label}
                  </AppText>
                  <AppText className="font-display text-brand-600" style={{ fontSize: 20 }}>
                    {p.operations}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    opérations
                  </AppText>
                  <View className="mt-1 border-t border-line pt-1.5">
                    <AppText className="font-sans-bold text-ink" style={{ fontSize: 14 }}>
                      {formatCents(p.priceCents)}
                    </AppText>
                    <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11 }}>
                      soit {formatCents(unitPriceCents(p))} l’unité
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Les offres */}
        <View className="mb-2 mt-6 px-5">
          <AppText variant="title" className="text-lg">
            Mes offres
          </AppText>
        </View>

        {offers.length === 0 ? (
          <View testID="merchant-empty" className="mt-4 items-center gap-2 px-10">
            <Feather name="zap" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="mt-1 text-center text-base">
              Aucune vente flash pour l’instant
            </AppText>
            <AppText variant="caption" className="text-center">
              Publiez ce qui ne passera pas la nuit : les clients du quartier le verront
              immédiatement.
            </AppText>
          </View>
        ) : (
          <View className="gap-3 px-5">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} now={now} onTakeOffline={() => takeOffline(o.id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function OfferCard({
  offer,
  now,
  onTakeOffline,
}: {
  offer: PublishedOffer;
  now: number;
  onTakeOffline: () => void;
}) {
  const state = stateOf(offer, now);
  const pct = discountPct(offer);
  const sold = offer.stock - offer.stockLeft;
  const earned = soldCents(offer);

  return (
    <View
      testID={`merchant-offer-${offer.id}`}
      className="overflow-hidden rounded-card border border-line bg-surface p-4"
    >
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <AppText className="font-sans-bold text-ink" numberOfLines={1}>
            {offer.title}
          </AppText>
          <AppText variant="caption" className="mt-0.5 text-ink-faint">
            {CATEGORY_INFO[offer.category].emoji} {CATEGORY_INFO[offer.category].short}
            {state === 'en-ligne' ? ` · ${timeLabel(secondsLeft(offer, now))}` : ''}
          </AppText>
        </View>
        <View className={cn('rounded-pill px-2.5 py-1', STATE_CLASS[state]?.split(' ')[0])}>
          <AppText
            className={cn('font-sans-bold', STATE_CLASS[state]?.split(' ')[1])}
            style={{ fontSize: 10 }}
          >
            {STATE_LABEL[state].toUpperCase()}
          </AppText>
        </View>
      </View>

      <View className="mt-2 flex-row items-baseline gap-2">
        <AppText className="font-display text-ink" style={{ fontSize: 18 }}>
          {formatCents(offer.priceCents)}
        </AppText>
        <AppText variant="caption" className="text-ink-faint line-through">
          {formatCents(offer.oldPriceCents)}
        </AppText>
        {pct ? (
          <View className="rounded-control bg-brand-500 px-2 py-0.5">
            <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10.5 }}>
              -{pct}%
            </AppText>
          </View>
        ) : null}
      </View>

      <View className="mt-2.5 gap-1">
        <View className="h-1.5 overflow-hidden rounded-pill bg-surface-sunken">
          <View
            className="h-full rounded-pill bg-brand-500"
            style={{ width: `${Math.round((sold / Math.max(1, offer.stock)) * 100)}%` }}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <AppText variant="caption" className="text-ink-faint" style={{ fontSize: 11.5 }}>
            {sold} vendu{sold > 1 ? 's' : ''} sur {offer.stock}
          </AppText>
          {earned > 0 ? (
            <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 11.5 }}>
              {formatCents(netCents(earned))} net
              <AppText className="text-ink-faint" style={{ fontSize: 10.5 }}>
                {' '}
                (−{formatCents(commissionCents(earned))})
              </AppText>
            </AppText>
          ) : null}
        </View>
      </View>

      {state === 'en-ligne' ? (
        <Pressable
          testID={`merchant-offline-${offer.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${offer.title}`}
          onPress={onTakeOffline}
          className="mt-3 items-center rounded-control border border-line py-2.5 active:bg-surface-muted"
        >
          <AppText className="font-sans-semibold text-ink-muted" style={{ fontSize: 12.5 }}>
            Retirer de l’app
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
