import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import type { CardImage } from '../model/memory';
import { newMorpion, playAt, winningLine, type Morpion } from '../model/morpion';
import { GameShell } from './game-shell';

type Props = {
  /** Deux visuels d'offres : le premier est VOTRE pion, le second celui de l'app. */
  images: CardImage[];
  onWin: () => void;
  onExit: () => void;
};

export function MorpionGame({ images, onWin, onExit }: Props) {
  const [game, setGame] = useState<Morpion>(() => newMorpion());
  const [wonNotified, setWonNotified] = useState(false);

  const me = images[0];
  const ai = images[1] ?? images[0];

  useEffect(() => {
    if (game.status === 'won' && !wonNotified) {
      setWonNotified(true);
      onWin(); // seule VOTRE victoire donne un coupon
    }
  }, [game.status, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    setGame(newMorpion());
  };

  const line = winningLine(game.board);
  const done = game.status !== 'playing';

  return (
    <GameShell
      title="ALIGNEZ POUR"
      accent="GAGNER"
      subtitle="Trois plats en ligne — avant l’app."
      onBack={onExit}
    >
      {/* Plateau 3×3, lignes blanches façon affiche */}
      <View className="mt-2 self-center" style={{ width: '100%', maxWidth: 340, aspectRatio: 1 }}>
        <View className="flex-1 flex-row flex-wrap">
          {game.board.map((mark, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const inLine = line?.includes(i);
            const piece = mark === 'me' ? me : mark === 'ai' ? ai : null;
            return (
              <Pressable
                key={i}
                testID={`morpion-cell-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Case ${i + 1}`}
                disabled={done || mark !== null}
                onPress={() => setGame((g) => playAt(g, i))}
                style={{
                  width: '33.3333%',
                  height: '33.3333%',
                  borderColor: colors.inkInverse,
                  borderRightWidth: col < 2 ? 5 : 0,
                  borderBottomWidth: row < 2 ? 5 : 0,
                  padding: 10,
                  opacity: done && !inLine && piece ? 0.55 : 1,
                }}
              >
                {piece ? (
                  <View className="flex-1 overflow-hidden rounded-card">
                    <Image source={piece.source} style={{ flex: 1 }} contentFit="cover" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Fin de partie */}
      {done ? (
        <View
          testID="morpion-result"
          className="mt-6 items-center gap-3 rounded-card bg-ink-inverse p-6"
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{
              backgroundColor: game.status === 'won' ? colors.brand50 : colors.surfaceSunken,
            }}
          >
            <Feather
              name={game.status === 'won' ? 'gift' : game.status === 'lost' ? 'x' : 'refresh-ccw'}
              size={26}
              color={game.status === 'won' ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {game.status === 'won'
              ? 'Gagné ! Coupon débloqué 🎉'
              : game.status === 'lost'
                ? 'L’app a gagné — on retente ?'
                : 'Match nul — rejouez !'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="morpion-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">
                {game.status === 'won' ? 'Rejouer' : 'Nouvelle partie'}
              </AppText>
            </Pressable>
            <Pressable
              testID="morpion-exit"
              accessibilityRole="button"
              onPress={onExit}
              className="py-2"
            >
              <AppText variant="caption" className="text-center text-ink-muted">
                Retour aux jeux
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </GameShell>
  );
}
