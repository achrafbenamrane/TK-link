import { Feather } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { badgesOf, earnedCount } from '../lib/badges';
import { chestAvailable, type ChestReward } from '../lib/chest';
import { neighbourhoodBoard } from '../lib/leaderboard';
import {
  dailyMissions,
  dayKey,
  isStreakAlive,
  levelProgress,
  missionsDone,
  nextRank,
  rankOf,
} from '../lib/progression';
import {
  selectCounts,
  selectLastChest,
  selectStreak,
  selectXp,
  useGameStore,
} from '../model/store';
import { BadgesGrid } from './badges-grid';
import { ChestCard } from './chest-card';
import { LeaderboardCard } from './leaderboard-card';
import { MissionList } from './mission-list';

type Props = {
  /** Solde de points fidélité — fourni par la route, la progression ne l'a pas. */
  points?: number;
  /** Coupons encore utilisables dans le portefeuille. */
  couponsCount?: number;
  /** Offres en dernière chance, pour la bannière d'urgence. */
  criticalCount?: number;
  /**
   * Le coffre vient d'être ouvert : la route crédite les points et le coupon.
   * L'XP, lui, est déjà crédité par le store — il appartient à cette feature.
   */
  onChestOpened?: (reward: ChestReward) => void;
  onOpenWallet?: () => void;
  onOpenCoupons?: () => void;
  onSeeAllDeals?: () => void;
  onSeeAllOffers?: () => void;
  onSeeAllGames?: () => void;
  /** Le déstockage — rendu par la route, la boutique n'est pas importée ici. */
  renderLiquidation?: () => ReactNode;
  /** Les offres réservées aux porteurs de carte. */
  renderOffers?: () => ReactNode;
  /** Le rail de mini-jeux. */
  renderGames?: () => ReactNode;
};

