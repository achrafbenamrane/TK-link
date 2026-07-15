import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { selectPoints, useShopStore } from '../model/store';

const REWARD_TARGET = 200;

function Row({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 py-3.5 active:opacity-60',
        !last && 'border-b border-line',
      )}
    >
      <View className="h-9 w-9 items-center justify-center rounded-control bg-surface-muted">
        {icon}
      </View>
      <AppText className={cn('flex-1 font-sans-medium', danger && 'text-brand-600')}>
        {label}
      </AppText>
      <Feather name="chevron-right" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const points = useShopStore(selectPoints);
  const remaining = Math.max(0, REWARD_TARGET - points);
  const pct = Math.min(100, Math.round((points / REWARD_TARGET) * 100));

  const invite = async () => {
    try {
      await Share.share({
        message:
          'Je déniche les meilleures ventes flash de mon quartier sur Freedoo ⚡ Télécharge l’app : https://freedoo.app',
      });
    } catch {
      // partage indisponible (web) — sans effet pour la démo
    }
  };

  return (
    <Screen testID="profile-screen">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <View className="pb-4 pt-2">
          <AppText variant="display">Profil</AppText>
        </View>

        <View className="mb-4 flex-row items-center gap-3 rounded-card border border-line bg-surface p-4">
          <View className="h-14 w-14 items-center justify-center rounded-pill bg-ink">
            <AppText className="font-display text-ink-inverse" style={{ fontSize: 22 }}>
              F
            </AppText>
          </View>
          <View className="flex-1">
            <AppText variant="title" className="text-lg">
              Farid
            </AppText>
            <AppText variant="caption" className="text-ink-faint">
              Empalot · Toulouse
            </AppText>
          </View>
          <Feather name="edit-2" size={18} color={colors.inkMuted} />
        </View>

        {/* Loyalty */}
        <View className="mb-5 gap-3 rounded-card bg-ink p-5">
          <View className="flex-row items-center gap-2">
            <Feather name="gift" size={16} color={colors.brand500} />
            <AppText className="font-sans-semibold text-ink-inverse">Fidélité Freedoo</AppText>
          </View>
          <View className="flex-row items-baseline gap-2">
            <AppText className="font-display text-ink-inverse" style={{ fontSize: 40 }}>
              {points}
            </AppText>
            <AppText className="text-ink-inverse/70">points</AppText>
          </View>
          <View className="gap-1.5">
            <View className="h-2 overflow-hidden rounded-pill bg-ink-inverse/20">
              <View className="h-full rounded-pill bg-brand-500" style={{ width: `${pct}%` }} />
            </View>
            <AppText className="text-xs text-ink-inverse/70">
              {remaining > 0
                ? `Encore ${remaining} points pour un bon d’achat de 5€`
                : 'Un bon d’achat de 5€ vous attend 🎉'}
            </AppText>
          </View>
          <Pressable className="mt-1 flex-row items-center justify-center gap-2 rounded-control bg-surface py-3 active:opacity-90">
            <Feather name="share-2" size={15} color={colors.ink} />
            <AppText className="font-sans-bold text-ink">Partager mes points</AppText>
          </Pressable>
        </View>

        {/* Invite — bouton simple ; le bouton signature vit désormais sur les fiches produit. */}
        <View className="mb-5 gap-2 rounded-card border border-line bg-surface-muted p-5">
          <AppText variant="title" className="text-lg">
            Partagez Freedoo
          </AppText>
          <AppText variant="caption" className="mb-1">
            Un proche rejoint le quartier ? Offrez-lui l’app d’un simple geste.
          </AppText>
          <Pressable
            testID="invite-button"
            accessibilityRole="button"
            accessibilityLabel="Partager l’application Freedoo"
            onPress={invite}
            className="flex-row items-center justify-center gap-2 rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
          >
            <Feather name="share-2" size={15} color={colors.inkInverse} />
            <AppText className="font-sans-bold text-ink-inverse">Partager l’app</AppText>
          </Pressable>
        </View>

        {/* Menu */}
        <View className="rounded-card border border-line bg-surface px-4">
          <Row
            icon={<Ionicons name="finger-print" size={18} color={colors.ink} />}
            label="Empreinte digitale"
          />
          <Row
            icon={<Feather name="maximize" size={17} color={colors.ink} />}
            label="Mes factures QR"
          />
          <Row
            icon={<Feather name="map-pin" size={17} color={colors.ink} />}
            label="Adresses de livraison"
          />
          <Row
            icon={<Feather name="briefcase" size={17} color={colors.ink} />}
            label="Devenir commerçant"
          />
          <Row
            icon={<Feather name="help-circle" size={17} color={colors.ink} />}
            label="Aide & contact"
          />
          <Row
            icon={<Feather name="log-out" size={17} color={colors.brand600} />}
            label="Se déconnecter"
            danger
            last
            onPress={() => router.push('/sign-in')}
          />
        </View>

        <AppText variant="caption" className="mt-6 text-center text-ink-faint">
          Freedoo v0.1 · Conçu par PROGIX
        </AppText>
      </ScrollView>
    </Screen>
  );
}
