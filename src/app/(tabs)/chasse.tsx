import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickGameReward, selectWallet, useCouponsStore } from '@/features/coupons';
import { GamePlayer, GamesRail, type GameKey } from '@/features/games';
import { HubScreen, useGameStore, type ChestReward } from '@/features/gamification';
import { OffersRail, selectBalance, useLoyaltyStore } from '@/features/loyalty';
import { AvatarView, selectAvatar, useOnboardingStore } from '@/features/onboarding';
import { criticalDealCount, dealImagePool, dealQuizPool, LiquidationRail } from '@/features/shop';

/**
 * LA CHASSE — l'onglet du milieu, où le déstockage, les offres membres, les
 * mini-jeux et toute la progression se rejoignent.
 *
 * C'est la ROUTE qui compose : `gamification` tient l'écran et la progression,
 * mais ne connaît ni la boutique, ni la fidélité, ni les coupons. On lui passe
 * des rails déjà rendus et des compteurs — aucun import croisé entre features.
 */

/** Mots à cacher dans « Mots mêlés » — courts, sans accents, univers TK. */
const GAME_WORDS = ['TICKET', 'CAISSE', 'POINTS', 'CARTE', 'CADEAU', 'FLASH', 'PROMO', 'ARBRE'];

/** Le coupon offert par le coffre, selon son palier. */
const CHEST_COUPON = {
  bronze: { kind: 'percent', pct: 5 },
  argent: { kind: 'amount', cents: 200 },
  or: { kind: 'amount', cents: 500 },
} as const;

export default function ChasseRoute() {
  const router = useRouter();
  const [playing, setPlaying] = useState<GameKey | null>(null);

  const grant = useCouponsStore((s) => s.grantEarnedCoupon);
  // On s'abonne à la référence stable du portefeuille puis on compte en mémo :
  // un sélecteur qui renvoie `.filter(...)` crée un tableau neuf à chaque
  // rendu, ce que Zustand 5 lit comme un changement → boucle infinie.
  const wallet = useCouponsStore(selectWallet);
  const couponsCount = useMemo(() => wallet.filter((c) => c.usedAt === null).length, [wallet]);

  const earn = useLoyaltyStore((s) => s.earn);
  const points = useLoyaltyStore(selectBalance);

  const record = useGameStore((s) => s.record);
  const avatar = useOnboardingStore(selectAvatar);

  const imagePool = useMemo(() => dealImagePool(), []);
  const quizPool = useMemo(() => dealQuizPool(), []);
  const criticalCount = useMemo(() => criticalDealCount(), []);

  /** Victoire à un jeu : un coupon, des points, de l'XP. */
  const onWin = useCallback(() => {
    const reward = pickGameReward();
    const coupon = grant(reward.discount, reward.label);
    earn(reward.points, reward.label, 'jeu');
    record('game');
    Alert.alert(
      'Gagné 🎉',
      `+${reward.points} points\nCoupon ${coupon.code}\n\nRetrouvez-les sur votre carte.`,
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir ma carte', onPress: () => router.push('/carte') },
      ],
    );
  }, [grant, earn, record, router]);

  /**
   * Coffre du jour : l'XP est déjà crédité par le store de progression, on
   * complète avec ce qui appartient aux autres features (points + coupon).
   */
  const onChestOpened = useCallback(
    (reward: ChestReward) => {
      earn(reward.points, reward.label, 'bonus');
      const coupon = grant(CHEST_COUPON[reward.tier], reward.label);
      Alert.alert(
        `${reward.label} 🎁`,
        `+${reward.xp} XP\n+${reward.points} points\nCoupon ${coupon.code}`,
      );
    },
    [earn, grant],
  );

  /** Attraper un invendu fait avancer la mission du jour. */
  const onCatch = useCallback(() => record('catch'), [record]);

  // Un jeu ouvert prend tout l'onglet : les jeux sont des « affiches » plein
  // écran, les empiler dans le hub en ferait des vignettes illisibles.
  if (playing) {
    return (
      <GamePlayer
        game={playing}
        imagePool={imagePool}
        quizPool={quizPool}
        words={GAME_WORDS}
        onWin={onWin}
        onExit={() => setPlaying(null)}
      />
    );
  }

  return (
    <HubScreen
      points={points}
      couponsCount={couponsCount}
      criticalCount={criticalCount}
      onChestOpened={onChestOpened}
      onOpenWallet={() => router.push('/carte')}
      onOpenCoupons={() => router.push('/coupons')}
      onSeeAllDeals={() => router.push('/')}
      onSeeAllOffers={() => router.push('/offres')}
      onSeeAllGames={() => router.push('/jeux')}
      renderAvatar={() => <AvatarView avatar={avatar} size={48} />}
      renderLiquidation={() => <LiquidationRail onCatch={onCatch} />}
      renderOffers={() => <OffersRail />}
      renderGames={() => (
        <GamesRail
          pools={{
            images: imagePool.length,
            quiz: quizPool.length,
            words: GAME_WORDS.length,
          }}
          onPlay={setPlaying}
        />
      )}
    />
  );
}
