import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useCouponsStore } from '@/features/coupons';
import { GamesScreen } from '@/features/games';
import { useGameStore } from '@/features/gamification';
import { useLoyaltyStore } from '@/features/loyalty';
import { dealImagePool, dealQuizPool } from '@/features/shop';

/**
 * Racine de composition des jeux. Les jeux ne connaissent ni les points ni les
 * coupons : ils reçoivent tout en props, ce qui les garde sans dépendance
 * croisée. Ici on branche la récompense sur les DEUX moteurs de fidélité —
 * des points (BONUS POINT) et un coupon.
 */
const REWARDS = [
  { discount: { kind: 'amount' as const, cents: 200 }, label: 'Victoire au jeu', points: 50 },
  { discount: { kind: 'percent' as const, pct: 10 }, label: 'Bien joué', points: 40 },
  { discount: { kind: 'amount' as const, cents: 300 }, label: 'Score parfait', points: 75 },
];

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
    const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)]!;
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

  return <GamesScreen imagePool={imagePool} quizPool={quizPool} words={GAME_WORDS} onWin={onWin} />;
}
