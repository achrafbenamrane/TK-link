import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';

function format(total: number): string {
  const s = Math.max(0, total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

type Props = {
  seconds: number;
  className?: string;
};

/** Ticking flash-sale countdown. Loops for the demo so it never hits zero. */
export function Countdown({ seconds, className }: Props) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const id = setInterval(() => setLeft((v) => (v <= 0 ? seconds : v - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <AppText
      className={cn('font-sans-semibold', className)}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {format(left)}
    </AppText>
  );
}
