/**
 * PUBLIC API de TK Deliver — le livreur (CDC V1.1 §4, schéma « Process livreur »).
 *
 * Inscription et vérification, disponibilité, missions, retrait chez le
 * commerçant (QR/PIN), remise avec preuve, portefeuille de revenus. La vérification
 * d'identité et l'offre de missions sont des affaires de serveur : ici, simulées
 * et signalées comme telles.
 */
export { CourierSetupScreen } from './ui/courier-setup-screen';
export { CourierHomeScreen } from './ui/courier-home-screen';
export { CourierEarningsScreen } from './ui/courier-earnings-screen';
export { CourierAccountScreen } from './ui/courier-account-screen';
export { DEMO_MISSIONS, isDemoMission } from './lib/demo';
export { useCourierStore, selectActive, selectHistory, type Mission } from './model/store';
export {
  VEHICLES,
  VEHICLE_LABEL,
  MISSION_STEPS,
  STEP_LABEL,
  courierGain,
  canReceiveMissions,
  formatEur,
  type Vehicle,
  type MissionStep,
} from './lib/courier';
