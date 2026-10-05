import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  nextTier,
  pointsToGo,
  programOf,
  selectCards,
  selectPrograms,
  tierProgress,
  useMerchantLoyaltyStore,
} from '@/features/loyalty';
import { openStatus, selectProfile, useMerchantStore } from '@/features/merchant';
import {
  demoShowcase,
  LOCAL_MERCHANT_ID,
  MerchantDetailScreen,
  useShopStore,
} from '@/features/shop';

/**
 * La vitrine d'une enseigne. La boutique, la fidélité et l'espace commerçant ne se
 * connaissent pas : c'est cette route qui les assemble — le solde et le prochain
 * palier viennent de `loyalty`, la vitrine réglée de `merchant`.
 */
export default function EnseigneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cards = useMerchantLoyaltyStore(selectCards);
  const programs = useMerchantLoyaltyStore(selectPrograms);
  const application = useShopStore((s) => s.merchantApplication);
  const merchantId = id ?? '';
  const shop = useMerchantStore(selectProfile);

  const points = cards[merchantId]?.points ?? 0;
  const goal = nextTier(programOf(programs, merchantId).tiers, points);
  const loyalty = {
    points,
    remaining: goal ? pointsToGo(goal, points) : null,
    progress: goal ? tierProgress(goal, points) : 1,
  };

  // Seule l'enseigne de CET appareil a une vitrine réglée ; les autres viennent du catalogue —
  // sauf les vitrines d'exemple de la démonstration (vidéo, portfolio).
  const local = merchantId === LOCAL_MERCHANT_ID;
  const showcase = local ? undefined : demoShowcase(merchantId);
  const profile = local
    ? {
        presentation: shop.presentation,
        photos: shop.photos,
        videos: shop.videos,
        status: openStatus(shop.hours, new Date()),
        zone: shop.zone,
      }
    : showcase?.profile;

  return (
    <MerchantDetailScreen
      merchantId={merchantId}
      loyalty={loyalty}
      {...(profile ? { profile } : {})}
      {...(local && application?.phone ? { phone: application.phone } : {})}
      {...(showcase ? { phone: showcase.phone } : {})}
      onOpenLoyalty={() => router.push({ pathname: '/fidelite/[id]', params: { id: merchantId } })}
      onOpenDeal={(dealId) => router.push({ pathname: '/produit/[id]', params: { id: dealId } })}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
