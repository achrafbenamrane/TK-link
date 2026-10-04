import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { BackButton } from '@/shared/ui/back-button';
import { useColors } from '@/shared/theme/theme-provider';

import { selectRewards, useMerchantLoyaltyStore, type Reward } from '../model/merchant-store';

const STATUS_LABEL: Record<Reward['status'], string> = {
  disponible: 'À utiliser',
  utilisee: 'Utilisée',
  partagee: 'Partagée',
};

/** Ce que le QR contient : de quoi retrouver la récompense, rien de personnel. */
export function rewardPayload(r: Reward): string {
  return JSON.stringify({ v: 1, k: 'reward', m: r.merchantId, c: r.code });
}

/**
 * MES RÉCOMPENSES — l'inventaire (CDC V1.1).
 *
 * Une récompense débloquée se montre en QR au commerçant, qui la valide ; elle
 * peut aussi se partager avec un autre compte. Les POINTS bruts, eux, ne se
 * partagent jamais, sous aucune forme : aucun écran ne le propose.
 */
export function RewardsScreen() {
  const colors = useColors();
  const rewards = useMerchantLoyaltyStore(selectRewards);
  const shareReward = useMerchantLoyaltyStore((s) => s.shareReward);

  const [available, history] = useMemo(
    () => [
      rewards.filter((r) => r.status === 'disponible'),
      rewards.filter((r) => r.status !== 'disponible'),
    ],
    [rewards],
  );

  const share = async (r: Reward) => {
    try {
      const res = await Share.share({
        message: `Je t’offre une récompense TK LINK chez ${r.merchantName || 'un commerçant'} : « ${r.label} ». Code : ${r.code}`,
      });
      // On ne retire la récompense de l'inventaire que si le partage a eu lieu :
      // fermer la fenêtre de partage ne doit pas faire perdre un avantage.
      if (res.action !== Share.dismissedAction) shareReward(r.id);
    } catch {
      // partage indisponible (web) : la récompense reste là
    }
  };

  return (
    <Screen testID="rewards-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 px-5 pb-10">
        <View className="gap-1 pt-2">
          <BackButton fallbackHref="/profil" />
          <AppText variant="display" className="text-2xl">
            Mes récompenses
          </AppText>
          <AppText variant="caption">
            Montrez le QR au commerçant pour en profiter. Une récompense débloquée peut se partager
            ; les points, jamais.
          </AppText>
        </View>

        {rewards.length === 0 ? (
          <View testID="rewards-empty" className="items-center gap-2 py-12">
            <Feather name="gift" size={30} color={colors.inkFaint} />
            <AppText variant="title" className="text-center text-base">
              Aucune récompense pour le moment
            </AppText>
            <AppText variant="caption" className="text-center">
              Cumulez des points chez un commerçant : chaque palier atteint se débloque ici.
            </AppText>
          </View>
        ) : null}

        {available.map((r) => (
          <View
            key={r.id}
            testID={`reward-${r.id}`}
            className="items-center gap-3 rounded-card border border-line bg-surface p-5"
          >
            <View className="w-full flex-row items-center gap-2">
              <Feather name="gift" size={16} color={colors.brand500} />
              <View className="flex-1">
                <AppText className="font-sans-bold text-ink" numberOfLines={2}>
                  {r.label}
                </AppText>
                <AppText variant="caption" className="text-ink-faint">
                  {r.merchantName || 'Commerçant'} · palier {r.rank}
                </AppText>
              </View>
            </View>
            {/* Fond blanc : un QR sur fond sombre perd son contraste. */}
            <View className="rounded-card bg-white p-3">
              <QRCode
                value={rewardPayload(r)}
                size={140}
                color="#1B1B1F"
                backgroundColor="#FFFFFF"
              />
            </View>
            <AppText
              testID={`reward-code-${r.id}`}
              className="font-sans-bold text-ink"
              style={{ letterSpacing: 2 }}
            >
              {r.code}
            </AppText>
            <Pressable
              testID={`reward-share-${r.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Partager ${r.label}`}
              onPress={() => share(r)}
              className="flex-row items-center gap-2 rounded-control border border-line px-4 py-2.5 active:bg-surface-muted"
            >
              <Feather name="share-2" size={15} color={colors.inkMuted} />
              <AppText className="font-sans-semibold text-ink-muted" style={{ fontSize: 13 }}>
                Partager cette récompense
              </AppText>
            </Pressable>
          </View>
        ))}

        {history.length > 0 ? (
          <View className="gap-2">
            <AppText variant="label">Historique</AppText>
            {history.map((r) => (
              <View
                key={r.id}
                testID={`reward-${r.id}`}
                className="flex-row items-center gap-3 rounded-card bg-surface-muted p-3.5"
              >
                <View className="flex-1">
                  <AppText className="font-sans-medium text-ink-muted" numberOfLines={1}>
                    {r.label}
                  </AppText>
                  <AppText variant="caption" className="text-ink-faint">
                    {r.merchantName || 'Commerçant'}
                  </AppText>
                </View>
                <AppText
                  variant="caption"
                  className={cn(
                    'font-sans-semibold',
                    r.status === 'utilisee' ? 'text-brand-600' : 'text-ink-faint',
                  )}
                >
                  {STATUS_LABEL[r.status]}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
