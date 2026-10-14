import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText, Screen, TextField, ThemeToggle, Wordmark } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { activeFilterCount, filterDeals } from '../lib/preferences';
import { splitByInterests } from '../lib/urgency';
import { dealsByCategory, getDeal, getMerchant, FEATURED_DEAL_ID } from '../model/catalog';
import type { Category, Deal } from '../model/schema';
import { getUserCoord } from '../lib/location';
import { useShopStore } from '../model/store';
import { CartButton } from './components/cart-button';
import { CategoryBar } from './components/category-bar';
import { Countdown } from './components/countdown';
import { FlashCard } from './components/flash-card';
import { PriceTag } from './components/price-tag';
import { ProductImage } from './components/product-image';
import { ViewSwitch, type HomeView } from './components/view-switch';
import { DealsMap } from './map-view';

/** Accès à « Ma Fan Zone » — la pastille compte les filtres actifs. */
function PreferencesButton() {
  const colors = useColors();
  const router = useRouter();
  const preferences = useShopStore((s) => s.preferences);
  const count = activeFilterCount(preferences);
  return (
    <Pressable
      testID="home-preferences"
      accessibilityRole="button"
      accessibilityLabel="Mes préférences de recherche"
      onPress={() => router.push('/preferences')}
      className="h-10 w-10 items-center justify-center rounded-pill bg-surface-muted"
    >
      <Feather name="sliders" size={18} color={colors.ink} />
      {count > 0 ? (
        <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-pill bg-brand-500 px-1">
          <AppText className="font-sans-bold text-ink-inverse" style={{ fontSize: 10 }}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Dit pourquoi la liste dépasse le rayon choisi.
 *
 * Sans ce bandeau, l'élargissement serait une tricherie silencieuse : on
 * afficherait des offres à 400 km en laissant croire qu'elles sont à côté.
 */
function RadiusNotice({ km }: { km: number }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      testID="home-radius-relaxed"
      accessibilityRole="button"
      accessibilityLabel={`Aucune offre à moins de ${km} kilomètres. Régler ma Fan Zone.`}
      onPress={() => router.push('/preferences')}
      className="mx-5 mt-4 flex-row items-center gap-2.5 rounded-control border border-line bg-surface-muted px-3.5 py-2.5"
    >
      <Feather name="navigation" size={15} color={colors.inkFaint} />
      <AppText variant="caption" className="flex-1 text-ink-muted">
        Rien à moins de {km} km d’ici — voici tout ce qui se déstocke.
      </AppText>
      <Feather name="chevron-right" size={16} color={colors.inkFaint} />
    </Pressable>
  );
}

function FeaturedBanner({ deal }: { deal: Deal }) {
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      testID="featured-deal"
      accessibilityRole="button"
      accessibilityLabel={`Vente flash : ${deal.title}`}
      onPress={() => router.push({ pathname: '/produit/[id]', params: { id: deal.id } })}
      className="mx-5 mb-4 flex-row items-center gap-3 rounded-card border border-brand-500 bg-surface-muted p-2.5"
    >
      <View
        className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-control"
        style={{ backgroundColor: deal.tint }}
      >
        <ProductImage deal={deal} emojiSize={42} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-1 self-start rounded-pill border border-brand-500 bg-brand-50 px-2 py-0.5">
          <Feather name="zap" size={10} color={colors.brand500} />
          <AppText className="font-sans-bold text-brand-600" style={{ fontSize: 9 }}>
            VENTE FLASH
          </AppText>
        </View>
        <View className="flex-row items-center gap-2.5">
          <Countdown seconds={deal.endsInSeconds} className="font-display text-brand-500" />
          <View className="flex-1">
            <AppText className="font-sans-bold text-ink" style={{ fontSize: 13 }} numberOfLines={2}>
              {deal.title}
            </AppText>
          </View>
        </View>
        <View className="flex-row items-center justify-end gap-1.5">
          <PriceTag
            testID="featured-deal-price"
            price={deal.price}
            oldPrice={deal.oldPrice}
            size={18}
            align="end"
          />
          <View className="h-6 w-6 items-center justify-center rounded-pill border border-brand-500">
            <Feather name="chevron-right" size={14} color={colors.brand500} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

type HomeScreenProps = {
  /** Vue d'ouverture : « Parcourir » entre directement sur la carte. */
  initialView?: HomeView;
  /**
   * L'identité affichée en tête — CDC §7. Rendue par la ROUTE : l'avatar et le
   * prénom appartiennent à la feature `onboarding`, que la boutique n'importe
   * pas.
   */
  renderIdentity?: () => ReactNode;
  /**
   * Catégories déclarées à l'onboarding — CDC §7 : leurs offres passent
   * devant. Vient aussi de la route, pour la même raison.
   */
  interests?: Category[];
  /**
   * Offres venues d'ailleurs, placées en tête du catalogue — aujourd'hui les
   * ventes flash publiées par le commerçant (CDC §9). La boutique n'importe pas
   * l'espace commerçant : c'est la ROUTE qui les lui apporte, déjà converties.
   */
  extraDeals?: Deal[];
};

export function HomeScreen({
  initialView = 'liste',
  renderIdentity,
  interests,
  extraDeals,
}: HomeScreenProps = {}) {
  const colors = useColors();
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<HomeView>(initialView);
  const setUserCoord = useShopStore((s) => s.setUserCoord);

  // Position demandée UNE fois pour tout l'écran : les cartes et la carte
  // géographique lisent ensuite la même valeur dans le store.
  useEffect(() => {
    let alive = true;
    getUserCoord().then((coord) => {
      if (alive && coord) setUserCoord(coord);
    });
    return () => {
      alive = false;
    };
  }, [setUserCoord]);

  const preferences = useShopStore((s) => s.preferences);
  const userCoord = useShopStore((s) => s.userCoord);

  const { deals, forYouCount, radiusRelaxed } = useMemo(() => {
    // Les offres publiées depuis l'app passent par exactement les mêmes filtres
    // que le catalogue : régimes, rayon, catégorie, recherche. Les exempter
    // ferait apparaître une offre que « Ma Fan Zone » vient d'écarter.
    const extra = extraDeals ?? [];
    let list = [...extra, ...dealsByCategory(category)];
    if (category) list = list.filter((d) => d.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          getMerchant(d.merchantId)?.name.toLowerCase().includes(q),
      );
    }
    // « Ma Fan Zone » agit ici : les régimes écartent réellement des offres, le
    // rayon aussi — mais jamais jusqu'à vider l'écran (voir `filterDeals`).
    const outcome = filterDeals(list, getMerchant, preferences, userCoord);
    // Ce qui va disparaître passe DEVANT : c'est un déstockage, pas un
    // catalogue. Trier par urgence est ce qui change la nature de l'écran —
    // mais le CDC §7 met les catégories déclarées avant tout le reste.
    // Le client l'a tranché : on n'affiche pas des promotions de boucherie à
    // quelqu'un venu pour du matériel informatique. On coupe donc en deux, au
    // lieu de se contenter de remonter les bonnes offres.
    const { forYou, others } = splitByInterests(outcome.deals, interests ?? []);
    return {
      deals: [...forYou, ...others],
      forYouCount: forYou.length,
      radiusRelaxed: outcome.radiusRelaxed,
    };
  }, [category, query, preferences, userCoord, interests, extraDeals]);

  const featured = getDeal(FEATURED_DEAL_ID);

  return (
    <Screen padded={false} testID="home-screen">
      {/* L'en-tête de la maquette B, sur UNE ligne : identité (avatar + prénom), logo et
          ville, bascule Liste / Carte, filtres et panier avec leur pastille. */}
      <View className="flex-row items-center gap-1.5 px-4 pb-3 pt-2">
        {renderIdentity ? renderIdentity() : null}
        <View className="min-w-0 flex-1">
          <Wordmark size={18} />
          <View className="mt-0.5 flex-row items-start gap-1">
            <Feather name="map-pin" size={11} color={colors.accent} />
            <AppText
              variant="caption"
              className="flex-1 text-accent-deep"
              style={{ fontSize: 10.5 }}
            >
              Toulouse Centre
            </AppText>
          </View>
        </View>
        <ViewSwitch value={view} onChange={setView} compact />
        <PreferencesButton />
        <CartButton />
      </View>

      {/* Vue carte : même état de filtre que la liste, un seul `deals`. */}
      {view === 'carte' ? (
        <View className="flex-1">
          <CategoryBar value={category} onChange={setCategory} />
          {/* Pas d'`overflow-hidden` ici : il ne servait à rien (aucun arrondi)
              et le clipping RN ne s'applique de toute façon pas à la surface
              GL d'Android. */}
          <View className="mt-2 flex-1">
            <DealsMap deals={deals} category={category} />
          </View>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(d) => d.id}
          renderItem={({ item, index }) => (
            <View className="px-5">
              {/* La séparation n'est pas un tri : c'est une frontière assumée.
                  Ce qui suit est hors des centres d'intérêt déclarés — présent,
                  mais jamais mélangé à ce qu'on est venu chercher. */}
              {index === forYouCount && forYouCount > 0 ? (
                <View testID="home-others-divider" className="mb-3 mt-2 gap-1">
                  <View className="h-px bg-line" />
                  <AppText variant="title" className="mt-3 text-base">
                    Autres offres du quartier
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    Hors de vos centres d’intérêt — modifiables dans Ma Fan Zone.
                  </AppText>
                </View>
              ) : null}
              <FlashCard deal={item} />
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-28"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View className="pb-1">
              <View className="mx-5 mb-4 flex-row items-center gap-2 rounded-control border border-line bg-surface-muted px-3">
                <Feather name="search" size={18} color={colors.inkFaint} />
                <TextField
                  testID="home-search"
                  placeholder="Je sais ce que je veux…"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  className="min-w-0 border-0 bg-transparent px-0"
                  style={{ minWidth: 0 }}
                />
                <ThemeToggle />
              </View>

              {/* Ad card sits above the filter and stays visible whatever the
                selected category — it advertises the deal, it isn't a result. */}
              {featured ? <FeaturedBanner deal={featured} /> : null}

              <CategoryBar value={category} onChange={setCategory} />

              {/* Rien dans le rayon : on montre tout, mais on ne le cache pas. */}
              {radiusRelaxed ? <RadiusNotice km={preferences.radiusKm} /> : null}

              <View className="mb-3 mt-4 flex-row items-end justify-between px-5">
                <AppText variant="title" className="text-lg">
                  Ça part maintenant
                </AppText>
                <AppText variant="caption" className="text-ink-faint">
                  {forYouCount > 0 && forYouCount < deals.length
                    ? `${forYouCount} pour vous · ${deals.length} en tout`
                    : `${deals.length} invendu${deals.length > 1 ? 's' : ''} à sauver`}
                </AppText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-10 pt-16" testID="home-empty">
              <Feather name={query ? 'search' : 'sliders'} size={30} color={colors.inkFaint} />
              <AppText variant="title" className="mt-3 text-center text-ink-faint">
                {query ? 'Aucune offre pour cette recherche' : 'Aucune offre avec ces réglages'}
              </AppText>
              <AppText variant="caption" className="mt-1 text-center">
                {query
                  ? 'Essayez une autre catégorie ou un autre mot-clé.'
                  : 'Vos régimes déclarés dans Ma Fan Zone écartent toutes les offres du moment.'}
              </AppText>
            </View>
          }
        />
      )}
    </Screen>
  );
}
