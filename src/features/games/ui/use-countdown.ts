import { useEffect, useRef, useState } from 'react';

/**
 * Compte à rebours réutilisable pour les jeux. Décompte `budget` secondes tant
 * que `active` est vrai ; se réarme dès que `resetKey` change (nouveau tour,
 * nouvelle question, nouveau coup) ; appelle `onExpire` UNE seule fois à zéro.
 *
 * `onExpire` est gardé dans une ref : le changer ne relance pas le minuteur.
 */
export function useCountdown(
  budget: number,
  active: boolean,
  onExpire: () => void,
  resetKey: unknown,
): number {
  const [remaining, setRemaining] = useState(budget);
  const startRef = useRef(Date.now());
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Réarmement à chaque changement de clé (relance, coup suivant…).
  useEffect(() => {
    startRef.current = Date.now();
    firedRef.current = false;
    setRemaining(budget);
  }, [resetKey, budget]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const rem = Math.max(0, budget - Math.floor((Date.now() - startRef.current) / 1000));
      setRemaining(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [active, budget, resetKey]);

  return remaining;
}

/** « 0:45 » — format minute:seconde pour les pastilles de minuteur. */
export const fmtCountdown = (s: number): string =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
