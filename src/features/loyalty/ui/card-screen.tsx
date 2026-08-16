import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { AppText, Screen } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { formatCardNumber, nextGift, pointsMissing, progressToward } from '../lib/loyalty';
import {
  selectBalance,
  selectCard,
  selectEntries,
  selectGifts,
  useLoyaltyStore,
} from '../model/store';

type Props = {
  onOpenGifts: () => void;
};

/**
 * Un « QR » décoratif, dessiné depuis le numéro de carte.
 *
 * Ce n'est PAS un vrai QR code : en production, le code présenté au commerçant est
 * généré et signé côté serveur (sinon il serait falsifiable). Ici on donne au
 * commerçant quelque chose de crédible à scanner pour la démo, dérivé du numéro
 * pour qu'il reste stable d'un affichage à l'autre.
 */
function CardCode({ seed, size = 108 }: { seed: string; size?: number }) {
  const cells = 13;
  const cell = size / cells;
  const squares = useMemo(() => {
    // Générateur déterministe : même numéro → même dessin.
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        h = (h * 1103515245 + 12345) >>> 0;
        if ((h >>> 16) % 100 < 46) out.push({ x, y });
      }
    }
    return out;
  }, [seed]);

  return (
    <View className="rounded-control bg-surface p-2">
      <Svg width={size} height={size}>
        {squares.map((s, i) => (
          <Rect
            key={i}
            x={s.x * cell}
            y={s.y * cell}
            width={cell}
            height={cell}
            fill={colors.forest}
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * La carte de fidélité — ce qu'on ouvre devant le lecteur en caisse.
 *
 * L'écran est construit pour être lisible à bout de bras : le code d'abord, le
 * solde ensuite, puis le prochain palier qui donne envie de revenir.
 */
export function LoyaltyCardScreen({ onOpenGifts }: Props) {
  const card = useLoyaltyStore(selectCard);
  const balance = useLoyaltyStore(selectBalance);
  const entries = useLoyaltyStore(selectEntries);
  const gifts = useLoyaltyStore(selectGifts);

  const holderType = card?.holderType ?? 'particulier';
  const goal = useMemo(() => nextGift(gifts, balance, holderType), [gifts, balance, holderType]);
  const recent = useMemo(() => entries.slice(0, 6), [entries]);

  return (
    <Screen testID="loyalty-card-screen" padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-5 pb-8">
        <View className="pb-4 pt-2">
          <AppText variant="display" className="text-2xl">
            Ma carte
          </AppText>
          <AppText variant="caption" className="mt-0.5">
            Présentez ce code au commerçant.
          </AppText>
        </View>

        {/* La carte */}
        <View className="overflow-hidden rounded-card bg-surface-inverse p-5">
          <View className="flex-row items-start justify-between">
            <View>
              <AppText
                className="font-display text-ink-inverse"
                style={{ fontSize: 20, letterSpacing: 1 }}
              >
                TK LINK
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                Carte de fidélité
                {holderType === 'pro' ? ' · Pro' : ''}
              </AppText>
            </View>
            <Feather
              name="wifi"
              size={20}
              color={colors.lime}
              style={{ transform: [{ rotate: '90deg' }] }}
            />
          </View>

          <View className="mt-5 flex-row items-center gap-4">
            <CardCode seed={card?.number ?? '70142299'} />
            <View className="flex-1 gap-1">
              <AppText variant="caption" className="text-ink-inverse/60">
                Solde
              </AppText>
              <AppText
                className="font-display text-lime"
                style={{ fontSize: 34, fontVariant: ['tabular-nums'] }}
              >
                {balance}
              </AppText>
              <AppText variant="caption" className="text-ink-inverse/60">
                points
              </AppText>
            </View>
          </View>

          <AppText
            className="mt-4 font-sans-medium text-ink-inverse/80"
            style={{ fontSize: 13, letterSpacing: 2, fontVariant: ['tabular-nums'] }}
          >
            {formatCardNumber(card?.number ?? '70142299')}
          </AppText>
        </View>

        {/* Prochain palier */}
        {goal ? (
          <Pressable
            testID="loyalty-next-gift"
            accessibilityRole="button"
            accessibilityLabel={`Prochain cadeau : ${goal.title}`}
            onPress={onOpenGifts}
            className="mt-4 gap-2.5 rounded-card bg-surface p-4 active:opacity-80"
            style={{ borderWidth: 1, borderColor: colors.line }}
          >
            <View className="flex-row items-center justify-between">
              <AppText className="font-sans-semibold text-ink">Prochain cadeau</AppText>
              <Feather name="chevron-right" size={18} color={colors.inkFaint} />
            </View>
            <AppText variant="caption">
              <AppText className="font-sans-bold text-ink">{goal.title}</AppText> — encore{' '}
              <AppText className="font-sans-bold text-brand-600">
                {pointsMissing(goal, balance)} points
              </AppText>
            </AppText>
            {/* Barre de progression */}
            <View className="h-2 overflow-hidden rounded-pill bg-surface-sunken">
              <View
                className="h-full rounded-pill bg-brand-500"
                style={{ width: `${Math.round(progressToward(goal, balance) * 100)}%` }}
              />
            </View>
          </Pressable>
        ) : null}

        {/* Accès cadeaux */}
        <Pressable
          testID="loyalty-open-gifts"
          accessibilityRole="button"
          accessibilityLabel="Voir les cadeaux"
          onPress={onOpenGifts}
          className="mt-3 flex-row items-center gap-3 rounded-card bg-brand-50 p-4 active:opacity-80"
        >
          <View className="h-10 w-10 items-center justify-center rounded-control bg-brand-500">
            <Feather name="gift" size={19} color={colors.inkInverse} />
          </View>
          <View className="flex-1">
            <AppText className="font-sans-semibold text-brand-700">Mes cadeaux</AppText>
            <AppText variant="caption" className="text-brand-700/70">
              Échangez vos points contre des récompenses.
            </AppText>
          </View>
          <Feather name="chevron-right" size={18} color={colors.brand600} />
        </Pressable>

        {/* Historique des points */}
        <View className="mt-6 gap-2.5">
          <AppText className="font-sans-semibold text-ink">Derniers mouvements</AppText>
          {recent.map((e) => (
            <View
              key={e.id}
              className="flex-row items-center gap-3 rounded-card bg-surface p-3.5"
              style={{ borderWidth: 1, borderColor: colors.line }}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-control"
                style={{ backgroundColor: e.points >= 0 ? colors.brand50 : colors.surfaceSunken }}
              >
                <Feather
                  name={
                    e.source === 'jeu'
                      ? 'target'
                      : e.source === 'parrainage'
                        ? 'users'
                        : e.source === 'cadeau'
                          ? 'gift'
                          : 'shopping-bag'
                  }
                  size={16}
                  color={e.points >= 0 ? colors.brand600 : colors.inkMuted}
                />
              </View>
              <AppText className="flex-1 text-ink" style={{ fontSize: 14 }} numberOfLines={1}>
                {e.label}
              </AppText>
              <AppText
                className={
                  e.points >= 0 ? 'font-sans-bold text-brand-600' : 'font-sans-bold text-ink-muted'
                }
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {e.points >= 0 ? `+${e.points}` : e.points}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
