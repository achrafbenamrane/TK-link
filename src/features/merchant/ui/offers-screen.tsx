import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { CATEGORY_INFO } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import {
  canPublish,
  COMMISSION_PCT,
  commissionCents,
  formatCents,
  freeLeft,
  netCents,
  operationsLeft,
} from '../lib/billing';
import { discountPct, secondsLeft, soldCents, STATE_LABEL, stateOf } from '../lib/offers';
import { selectOffers, selectPurchased, selectUsed, useMerchantStore } from '../model/store';
import type { Audience, OfferDraft, PublishedOffer } from '../model/schema';
import { PublishForm } from './publish-form';

type Props = {
  /**
   * À qui ce compte publie — CDC §20. Le commerçant vend aux clients, le
   * grossiste aux commerçants. La ROUTE le déduit du rôle : la feature n'a pas
   * le profil sous la main.
   */
  audience?: Audience;
  /** Nom affiché sur les lots B2B, où l'acheteur ne connaît pas l'enseigne. */
  seller?: string;
  /** Nom du commerce, montré dans l'aperçu en direct du Flash. */
  shopName?: string;
  onBack?: () => void;
};

/** Le vocabulaire change avec le public : on ne vend pas un lot comme un plat. */
const COPY: Record<Audience, { title: string; subtitle: string; cta: string; empty: string }> = {
  clients: {
    title: 'Mes ventes flash',
    subtitle: 'Ce que vos clients voient dans l’app.',
    cta: 'Publier une vente flash',
    empty:
      'Publiez ce qui ne passera pas la nuit : les clients du quartier le verront immédiatement.',
  },
  commercants: {
    title: 'Mes lots',
    subtitle: 'Ce que les commerçants voient dans l’app.',
    cta: 'Publier un lot',
    empty:
      'Publiez vos fins de série : les commerçants de la plateforme les verront immédiatement.',
  },
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
export function MerchantOffersScreen({
  audience = 'clients',
  seller = '',
  shopName,
  onBack,
}: Props) {
  const colors = useColors();
  const copy = COPY[audience];
  const [mode, setMode] = useState<'list' | 'publish'>('list');
  const [now] = useState(() => Date.now());

  const offers = useMerchantStore(selectOffers);
  const used = useMerchantStore(selectUsed);
  const purchased = useMerchantStore(selectPurchased);
  const publish = useMerchantStore((s) => s.publish);
  const takeOffline = useMerchantStore((s) => s.takeOffline);

  const wholesale = audience === 'commercants';
  const left = operationsLeft(used, purchased);
  const free = freeLeft(used);
  // Le quota ne vaut que pour les Flash du commerçant : un lot de grossiste n'en dépend pas.
  const allowed = wholesale || canPublish(used, purchased);

  const revenue = useMemo(() => offers.reduce((sum, o) => sum + soldCents(o), 0), [offers]);
  const liveCount = offers.filter((o) => o.state === 'publiee' && !o.offline).length;

  const onPublish = (draft: OfferDraft) => {
    const result = publish({ ...draft, audience }, seller);
    if (!result.ok) {
      Alert.alert(
        'Quota épuisé',
        'Vos opérations gratuites sont utilisées. Les packs complémentaires seront proposés dès que leur tarification sera arrêtée.',
      );
      return;
    }
    setMode('list');

    // Le message dit ce qui vient de se passer, pas ce qu'on espérait. Annoncer
    // « en ligne » pour un brouillon ou une offre programmée ferait attendre
    // des ventes qui ne peuvent pas venir.
    const pour = audience === 'clients' ? 'des clients' : 'des commerçants';
    if (result.offer.state === 'brouillon') {
      Alert.alert(
        'Brouillon enregistré',
        `« ${result.offer.title} » est gardée de côté. Aucune opération n’a été consommée.`,
      );
    } else if (result.offer.startsAt > 0) {
      Alert.alert(
        'Programmée ⏱',
        `« ${result.offer.title} » s’ouvrira toute seule et sera alors visible ${pour}.`,
      );
    } else {
      Alert.alert('En ligne 🎉', `« ${result.offer.title} » est visible ${pour}.`);
    }
  };

  if (mode === 'publish') {
    return (
      <Screen testID="merchant-publish" padded={false}>
        <PublishForm
          onPublish={onPublish}
          onCancel={() => setMode('list')}
          {...(shopName ? { shopName } : {})}
          wholesale={audience === 'commercants'}
          title={audience === 'clients' ? 'Nouveau Flash' : 'Nouvelle offre pro'}
          subtitle={`${left} opération${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`}
        />
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
              {copy.title}
            </AppText>
            <AppText variant="caption" className="mt-0.5">
              {copy.subtitle}
            </AppText>
          </View>
        </View>

        {/* Le quota — CDC §9 (Flash du commerçant) ou, pour le grossiste, ses lots en ligne */}
        <View className="mx-5 gap-3 rounded-card bg-surface-inverse p-4">
          {wholesale ? (
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <AppText className="font-display text-ink-inverse" style={{ fontSize: 15 }}>
                  {liveCount} lot{liveCount > 1 ? 's' : ''} en ligne
                </AppText>
                <AppText variant="caption" className="mt-0.5 text-ink-inverse/60">
                  Commission TK LINK de {COMMISSION_PCT} % déduite de chaque vente.
                </AppText>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-pill bg-accent">
                <AppText
                  testID="merchant-live-lots"
                  className="font-display text-surface-inverse"
                  style={{ fontSize: 17 }}
                >
                  {liveCount}
                </AppText>
              </View>
            </View>
          ) : (
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
              <View className="h-12 w-12 items-center justify-center rounded-pill bg-accent">
                <AppText
                  testID="merchant-quota"
                  className="font-display text-surface-inverse"
                  style={{ fontSize: 17 }}
                >
                  {left}
                </AppText>
              </View>
            </View>
          )}

          {revenue > 0 ? (
            <View className="flex-row items-center justify-between border-t border-ink-inverse/15 pt-2.5">
              <AppText className="text-ink-inverse/70" style={{ fontSize: 12.5 }}>
                Vendu · commission déduite
              </AppText>
              <AppText className="font-sans-bold text-accent" style={{ fontSize: 13 }}>
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
          accessibilityLabel={copy.cta}
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
            {allowed ? copy.cta : 'Quota épuisé'}
          </AppText>
        </Pressable>

        {/* Quota épuisé : aucun prix ici. La tarification des packs n'est PAS
            arrêtée (CDC V1.0 §14, V1.1 « points ouverts ») — on ne vend pas ce
            qu'on n'a pas le droit de chiffrer. */}
        {!allowed ? (
          <View
            testID="merchant-quota-empty"
            className="mx-5 mt-3 flex-row items-start gap-2.5 rounded-card bg-surface-muted p-3.5"
          >
            <Feather name="info" size={15} color={colors.inkFaint} />
            <AppText variant="caption" className="flex-1 text-ink-muted" style={{ fontSize: 12 }}>
              Vos opérations gratuites sont utilisées. Les packs complémentaires seront proposés dès
              que leur tarification sera arrêtée.
            </AppText>
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
              Rien de publié pour l’instant
            </AppText>
            <AppText variant="caption" className="text-center">
              {copy.empty}
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
            {offer.audience === 'commercants'
              ? `Lot${offer.minQty > 1 ? ` · min. ${offer.minQty}` : ''}`
              : `${CATEGORY_INFO[offer.category].emoji} ${CATEGORY_INFO[offer.category].short}`}
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
