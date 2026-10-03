/**
 * PUBLIC API de l'accueil des nouveaux utilisateurs — centres d'intérêt,
 * localisation, sécurisation : les étapes 3 à 5 du parcours dessiné par le client.
 */
export { OnboardingScreen, type OnboardingExit } from './ui/onboarding-screen';
export { AvatarView } from './ui/avatar-view';
export { AvatarPicker } from './ui/avatar-picker';
export {
  useOnboardingStore,
  selectCompleted,
  selectHydrated,
  selectFirstName,
  selectAvatar,
  selectInterests,
  selectRole,
  selectSiret,
} from './model/store';
export type { Avatar, Interest, OnboardingState } from './model/schema';
export { AVATARS, avatarAt, type AvatarPreset } from './model/avatars';
export { AVATAR_COUNT, INTERESTS, randomAvatar, toggleInterest } from './lib/avatar';
