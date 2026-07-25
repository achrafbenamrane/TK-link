import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { newWordSearch, selectLine, type WordSearch } from '../model/wordsearch';
import { GameShell, TimerPill, gameTheme } from './game-shell';
import { useCountdown } from './use-countdown';

type Props = {
  /** Mots à cacher (mots courts de nourriture). */
  words: string[];
  onWin: () => void;
  onExit: () => void;
};

/** Temps imparti (secondes) pour trouver tous les mots. */
const BUDGET = 60;

export function WordSearchGame({ words, onWin, onExit }: Props) {
  const [game, setGame] = useState<WordSearch>(() => newWordSearch(words));
  const [first, setFirst] = useState<number | null>(null);
  const [wonNotified, setWonNotified] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [round, setRound] = useState(0);

  const won = game.status === 'won';
  const over = won || timedOut;

  const remaining = useCountdown(BUDGET, !over, () => setTimedOut(true), round);

  useEffect(() => {
    if (won && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [won, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    setTimedOut(false);
    setRound((r) => r + 1);
    setFirst(null);
    setGame(newWordSearch(words));
  };

  // Cases appartenant à un mot déjà trouvé → surlignées.
  const foundCells = new Set<number>();
  game.placed
    .filter((p) => game.found.includes(p.word))
    .forEach((p) => p.cells.forEach((c) => foundCells.add(c)));

  const onCell = (i: number) => {
    if (over) return;
    if (first === null) {
      setFirst(i);
      return;
    }
    if (first === i) {
      setFirst(null);
      return;
    }
    setGame((g) => selectLine(g, first, i));
    setFirst(null);
  };

  const size = game.size;

  return (
    <GameShell
      title="MOTS"
      accent="MÊLÉS"
      subtitle={`${game.found.length}/${game.placed.length} trouvés · ligne, colonne ou diagonale`}
      onBack={onExit}
    >
      <TimerPill remaining={remaining} low={remaining <= 10} />

      {/* Grille de lettres */}
      <View className="mt-1 self-center" style={{ width: '100%', maxWidth: 360 }}>
        {Array.from({ length: size }).map((_, r) => (
          <View key={r} className="flex-row">
            {Array.from({ length: size }).map((_, c) => {
              const i = r * size + c;
              const isFound = foundCells.has(i);
              const isFirst = first === i;
              return (
                <Pressable
                  key={c}
                  testID={`ws-cell-${i}`}
                  accessibilityRole="button"
                  onPress={() => onCell(i)}
                  className="m-0.5 flex-1 items-center justify-center rounded-md"
                  style={{
                    aspectRatio: 1,
                    backgroundColor: isFound
                      ? gameTheme.gold
                      : isFirst
                        ? 'rgba(255,194,75,0.4)'
                        : 'transparent',
                  }}
                >
                  <AppText
                    className="font-display"
                    style={{ color: isFound ? colors.ink : colors.inkInverse, fontSize: 15 }}
                  >
                    {game.grid[i]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Mots à trouver */}
      <View className="mt-5 flex-row flex-wrap justify-center gap-2">
        {game.placed.map((p) => {
          const got = game.found.includes(p.word);
          return (
            <View
              key={p.word}
              className={cn(
                'rounded-pill px-3 py-1.5',
                got ? 'bg-ink-inverse' : 'border border-ink-inverse/40',
              )}
            >
              <AppText
                className="font-sans-bold text-xs"
                style={{ color: got ? colors.ink : colors.inkInverse }}
              >
                {p.word}
              </AppText>
            </View>
          );
        })}
      </View>

      {over ? (
        <View
          testID="ws-result"
          className="mt-6 items-center gap-3 rounded-card bg-ink-inverse p-6"
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: won ? colors.brand50 : colors.surfaceSunken }}
          >
            <Feather
              name={won ? 'gift' : 'clock'}
              size={26}
              color={won ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {won ? 'Tous trouvés ! Coupon débloqué 🎉' : 'Temps écoulé — on retente ?'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="ws-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">Nouvelle grille</AppText>
            </Pressable>
            <Pressable
              testID="ws-exit"
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
