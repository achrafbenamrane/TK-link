import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CourierHomeScreen } from '@/features/courier';
import { programOf, useMerchantLoyaltyStore } from '@/features/loyalty';
import {
  liveOffers,
  MerchantDashboardScreen,
  secondsLeft,
  selectOffers,
  useMerchantStore,
  type DashboardTarget,
} from '@/features/merchant';
import {
  AvatarView,
  selectAvatar,
  selectFirstName,
  selectInterests,
  selectRole,
  useOnboardingStore,
} from '@/features/onboarding';
import {
  authenticateBiometric,
  HomeScreen,
  isMerchantOrder,
  missionOffers,
  LOCAL_MERCHANT_ID,
  selectOrders,
  summarizeOrder,
  useShopStore,
  type Deal,
} from '@/features/shop';
import { CATEGORY_INFO } from '@/shared/lib/categories';
import { AppText } from '@/shared/ui';

/**
 * ACCUEIL — ce que l'utilisateur voit dépend de CE QU'IL EST (CDC §3.1, §3.2).
 *
 * « Le client final voit les offres du commerçant, le commerçant celles du
 * grossiste. » La règle existait dans `shared/lib/roles` et n'était appliquée
 * nulle part : un commerçant voyait le même accueil qu'un consommateur, donc
 * les invendus de ses propres confrères plutôt que ses lots d'approvisionnement.
 *
 * C'est la ROUTE qui tranche, parce qu'elle seule connaît à la fois le profil
 * (`onboarding`) et les deux écrans possibles (`shop`, `merchant`).
 */

/** Teinte de vignette par catégorie, faute de photo pour une offre fraîche. */
const TINTS: Record<string, string> = {
  restauration: '#F6E3C5',
  'high-tech': '#D8E4F5',
  maison: '#E7E2F5',
  mode: '#F5DCE4',
  beaute: '#F7DDE8',
  sport: '#D9EFE0',
  auto: '#E2E6EA',
  services: '#E9EDDF',
};

function ConsumerHome() {
  const router = useRouter();
  const avatar = useOnboardingStore(selectAvatar);
  const firstName = useOnboardingStore(selectFirstName);
  const interests = useOnboardingStore(selectInterests);
  // Tranche brute puis conversion en mémo : un sélecteur qui renverrait la
  // liste filtrée créerait un tableau neuf à chaque rendu (boucle Zustand 5).
  const published = useMerchantStore(selectOffers);

  // Instant figé au montage : `Date.now()` pendant le rendu rendrait la liste
  // non idempotente (les compteurs bougeraient à chaque passe de React).
  const [now] = useState(() => Date.now());

  const extraDeals = useMemo<Deal[]>(() => {
    // CDC §20 : un lot destiné aux commerçants n'a rien à faire chez le client.
    const forClients = published.filter((o) => o.audience === 'clients');
    return liveOffers(forClients, now).map((o) => ({
      id: `pub_${o.id}`,
      title: o.title,
      merchantId: LOCAL_MERCHANT_ID,
      category: o.category,
      emoji: CATEGORY_INFO[o.category].emoji,
      tint: TINTS[o.category] ?? '#EDF1E7',
      price: o.priceCents / 100,
      oldPrice: o.oldPriceCents / 100,
      rating: 5,
      stockTotal: o.stock,
      stockLeft: o.stockLeft,
      endsInSeconds: secondsLeft(o, now),
      description: o.description || 'Vente flash publiée par le commerçant.',
      // La photo posée à la création, et les modes que le commerçant propose (V1.1).
      ...(o.photoUri ? { imageUrl: o.photoUri } : {}),
      fulfilments: o.modes,
    }));
  }, [published, now]);

  const renderIdentity = useCallback(
    () => (
      <Pressable
        testID="home-identity"
        accessibilityRole="button"
        accessibilityLabel={firstName ? `Profil de ${firstName}` : 'Votre profil'}
        onPress={() => router.push('/profil')}
      >
        <View className="h-11 w-11 overflow-hidden rounded-pill">
          <AvatarView avatar={avatar} size={44} />
        </View>
        {firstName ? (
          <AppText
            variant="caption"
            className="mt-0.5 text-center text-ink-faint"
            style={{ fontSize: 10 }}
            numberOfLines={1}
          >
            {firstName}
          </AppText>
        ) : null}
      </Pressable>
    ),
    [avatar, firstName, router],
  );

  return (
    <HomeScreen interests={interests} extraDeals={extraDeals} renderIdentity={renderIdentity} />
  );
}

/**
 * L'accueil du commerçant : son tableau de bord.
 *
 * Il n'est PAS l'écran d'ouverture : V1.1 (Commerçant > Règle, VALIDÉ) veut que
 * l'appareil s'ouvre sur la liste des commandes en cours — voir `_layout.tsx`,
 * qui y bascule au lancement. Le tableau de bord reste à un geste, ici.
 */
function MerchantHome() {
  const router = useRouter();
  const avatar = useOnboardingStore(selectAvatar);
  const firstName = useOnboardingStore(selectFirstName);
  const published = useMerchantStore(selectOffers);
  const orders = useShopStore(selectOrders);
  const application = useShopStore((s) => s.merchantApplication);

  const summaries = useMemo(() => {
    const own = new Set(published.map((o) => `pub_${o.id}`));
    return orders.filter((o) => isMerchantOrder(o, own)).map(summarizeOrder);
  }, [orders, published]);

  const tiersCount = useMerchantLoyaltyStore(
    (s) => programOf(s.programs, LOCAL_MERCHANT_ID).tiers.length,
  );

  const open = useCallback(
    (target: DashboardTarget) => {
      const href = {
        flash: '/flash',
        orders: '/commandes',
        loyalty: '/fidelite',
        stats: '/statistiques',
        shop: '/boutique',
        offers: '/flash',
        wholesale: '/lots',
        payouts: '/versements',
        documents: '/factures',
        account: '/profil',
      } as const;
      router.push(href[target]);
    },
    [router],
  );

  return (
    <MerchantDashboardScreen
      shopName={application?.shopName ?? (firstName || 'Mon commerce')}
      {...(application?.area ? { area: application.area } : {})}
      renderAvatar={() => <AvatarView avatar={avatar} size={52} />}
      orders={summaries}
      tiersCount={tiersCount}
      onOpen={open}
    />
  );
}

/** L'accueil du livreur : disponibilité et missions (les commandes prêtes en livraison). */
function CourierHome() {
  const router = useRouter();
  const orders = useShopStore(selectOrders);
  const addresses = useShopStore((s) => s.addresses);
  const setOrderStatus = useShopStore((s) => s.setOrderStatus);
  const missions = useMemo(() => missionOffers(orders, addresses), [orders, addresses]);

  return (
    <CourierHomeScreen
      missions={missions}
      authenticate={async (reason) => (await authenticateBiometric(reason)).ok}
      onPickedUp={(orderId) => setOrderStatus(orderId, 'en_livraison')}
      onDelivered={(orderId) => setOrderStatus(orderId, 'livree')}
      onOpenSetup={() => router.push('/devenir-livreur')}
    />
  );
}

export default function AccueilRoute() {
  const role = useOnboardingStore(selectRole);
  if (role === 'livreur') return <CourierHome />;
  return role === 'commercant' ? <MerchantHome /> : <ConsumerHome />;
}
