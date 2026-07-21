import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useCouponsStore } from '@/features/coupons';
import { GamesScreen } from '@/features/games';
import { dealImagePool } from '@/features/shop';

/**
 * Racine de composition des jeux : les images viennent des OFFRES (shop), la
 * récompense va aux COUPONS. La feature `games` ne connaît ni l'un ni l'autre —
 * elle reçoit tout en props, ce qui la garde sans dépendance croisée.
 */
const REWARDS = [
  { discount: { kind: 'amount' as const, cents: 200 }, label: 'Victoire aux cartes' },
  { discount: { kind: 'percent' as const, pct: 10 }, label: 'Cartes mémoire' },
  { discount: { kind: 'amount' as const, cents: 300 }, label: 'Paires parfaites' },
];

export default function GamesRoute() {
  const router = useRouter();
  const grant = useCouponsStore((s) => s.grantEarnedCoupon);
  const pool = useMemo(() => dealImagePool(), []);

  const onWin = () => {
    const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)]!;
    const coupon = grant(reward.discount, reward.label);
    Alert.alert(
      'Coupon gagné 🎉',
      `Votre code : ${coupon.code}\nRetrouvez-le dans « Mes coupons ».`,
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Voir mes coupons', onPress: () => router.push('/coupons') },
      ],
    );
  };

  return <GamesScreen imagePool={pool} onWin={onWin} />;
}
