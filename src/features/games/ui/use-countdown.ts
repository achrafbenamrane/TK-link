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
  // 0 = « pas encore armé » : appeler Date.now() pendant le rendu rendrait le
  // hook non idempotent. L'effet de réarmement ci-dessous pose l'heure réelle,
  // et il s'exécute aussi au montage.
  const startRef = useRef(0);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Toujours la dernière callback, sans relancer le minuteur (écrire une ref
  // pendant le rendu est interdit — d'où cet effet).
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Réarmement à chaque changement de clé (relance, coup suivant…).
  useEffect(() => {
    startRef.current = Date.now();
    firedRef.current = false;
    // Synchronisation avec une horloge externe : c'est précisément le cas
    // d'usage d'un effet, même si l'on y appelle setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- remise à zéro du minuteur
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
