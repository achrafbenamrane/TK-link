import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  nextTier,
  pointsToGo,
  programOf,
  selectCards,
  selectPrograms,
  tierProgress,
  useMerchantLoyaltyStore,
} from '@/features/loyalty';
import {
  fetchMyMedia,
  fetchShopMedia,
  openStatus,
  selectProfile,
  type ShopMedia,
  useMerchantStore,
} from '@/features/merchant';
import { isDemoBuild, isSupabaseConfigured } from '@/shared/lib/env';
import {
  demoShowcase,
  LOCAL_MERCHANT_ID,
  MerchantDetailScreen,
  useShopStore,
} from '@/features/shop';

const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La vitrine d'une enseigne. La boutique, la fidélité et l'espace commerçant ne se
 * connaissent pas : c'est cette route qui les assemble — le solde et le prochain
 * palier viennent de `loyalty`, la vitrine réglée et les visuels IA de `merchant`.
 */
export default function EnseigneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cards = useMerchantLoyaltyStore(selectCards);
  const programs = useMerchantLoyaltyStore(selectPrograms);
  const application = useShopStore((s) => s.merchantApplication);
  const merchantId = id ?? '';
  const shop = useMerchantStore(selectProfile);

  // Les visuels IA montrés par le commerçant (serveur, migration 0015) : ceux d'une enseigne du
  // serveur, ou les siens quand le commerçant regarde sa propre vitrine.
  const local = merchantId === LOCAL_MERCHANT_ID;
  const [aiMedia, setAiMedia] = useState<ShopMedia[]>([]);
  useEffect(() => {
    if (!isSupabaseConfigured || (!local && !SERVER_ID.test(merchantId))) return;
    let alive = true;
    const load = local
      ? fetchMyMedia().then((r) =>
          r.ok ? r.value.filter((m) => m.status === 'pret' && m.visible && m.url) : [],
        )
      : fetchShopMedia(merchantId);
    void load.then((media) => {
      if (alive) setAiMedia(media);
    });
    return () => {
      alive = false;
    };
  }, [local, merchantId]);

  const points = cards[merchantId]?.points ?? 0;
  const goal = nextTier(programOf(programs, merchantId).tiers, points);
  const loyalty = {
    points,
    remaining: goal ? pointsToGo(goal, points) : null,
    progress: goal ? tierProgress(goal, points) : 1,
  };

  // Seule l'enseigne de CET appareil a une vitrine réglée ; les autres viennent du catalogue —
  // sauf les vitrines d'exemple de la démonstration (vidéo, portfolio).
  // La vitrine d'exemple (vidéo, portfolio) n'existe qu'en démonstration.
  const showcase = local || !isDemoBuild ? undefined : demoShowcase(merchantId);
  const base = local
    ? {
        presentation: shop.presentation,
        photos: shop.photos,
        videos: shop.videos,
        status: openStatus(shop.hours, new Date()),
        zone: shop.zone,
      }
    : showcase?.profile;
  const aiPhotos = aiMedia.flatMap((m) => (m.kind === 'image' && m.url ? [m.url] : []));
  const aiVideos = aiMedia.flatMap((m) => (m.kind === 'video' && m.url ? [m.url] : []));
  // Les photos du commerçant d'abord, puis les visuels IA ; sa propre vidéo passe avant celle de l'IA.
  const profile =
    base || aiMedia.length > 0
      ? {
          presentation: base?.presentation ?? '',
          photos: [...(base?.photos ?? []), ...aiPhotos],
          videos: [...(base?.videos ?? []), ...aiVideos],
          status: base?.status ?? '',
          ...(base?.zone ? { zone: base.zone } : {}),
        }
      : undefined;

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
