import { useEffect, useState } from 'react';

import type { OrderStatus } from '../../lib/order-status';
import { canRate, type Rating, type RatingTag } from '../../lib/rating';
import { fetchMyRating, RATING_ERROR, rateServerOrder } from '../../lib/ratings-api';
import { RatingDone, RatingForm } from './order-feedback';

const OPEN = { busy: false, error: null };

type State =
  | { kind: 'loading' }
  /** Le serveur n'a pas la notation (0025 absente) : rien ne s'affiche. */
  | { kind: 'hidden' }
  | { kind: 'open'; busy: boolean; error: string | null }
  | { kind: 'done'; rating: Rating };

/**
 * Noter le commerçant d'une commande DU SERVEUR (0025) — mêmes étoiles, mêmes tags que la
 * démonstration ; la note part au serveur, qui seul décide (commande terminée, la sienne, une seule
 * fois) et en fait la moyenne publique de la vitrine.
 */
export function ServerRateMerchant({
  orderId,
  status,
  merchantName,
}: {
  orderId: string;
  status: OrderStatus;
  merchantName: string;
}) {
  const ratable = canRate(status);
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!ratable) return;
    let alive = true;
    void fetchMyRating(orderId).then((res) => {
      if (!alive) return;
      if (!res.ok)
        setState(res.code === 'unavailable' ? { kind: 'hidden' } : { kind: 'open', ...OPEN });
      else if (res.value) setState({ kind: 'done', rating: res.value });
      else setState({ kind: 'open', ...OPEN });
    });
    return () => {
      alive = false;
    };
  }, [orderId, ratable]);

  if (!ratable || state.kind === 'loading' || state.kind === 'hidden') return null;
  if (state.kind === 'done')
    return <RatingDone merchantName={merchantName} rating={state.rating} />;

  const submit = async (stars: number, tags: RatingTag[]) => {
    setState({ kind: 'open', busy: true, error: null });
    const res = await rateServerOrder(orderId, stars, tags);
    if (res.ok) {
      setState({ kind: 'done', rating: { stars, tags, at: Date.now() } });
      return;
    }
    if (res.code === 'already_rated') {
      // Notée entre-temps (un autre téléphone) : on relit ce qui a été enregistré.
      const again = await fetchMyRating(orderId);
      if (again.ok && again.value) {
        setState({ kind: 'done', rating: again.value });
        return;
      }
    }
    setState({ kind: 'open', busy: false, error: RATING_ERROR[res.code] });
  };

  return (
    <RatingForm
      merchantName={merchantName}
      busy={state.busy}
      error={state.error}
      onSubmit={(stars, tags) => void submit(stars, tags)}
    />
  );
}
