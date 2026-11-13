/**
 * PUBLIC API des notifications (rapport d’avancement du 13/11/2026) : enregistrer le téléphone
 * pour le compte connecté, ouvrir l’écran d’une notification touchée, et retirer le téléphone du
 * compte à la déconnexion. L’envoi est fait par le serveur (fonction Edge `push-events`).
 */
export { PushBridge } from './ui/push-bridge';
export { usePushStore, selectPushStatus, type PushStatus } from './model/store';
export { routeForPush, type PushRoute } from './model/schema';
