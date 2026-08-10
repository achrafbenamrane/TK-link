import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useGameStore } from '@/features/gamification';
import { liveOffers, secondsLeft, selectOffers, useMerchantStore } from '@/features/merchant';
import {
  AvatarView,
  selectAvatar,
  selectFirstName,
  selectInterests,
  useOnboardingStore,
} from '@/features/onboarding';
import { HomeScreen, LOCAL_MERCHANT_ID, type Deal } from '@/features/shop';
import { CATEGORY_INFO } from '@/shared/lib/categories';
import { AppText } from '@/shared/ui';

/**
 * ACCUEIL — les ventes flash, triées par ce qui va disparaître en premier.
 *
 * La progression (rang, missions, série) n'est PLUS ici : elle vit dans
 * l'onglet « La Chasse ». L'accueil retrouve son seul métier — montrer ce qui
 * se déstocke maintenant. La visite du jour, elle, continue d'être comptée :
 * c'est bien l'ouverture de l'app qu'elle mesure, pas l'affichage du bandeau.
 *
 * C'est aussi ici que la boucle du CDC §9 se referme : ce qu'un commerçant
 * publie depuis « Mes ventes flash » atterrit dans la liste des clients. La
 * conversion se fait dans la ROUTE — `shop` ignore l'espace commerçant, et
 * `merchant` ignore la forme d'une fiche produit.
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

export default function AccueilRoute() {
  const router = useRouter();
  const markVisit = useGameStore((s) => s.markVisit);
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
    }));
  }, [published, now]);

  const onVisit = useCallback(() => markVisit(), [markVisit]);

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
    <HomeScreen
      onVisit={onVisit}
      interests={interests}
      extraDeals={extraDeals}
      renderIdentity={renderIdentity}
    />
  );
}
