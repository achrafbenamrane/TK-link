import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import {
  answerCurrent,
  correctCount,
  currentQuestion,
  isAnswered,
  newQuiz,
  next,
  type QuizGame as Game,
  type QuizItem,
} from '../model/quiz';
import { GameShell, TimerPill, gameTheme } from './game-shell';
import { useCountdown } from './use-countdown';

type Props = {
  pool: QuizItem[];
  onWin: () => void;
  onExit: () => void;
};

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

/** Secondes pour répondre à CHAQUE question — sinon, comptée fausse. */
const PER_Q = 10;

export function QuizGame({ pool, onWin, onExit }: Props) {
  const [game, setGame] = useState<Game>(() => newQuiz(pool));
  const [wonNotified, setWonNotified] = useState(false);

  const answered = isAnswered(game);

  // Minuteur par question : à zéro, on répond « faux » à sa place.
  const remaining = useCountdown(
    PER_Q,
    game.status === 'playing' && !answered,
    () =>
      setGame((g) => {
        const q = currentQuestion(g);
        if (!q || isAnswered(g)) return g;
        const wrong = q.choices.findIndex((_, i) => i !== q.correctIndex);
        return wrong >= 0 ? answerCurrent(g, wrong) : g;
      }),
    game.current,
  );

  // Victoire signalée une seule fois (récompense côté appelant).
  useEffect(() => {
    if (game.status === 'won' && !wonNotified) {
      setWonNotified(true);
      onWin();
    }
  }, [game.status, wonNotified, onWin]);

  const restart = () => {
    setWonNotified(false);
    setGame(newQuiz(pool));
  };

  const total = game.questions.length;
  const score = correctCount(game);

  if (game.status !== 'playing') {
    const won = game.status === 'won';
    return (
      <GameShell title="LE JUSTE" accent="PRIX" onBack={onExit} scroll={false}>
        <View testID="quiz-result" className="items-center gap-3 rounded-card bg-ink-inverse p-6">
          <View
            className="h-14 w-14 items-center justify-center rounded-pill"
            style={{ backgroundColor: won ? colors.brand50 : colors.surfaceSunken }}
          >
            <Feather
              name={won ? 'gift' : 'refresh-ccw'}
              size={26}
              color={won ? colors.brand500 : colors.inkMuted}
            />
          </View>
          <AppText variant="title" className="text-center text-xl">
            {won ? 'Bravo ! Coupon débloqué 🎉' : 'Presque — on retente ?'}
          </AppText>
          <AppText variant="caption" className="text-center">
            {score}/{total} bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''}
            {won ? ' · votre coupon vous attend dans « Mes coupons ».' : '.'}
          </AppText>
          <View className="mt-1 w-full gap-2">
            <Pressable
              testID="quiz-restart"
              accessibilityRole="button"
              onPress={restart}
              className="items-center rounded-control bg-brand-500 py-3.5 active:bg-brand-600"
            >
              <AppText className="font-sans-bold text-ink-inverse">
                {won ? 'Rejouer' : 'Nouveau quiz'}
              </AppText>
            </Pressable>
            <Pressable
              testID="quiz-exit"
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
      </GameShell>
    );
  }

  const q = currentQuestion(game);
  if (!q) return null;
  const pick = game.picks[game.current];
  const isLast = game.current === total - 1;

  return (
    <GameShell
      title="LE JUSTE"
      accent="PRIX"
      subtitle={`Question ${game.current + 1}/${total} · ${score} bonne(s) · seuil ${game.passMark}`}
      onBack={onExit}
    >
      <TimerPill remaining={remaining} low={remaining <= 3} />

      {/* La carte offre (crème sur rouge) */}
      <View className="items-center gap-2 rounded-card bg-ink-inverse p-6">
        <AppText style={{ fontSize: 56, lineHeight: 64 }}>{q.emoji}</AppText>
        <AppText variant="title" className="text-center text-lg" numberOfLines={2}>
          {q.title}
        </AppText>
        <AppText variant="caption" className="text-ink-faint">
          Quel est son prix flash ?
        </AppText>
      </View>

      {/* Propositions */}
      <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
        {q.choices.map((c, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = pick === i;
          // Sur fond rouge : crème par défaut, vert si bon, sombre si mauvais choix.
          const tone = !answered
            ? 'bg-ink-inverse'
            : isCorrect
              ? 'bg-success'
              : isPicked
                ? 'bg-ink'
                : 'bg-ink-inverse/50';
          const textTone = answered && (isCorrect || isPicked) ? 'text-ink-inverse' : 'text-ink';
          return (
            <Pressable
              key={i}
              testID={`quiz-choice-${i}`}
              accessibilityRole="button"
              disabled={answered}
              onPress={() => setGame((g) => answerCurrent(g, i))}
              className={cn(
                'w-[48%] flex-row items-center justify-between rounded-card px-4 py-4',
                tone,
              )}
            >
              <AppText className={cn('font-display text-base', textTone)}>{eur(c)}</AppText>
              {answered && isCorrect ? (
                <Feather name="check" size={18} color={colors.inkInverse} />
              ) : answered && isPicked ? (
                <Feather name="x" size={18} color={colors.inkInverse} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Suite */}
      {answered ? (
        <Pressable
          testID="quiz-next"
          accessibilityRole="button"
          onPress={() => setGame((g) => next(g))}
          className="mt-6 flex-row items-center justify-center gap-2 rounded-control py-4"
          style={{ backgroundColor: gameTheme.gold }}
        >
          <AppText className="font-sans-bold text-ink">
            {isLast ? 'Voir le résultat' : 'Question suivante'}
          </AppText>
          <Feather name="arrow-right" size={18} color={colors.ink} />
        </Pressable>
      ) : null}
    </GameShell>
  );
}
