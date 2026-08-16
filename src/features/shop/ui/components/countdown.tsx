import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

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
  const s = Math.max(0, total);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Les trois nombres du compte à rebours, déjà complétés à deux chiffres. */
export function countdownParts(total: number): { h: string; m: string; s: string } {
  const [h, m, s] = formatCountdown(total).split(':');
  return { h: h ?? '00', m: m ?? '00', s: s ?? '00' };
}

/**
 * Le décompte lui-même, partagé par les deux présentations.
 *
 * Il boucle au lieu d'atteindre zéro : le catalogue est écrit en dur, une offre
 * de démonstration qui expire laisserait une carte morte à l'écran pendant la
 * présentation au client. Le jour où le back-end donne une vraie date de fin,
 * c'est ici — et nulle part ailleurs — que la boucle disparaît.
 */
function useCountdown(seconds: number): number {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    // Synchronisation avec une horloge externe : le cas d'usage même d'un
    // effet, y compris pour la remise à zéro qui l'accompagne.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réarmement du minuteur
    setLeft(seconds);
    const id = setInterval(() => setLeft((v) => (v <= 0 ? seconds : v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return left;
}

type Props = {
  seconds: number;
  className?: string;
};

/** Compte à rebours compact — une seule ligne, pour les pastilles de carte. */
export function Countdown({ seconds, className }: Props) {
  const left = useCountdown(seconds);

  return (
    <AppText
      className={cn('font-sans-semibold', className)}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {formatCountdown(left)}
    </AppText>
  );
}

/** Les trois unités, dans l'ordre et avec leur légende — comme sur les affiches. */
const UNITS = [
  { key: 'h', label: 'H' },
  { key: 'm', label: 'MIN' },
  { key: 's', label: 'SEC' },
] as const;

/**
 * LE COMPTE À REBOURS DES AFFICHES : trois blocs, l'unité écrite dessous.
 *
 * Les quatre affiches remises par le client montrent toutes la même chose —
 * « 00 : 28 : 45 » en gros, avec H, MIN et SEC sous les nombres. Ce n'est pas
 * de la décoration : sans les légendes, « 00:15:45 » se lit aussi bien quinze
 * minutes que quinze heures, et l'urgence — le seul argument d'une vente
 * flash — se perd exactement là où elle doit porter.
 *
 * La version compacte reste pour les listes, où la place manque. Celle-ci est
 * faite pour l'écran qui décide de l'achat.
 */
export function CountdownBlocks({
  seconds,
  size = 30,
  testID,
}: {
  seconds: number;
  /** Taille des chiffres. Tout le bloc se dimensionne dessus. */
  size?: number;
  testID?: string;
}) {
  const left = useCountdown(seconds);
  const parts = countdownParts(left);

  return (
    <View
      testID={testID}
      className="flex-row items-start"
      style={{ gap: size * 0.24 }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Il reste ${parts.h} heures, ${parts.m} minutes et ${parts.s} secondes`}
    >
      {UNITS.map((u, i) => (
        <View key={u.key} className="flex-row items-start" style={{ gap: size * 0.24 }}>
          <View className="items-center" style={{ gap: size * 0.12 }}>
            <View
              className="items-center justify-center rounded-control"
              style={{
                backgroundColor: colors.ink,
                minWidth: size * 1.55,
                paddingHorizontal: size * 0.2,
                paddingVertical: size * 0.18,
              }}
            >
              <AppText
                className="font-display text-ink-inverse"
                style={{ fontSize: size, fontVariant: ['tabular-nums'] }}
              >
                {parts[u.key]}
              </AppText>
            </View>
            <AppText
              className="font-sans-bold text-ink-faint"
              style={{ fontSize: size * 0.32, letterSpacing: size * 0.02 }}
            >
              {u.label}
            </AppText>
          </View>

          {/* Le séparateur s'aligne sur les chiffres, pas sur le bloc entier :
              centré verticalement il flotterait entre les nombres et leur
              légende, au lieu de séparer les nombres. */}
          {i < UNITS.length - 1 ? (
            <AppText
              className="font-display text-ink-faint"
              style={{ fontSize: size * 0.8, marginTop: size * 0.15 }}
            >
              :
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}
