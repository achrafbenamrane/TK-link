/**
 * PUBLIC API of the auth feature. Everything else is internal (boundaries lint).
 */
export { SignInScreen } from './ui/sign-in-screen';
export { SignUpScreen } from './ui/sign-up-screen';
export {
  RegistrationSchema,
  validateRegistration,
  needsSiret,
  toProfile,
  EMPTY_REGISTRATION,
  type RegistrationDraft,
} from './model/registration';
export { AccountScreen } from './ui/account-screen';
export { useAuthStore, selectIsAuthenticated } from './model/store';
export { useProtectedRoute } from './model/use-protected-route';
