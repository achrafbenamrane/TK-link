/**
 * PUBLIC API de l'accueil des nouveaux utilisateurs — l'onboarding « poussé »
 * demandé par le client, avatar compris.
 */
export { OnboardingScreen } from './ui/onboarding-screen';
export { AvatarView } from './ui/avatar-view';
export {
  useOnboardingStore,
  selectCompleted,
  selectHydrated,
  selectFirstName,
  selectAvatar,
  selectInterests,
  selectHolderType,
  selectRole,
  selectSiret,
} from './model/store';
export type { Avatar, Interest, OnboardingState } from './model/schema';
export { AVATARS, avatarAt, type AvatarPreset } from './model/avatars';
export { AVATAR_COUNT, INTERESTS, canFinish, randomAvatar, toggleInterest } from './lib/avatar';
