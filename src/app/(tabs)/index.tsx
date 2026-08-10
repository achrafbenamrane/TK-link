import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useGameStore } from '@/features/gamification';
import {
  liveOffers,
  secondsLeft,
  selectOffers,
  useMerchantStore,
  WholesaleScreen,
} from '@/features/merchant';
import {
  AvatarView,
  selectAvatar,
  selectFirstName,
  selectInterests,
  selectRole,
  selectSiret,
  useOnboardingStore,
} from '@/features/onboarding';
import { HomeScreen, LOCAL_MERCHANT_ID, type Deal } from '@/features/shop';
import { CATEGORY_INFO } from '@/shared/lib/categories';
import { WHOLESALE_BLOCK_MESSAGE, wholesaleOrderBlock } from '@/shared/lib/roles';
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
 *
 * La progression (rang, missions, série) n'est PAS ici : elle vit dans l'onglet
 * « La Chasse ». La visite du jour, elle, continue d'être comptée — c'est bien
 * l'ouverture de l'app qu'elle mesure.
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
  const role = useOnboardingStore(selectRole);
  const siret = useOnboardingStore(selectSiret);
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

  // Un commerçant vient s'approvisionner : son accueil, ce sont les lots des
  // grossistes — CDC §3.2. Il vend depuis l'espace pro sur le web.
  if (role === 'commercant') {
    const block = wholesaleOrderBlock(role, siret);
    return (
      <WholesaleScreen
        blockedReason={block ? WHOLESALE_BLOCK_MESSAGE[block] : null}
        onFixProfile={block === 'siret' ? () => router.push('/sign-up') : undefined}
      />
    );
  }

  return (
    <HomeScreen
      onVisit={onVisit}
      interests={interests}
      extraDeals={extraDeals}
      renderIdentity={renderIdentity}
    />
  );
}
