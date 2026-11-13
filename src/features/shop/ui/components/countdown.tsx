import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { TickingText, useRemainingMs, useRemainingSeconds } from '@/shared/ui/ticking-text';
import { useColors } from '@/shared/theme/theme-provider';

const pad = (n: number): string => {
  'worklet';
  return n < 10 ? `0${n}` : `${n}`;
};

/**
 * Toujours HH:MM:SS, même sous l'heure.
 *
 * Le format changeait de longueur en passant sous soixante minutes — « 01:12 »
 * après « 1:01:12 ». Deux défauts : la pastille se rétrécissait d'un coup au
 * milieu du compte à rebours, et « 04:31 » est ambigu à la lecture (quatre
 * minutes ou quatre heures ?). Les affiches du client tranchent : elles
 * montrent « 00 : 28 : 45 » et « 00:15:45 », toujours trois blocs.
 */
export function formatCountdown(total: number): string {
  'worklet';
  const s = Math.max(0, Math.floor(total));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Les trois nombres du compte à rebours, déjà complétés à deux chiffres. */
export function countdownParts(total: number): { h: string; m: string; s: string } {
  const [h, m, s] = formatCountdown(total).split(':');
  return { h: h ?? '00', m: m ?? '00', s: s ?? '00' };
}

/**
 * Les centièmes de seconde, sur deux chiffres — le rapport d’avancement remis au client les annonce
 * (« 14:59.99 ») : ils rendent l’urgence visible.
 */
export function formatCentiseconds(remainingMs: number): string {
  'worklet';
  return pad(Math.floor(Math.max(0, remainingMs) / 10) % 100);
}

const clockOf = (ms: number): string => {
  'worklet';
  return formatCountdown(ms / 1000);
};
const centisOf = (ms: number): string => {
  'worklet';
  return `.${formatCentiseconds(ms)}`;
};
const hoursOf = (ms: number): string => {
  'worklet';
  return pad(Math.floor(Math.max(0, ms) / 3600000));
};
const minutesOf = (ms: number): string => {
  'worklet';
  return pad(Math.floor(Math.max(0, ms) / 60000) % 60);
};
const secondsOf = (ms: number): string => {
  'worklet';
  return pad(Math.floor(Math.max(0, ms) / 1000) % 60);
};
const centisBlockOf = (ms: number): string => {
  'worklet';
  return formatCentiseconds(ms);
};

function timerLabel(seconds: number): string {
  const { h, m, s } = countdownParts(seconds);
  return `Il reste ${h} heures, ${m} minutes et ${s} secondes`;
}

type Props = {
  seconds: number;
  /** Fin réelle d’une Flash du serveur (ms). Sans elle, le décompte boucle (offres d’exemple). */
  endsAt?: number | undefined;
  className?: string;
};

/**
 * Compte à rebours compact — une seule ligne, pour les pastilles de carte.
 *
 * Il ne se tronque JAMAIS. Une offre de 24 h affiche « 24:00:00 » (et « 100:00:00 »
 * au-delà de quatre jours) : plus large que « 00:28:45 ». Dans une pastille ou
 * une rangée flex serrée, le moteur de mise en page rogne alors le texte le plus
 * « compressible » — celui-ci, par défaut. `flexShrink: 0` l'en empêche : c'est
 * le voisin (titre, prix) qui cède.
 *
 * Les centièmes suivent, un peu atténués ; ils disparaissent si l’utilisateur a demandé de réduire
 * les animations (un chiffre qui défile en continu en est une).
 */
export function Countdown({ seconds, endsAt, className }: Props) {
  const remaining = useRemainingMs(seconds, endsAt);
  const left = useRemainingSeconds(remaining);
  const reduced = useReducedMotion();
  const text = cn('font-sans-semibold text-base text-ink', className);

  return (
    <View
      className="flex-row items-baseline"
      style={{ flexShrink: 0 }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={timerLabel(left)}
    >
      <TickingText
        testID="countdown-clock"
        remaining={remaining}
        format={clockOf}
        className={text}
      />
      {reduced ? null : (
        <TickingText
          testID="countdown-centis"
          remaining={remaining}
          format={centisOf}
          className={cn(text, 'opacity-70')}
        />
      )}
    </View>
  );
}

/** Les unités, dans l'ordre et avec leur légende — comme sur les affiches. */
const UNITS = [
  { key: 'h', label: 'H', format: hoursOf },
  { key: 'm', label: 'MIN', format: minutesOf },
  { key: 's', label: 'SEC', format: secondsOf },
] as const;

/**
 * LE COMPTE À REBOURS DES AFFICHES : trois blocs, l'unité écrite dessous.
 *
 * Les quatre affiches remises par le client montrent toutes la même chose —
 * « 00 : 28 : 45 » en gros, avec H, MIN et SEC sous les nombres. Ce n'est pas
 * de la décoration : sans les légendes, « 00:15:45 » se lit aussi bien quinze
 * minutes que quinze heures, et l'urgence — le seul argument d'une vente
 * flash — se perd exactement là où elle doit porter. Un quatrième bloc, plus
 * petit, égrène les centièmes (sauf si les animations sont réduites).
 *
 * La version compacte reste pour les listes, où la place manque. Celle-ci est
 * faite pour l'écran qui décide de l'achat.
 */
export function CountdownBlocks({
  seconds,
  endsAt,
  size = 30,
  testID,
}: {
  seconds: number;
  endsAt?: number | undefined;
  /** Taille des chiffres. Tout le bloc se dimensionne dessus. */
  size?: number;
  testID?: string;
}) {
  const colors = useColors();
  const remaining = useRemainingMs(seconds, endsAt);
  const left = useRemainingSeconds(remaining);
  const reduced = useReducedMotion();

  // Des HAUTEURS FIXES, dérivées de la taille des chiffres : les séparateurs et le petit bloc des
  // centièmes s'alignent dessus. Avec des marges « à l'œil », les « : » flottaient en haut des
  // blocs et les centièmes ne tombaient sur rien.
  const boxHeight = (digits: number) => Math.round(digits * 1.7);
  const big = boxHeight(size);
  const centis = Math.round(size * 0.62);

  const block = (key: string, label: string, format: (ms: number) => string, digits: number) => (
    <View className="items-center" style={{ gap: size * 0.12 }}>
      <View
        className="items-center justify-center rounded-control"
        style={{
          backgroundColor: colors.surfaceInverse,
          minWidth: digits * 1.55,
          height: boxHeight(digits),
          paddingHorizontal: digits * 0.2,
        }}
      >
        <TickingText
          testID={testID ? `${testID}-${key}` : undefined}
          remaining={remaining}
          format={format}
          className="text-center font-display text-ink-inverse"
          style={{ fontSize: digits }}
        />
      </View>
      <AppText
        className="font-sans-bold text-ink-faint"
        style={{ fontSize: size * 0.32, letterSpacing: size * 0.02 }}
      >
        {label}
      </AppText>
    </View>
  );

  // Le séparateur s'aligne sur les blocs de chiffres, pas sur le bloc entier (chiffres + légende) :
  // les « : » au milieu de la hauteur des chiffres, la virgule en bas, comme un décimal.
  const separator = (char: string) => (
    <View style={{ height: big, justifyContent: char === ',' ? 'flex-end' : 'center' }}>
      <AppText
        className="font-display text-ink-faint"
        style={{
          fontSize: size * 0.8,
          lineHeight: size,
          marginBottom: char === ',' ? size * 0.1 : 0,
        }}
      >
        {char}
      </AppText>
    </View>
  );

  return (
    <View
      testID={testID}
      className="flex-row items-start"
      style={{ gap: size * 0.24 }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={timerLabel(left)}
    >
      {UNITS.map((u, i) => (
        <View key={u.key} className="flex-row items-start" style={{ gap: size * 0.24 }}>
          {block(u.key, u.label, u.format, size)}
          {i < UNITS.length - 1 ? separator(':') : null}
        </View>
      ))}
      {reduced ? null : (
        <View className="flex-row items-start" style={{ gap: size * 0.24 }}>
          {separator(',')}
          {/* Le petit bloc s'aligne par le BAS sur les grands, comme une décimale. */}
          <View style={{ marginTop: big - boxHeight(centis) }}>
            {block('cs', '1/100', centisBlockOf, centis)}
          </View>
        </View>
      )}
    </View>
  );
}
