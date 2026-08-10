import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { GAME_TILES, playableGames, type GameKey } from '../model/tiles';

type Props = {
  /** Taille des réservoirs disponibles — sert à verrouiller les jeux sans matière. */
  pools?: { images: number; quiz: number; words: number };
  onPlay: (game: GameKey) => void;
};

/**
 * Le rail de mini-jeux — la version compacte du menu « Jeux », faite pour
 * vivre AU MILIEU d'un autre écran (le hub) sans en prendre toute la hauteur.
 *
 * Même table de jeux que l'écran plein (`GAME_TILES`) : un jeu ajouté apparaît
 * ici sans rien toucher.
 */
export function GamesRail({ pools = { images: 0, quiz: 0, words: 0 }, onPlay }: Props) {
  const playable = playableGames(pools);

  return (
    <ScrollView
      testID="games-rail"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-5"
    >
      {GAME_TILES.map((t) => {
        const locked = !playable[t.key];
        return (
          <Pressable
            key={t.key}
            testID={`games-rail-${t.key}`}
            accessibilityRole="button"
            accessibilityLabel={locked ? `${t.name}, verrouillé` : `Jouer à ${t.name}`}
            onPress={() => !locked && onPlay(t.key)}
            disabled={locked}
            className={cn(
              'w-36 overflow-hidden rounded-card p-3.5 active:opacity-85',
              t.dark ? 'bg-ink' : 'bg-brand-500',
              locked && 'opacity-50',
            )}
            style={{ height: 150 }}
          >
            <View className="h-9 w-9 items-center justify-center rounded-control bg-ink-inverse/15">
              <Feather name={t.icon} size={18} color={colors.inkInverse} />
            </View>
            <View className="mt-auto gap-0.5">
              <AppText
                className="font-sans-bold text-ink-inverse"
                style={{ fontSize: 13.5 }}
                numberOfLines={2}
              >
                {t.name}
              </AppText>
              <View className="mt-1 flex-row items-center gap-1.5">
                <Feather
                  name={locked ? 'lock' : 'play'}
                  size={11}
                  color={locked ? colors.inkInverse : colors.lime}
                />
                <AppText
                  className={cn('font-sans-semibold', locked ? 'text-ink-inverse/80' : 'text-lime')}
                  style={{ fontSize: 11 }}
                >
                  {locked ? 'Bientôt' : 'Coupon à gagner'}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