/** Chiffre + libellé, en pastille — le « butin » du chasseur. */
function LootChip({
  icon,
  value,
  label,
  onPress,
  testID,
}: {
  icon: 'award' | 'tag' | 'zap';
  value: string;
  label: string;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 items-center gap-0.5 rounded-control bg-ink-inverse/10 py-2.5 active:opacity-80"
    >
      <Feather name={icon} size={14} color={colors.lime} />
      <AppText
        className="font-display text-ink-inverse"
        style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText className="text-ink-inverse/60" style={{ fontSize: 10 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** En-tête de section : un titre, un compteur, et de quoi aller plus loin. */
function SectionHeader({
  title,
  hint,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View className="mb-2.5 mt-6 flex-row items-end justify-between px-5">
      <View className="flex-1 pr-3">
        <AppText variant="title" className="text-lg">
          {title}
        </AppText>
        {hint ? (
          <AppText variant="caption" className="mt-0.5 text-ink-faint">
            {hint}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <AppText className="font-sans-semibold text-brand-600" style={{ fontSize: 12.5 }}>
            {actionLabel}
          </AppText>
          <Feather name="chevron-right" size={15} color={colors.brand600} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * LA CHASSE — l'onglet du milieu.
 *
 * Un seul endroit où l'on gagne quelque chose : le déstockage (ce qui va
 * disparaître), les offres réservées aux membres, les mini-jeux, et toute la
 * progression qui relie les trois — rang, coffre du jour, missions, trophées,
 * classement. Séparer « offres » et « jeux » en deux onglets cassait la
 * boucle : on jouait sans voir ce qu'on pouvait attraper, et l'inverse.
 *
 * L'écran ne connaît NI la boutique, NI la fidélité, NI les coupons : la route
 * lui passe les rails déjà rendus et les compteurs. C'est ce qui lui permet de
 * vivre dans la feature `gamification` sans import croisé.
 */
export function HubScreen({
  points = 0,
  couponsCount = 0,
  criticalCount = 0,
  onChestOpened,
  onOpenWallet,
  onOpenCoupons,
  onSeeAllDeals,
  onSeeAllOffers,
  onSeeAllGames,
  renderLiquidation,
  renderOffers,
  renderGames,
}: Props) {
  const xp = useGameStore(selectXp);
  const streak = useGameStore(selectStreak);
  const counts = useGameStore(selectCounts);
  const lastChest = useGameStore(selectLastChest);
  const openChest = useGameStore((s) => s.openChest);

  // Instant figé au montage : `Date.now()` pendant le rendu rendrait l'écran
  // non idempotent (missions et classement changeraient à chaque passe).
  const [now] = useState(() => Date.now());
  const missions = useMemo(() => dailyMissions(now), [now]);
  const board = useMemo(() => neighbourhoodBoard(xp, now), [xp, now]);

  const rank = rankOf(xp);
  const next = nextRank(xp);
  const { ratio, toGo } = levelProgress(xp);
  const done = missionsDone(missions, counts);
  const badges = useMemo(
    () => badgesOf({ xp, streak, counts, missionsDone: done }),
    [xp, streak, counts, done],
  );
  const alive = isStreakAlive({ count: streak, lastDay: null }, now) || streak > 0;

  const onOpen = () => {
    const reward = openChest();
    // `null` = coffre déjà ouvert : le store a tranché, on ne récompense pas.
    if (reward) onChestOpened?.(reward);
  };

  return (
    <Screen testID="hub-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
        <View className="px-5 pb-3 pt-2">
          <AppText variant="display" className="text-2xl">
            La Chasse
          </AppText>
          <AppText variant="caption" className="mt-0.5">
            Déstockage, offres membres et jeux — tout ce qui rapporte.
          </AppText>
        </View>

        {/* Hero : rang, XP, série, butin */}
        <View className="mx-5 overflow-hidden rounded-card bg-surface-inverse">
          <View className="flex-row items-center gap-3 px-4 pt-4">
            <View className="h-12 w-12 items-center justify-center rounded-pill bg-lime">
              <AppText className="font-display text-forest" style={{ fontSize: 17 }}>
                {rank.level}
              </AppText>
            </View>
            <View className="flex-1">
              <AppText className="font-display text-ink-inverse" style={{ fontSize: 16 }}>
                {rank.title}
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60" style={{ fontSize: 11.5 }}>
                {next ? `${toGo} XP avant ${next.title}` : 'Rang maximal atteint'}
              </AppText>
            </View>
            {streak > 0 ? (
              <View
                testID="hub-streak"
                className={cn(
                  'flex-row items-center gap-1 rounded-pill px-2.5 py-1',
                  alive ? 'bg-brand-500' : 'bg-ink-inverse/15',
                )}
              >
                <Feather name="zap" size={12} color={colors.inkInverse} />
                <AppText
                  className="font-sans-bold text-ink-inverse"
                  style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}
                >
                  {streak} j
                </AppText>
              </View>
            ) : null}
          </View>

          <View className="px-4 pt-3">
            <View className="h-1.5 overflow-hidden rounded-pill bg-ink-inverse/15">
              <View
                testID="hub-xp-bar"
                className="h-full rounded-pill bg-lime"
                style={{ width: `${Math.round(ratio * 100)}%` }}
              />
            </View>
          </View>

          <View className="flex-row gap-2 p-4">
            <LootChip testID="hub-loot-xp" icon="zap" value={`${xp}`} label="XP" />
            <LootChip
              testID="hub-loot-points"
              icon="award"
              value={`${points}`}
              label="points"
              onPress={onOpenWallet}
            />
            <LootChip
              testID="hub-loot-coupons"
              icon="tag"
              value={`${couponsCount}`}
              label={couponsCount > 1 ? 'coupons' : 'coupon'}
              onPress={onOpenCoupons}
            />
          </View>

          {criticalCount > 0 ? (
            <View
              testID="hub-critical"
              className="flex-row items-center gap-2 bg-brand-500 px-4 py-2.5"
            >
              <Feather name="alert-circle" size={14} color={colors.inkInverse} />
              <AppText
                className="flex-1 font-sans-semibold text-ink-inverse"
                style={{ fontSize: 12.5 }}
              >
                {criticalCount} offre{criticalCount > 1 ? 's' : ''} en dernière chance
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Le cadeau quotidien */}
        <View className="mt-3">
          <ChestCard
            available={chestAvailable(lastChest?.day ?? null, dayKey(now))}
            last={lastChest}
            onOpen={onOpen}
          />
        </View>

        {/* Missions du jour */}
        <SectionHeader
          title="Missions du jour"
          hint={`${done} sur ${missions.length} accomplies`}
        />
        <View className="mx-5 rounded-card border border-line bg-surface p-4">
          <MissionList missions={missions} counts={counts} tone="light" />
        </View>

        {/* Déstockage — le cœur de l'app */}
        <SectionHeader
          title="Dernière chance"
          hint="Ça disparaît dans quelques minutes"
          actionLabel="Tout voir"
          onAction={onSeeAllDeals}
          testID="hub-see-deals"
        />
        {renderLiquidation ? renderLiquidation() : null}

        {/* Mini-jeux */}
        <SectionHeader
          title="Mini-jeux"
          hint="Chaque victoire donne un coupon"
          actionLabel="Tous les jeux"
          onAction={onSeeAllGames}
          testID="hub-see-games"
        />
        {renderGames ? renderGames() : null}

        {/* Offres réservées aux membres */}
        <SectionHeader
          title="Offres membres"
          hint="Réservées aux porteurs de la carte"
          actionLabel="Tout voir"
          onAction={onSeeAllOffers}
          testID="hub-see-offers"
        />
        {renderOffers ? renderOffers() : null}

        {/* Trophées */}
        <SectionHeader
          title="Trophées"
          hint={`${earnedCount(badges)} sur ${badges.length} débloqués`}
        />
        <BadgesGrid badges={badges} />

        {/* Classement */}
        <SectionHeader title="Classement du quartier" hint="Remis à jour chaque jour" />
        <LeaderboardCard rows={board} />
      </ScrollView>
    </Screen>
  );
}
