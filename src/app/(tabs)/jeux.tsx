import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { pickGameReward, useCouponsStore } from '@/features/coupons';
import { GamesScreen } from '@/features/games';
import { useGameStore } from '@/features/gamification';
import { useLoyaltyStore } from '@/features/loyalty';
import { dealImagePool, dealQuizPool } from '@/features/shop';

/**
 * Le menu complet des jeux — le « tout voir » de l'onglet La Chasse, qui n'en
 * montre qu'un rail. Les jeux ne connaissent ni les points ni les coupons :
 * ils reçoivent tout en props, ce qui les garde sans dépendance croisée. Ici on
 * branche la récompense sur les DEUX moteurs de fidélité — des points (BONUS
 * POINT) et un coupon, avec la même table que le hub.
 */

/** Mots à cacher dans « Mots mêlés » — courts, sans accents, dans l'univers TK. */
const GAME_WORDS = ['TICKET', 'CAISSE', 'POINTS', 'CARTE', 'CADEAU', 'FLASH', 'PROMO', 'ARBRE'];

export default function GamesRoute() {
  const router = useRouter();
  const grant = useCouponsStore((s) => s.grantEarnedCoupon);
  const earn = useLoyaltyStore((s) => s.earn);
  const recordXp = useGameStore((s) => s.record);
  const imagePool = useMemo(() => dealImagePool(), []);
  const quizPool = useMemo(() => dealQuizPool(), []);

  const onWin = () => {
    const reward = pickGameReward();
    const coupon = grant(reward.discount, reward.label);
    earn(reward.points, reward.label, 'jeu');
    // La victoire nourrit aussi la progression du chasseur (XP, missions).
    recordXp('game');
    Alert.alert(
      'Gagné 🎉',
      `+${reward.points} points\nCoupon ${coupon.code}\n\nRetrouvez-les sur votre carte.`,
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir ma carte', onPress: () => router.push('/carte') },
      ],
    );
  };

  return (
    <GamesScreen
      imagePool={imagePool}
      quizPool={quizPool}
      words={GAME_WORDS}
      onWin={onWin}
      onBack={() => router.back()}
    />
  );
}
