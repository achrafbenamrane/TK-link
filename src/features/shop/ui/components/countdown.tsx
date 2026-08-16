import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';

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

type Props = {
  seconds: number;
  className?: string;
};

/** Ticking flash-sale countdown. Loops for the demo so it never hits zero. */
export function Countdown({ seconds, className }: Props) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    // Synchronisation avec une horloge externe : le cas d'usage même d'un
    // effet, y compris pour la remise à zéro qui l'accompagne.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- réarmement du minuteur
    setLeft(seconds);
    const id = setInterval(() => setLeft((v) => (v <= 0 ? seconds : v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <AppText
      className={cn('font-sans-semibold', className)}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {formatCountdown(left)}
    </AppText>
  );
}
