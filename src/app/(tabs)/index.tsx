import { useCallback } from 'react';

import { HunterBar, useGameStore } from '@/features/gamification';
import { HomeScreen } from '@/features/shop';

/**
 * ACCUEIL — les ventes flash, triées par ce qui va disparaître en premier.
 *
 * C'est ici que la boutique et la progression se rencontrent : la feature
 * « shop » laisse une place en tête de liste, la feature « gamification »
 * la remplit. Aucune des deux ne dépend de l'autre.
 */
export default function AccueilRoute() {
  const markVisit = useGameStore((s) => s.markVisit);
  const onVisit = useCallback(() => markVisit(), [markVisit]);

  return (
    <HomeScreen
      onVisit={onVisit}
      renderBanner={(criticalCount) => <HunterBar criticalCount={criticalCount} />}
    />
  );
}
