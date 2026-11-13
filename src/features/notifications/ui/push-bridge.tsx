import { useEffect, useRef, useState } from 'react';

import { loadNotifications, configureForegroundBehavior } from '../lib/push';
import { routeForPush, type PushRoute } from '../model/schema';
import { usePushStore } from '../model/store';

type Props = {
  /**
   * Le compte est connecté (vraie session), l’accueil est fait et le logo animé a fini : on peut
   * enregistrer le téléphone et ouvrir l’écran d’une notification. Calculé par le layout racine,
   * qui seul connaît la session, l’accueil et le lancement.
   */
  ready: boolean;
  /** Identifiant du compte connecté : un nouveau compte réenregistre le téléphone. */
  accountId: string | null;
  /** Naviguer (le routeur du layout). */
  onOpen: (route: PushRoute) => void;
};

/**
 * LES NOTIFICATIONS, SANS ÉCRAN : enregistrer le téléphone pour le compte connecté, et ouvrir
 * l’écran qu’une notification désigne quand on la touche.
 *
 * Une notification touchée app FERMÉE lance l’app : le logo animé puis la porte d’entrée passent
 * d’abord, et un lien ouvert trop tôt serait écrasé par l’accueil. L’écran demandé attend donc que
 * `ready` soit vrai.
 */
export function PushBridge({ ready, accountId, onOpen }: Props) {
  const register = usePushStore((s) => s.register);
  const [pending, setPending] = useState<PushRoute | null>(null);
  const registeredFor = useRef<string | null>(null);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  // Toucher une notification (app ouverte ou en arrière-plan), et celle qui a lancé l'app.
  useEffect(() => {
    const N = loadNotifications();
    if (!N) return;
    configureForegroundBehavior();
    let alive = true;
    void N.getLastNotificationResponseAsync()
      .then((response) => {
        const route = routeForPush(response?.notification.request.content.data);
        if (alive && route) setPending(route);
      })
      .catch(() => undefined);
    const sub = N.addNotificationResponseReceivedListener((response) => {
      const route = routeForPush(response.notification.request.content.data);
      if (route) setPending(route);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Ouvrir l'écran demandé dès que l'app est prête.
  useEffect(() => {
    if (!ready || !pending) return;
    onOpenRef.current(pending);
    // L'écran est ouvert : la demande est servie (un état, pas une boucle : une seule fois).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consommer la demande servie
    setPending(null);
  }, [ready, pending]);

  // Enregistrer le téléphone, une fois par compte et par lancement.
  useEffect(() => {
    if (!ready || !accountId || registeredFor.current === accountId) return;
    registeredFor.current = accountId;
    void register();
  }, [ready, accountId, register]);

  return null;
}
