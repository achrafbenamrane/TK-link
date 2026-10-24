/**
 * PUBLIC API of the auth feature. Everything else is internal (boundaries lint).
 */
export { SignInScreen } from './ui/sign-in-screen';
export { SignUpScreen, type ShopMode, type SignUpProfile } from './ui/sign-up-screen';
export { ForgotPasswordScreen } from './ui/forgot-password-screen';
export {
  RegistrationSchema,
  validateRegistration,
  needsSiret,
  toProfile,
  EMPTY_REGISTRATION,
  type RegistrationDraft,
} from './model/registration';
export { AccountScreen } from './ui/account-screen';
export {
  useAuthStore,
  selectIsAuthenticated,
  selectDemoMode,
  selectSession,
  selectAuthStatus,
  type AuthResult,
  type SocialSignIn,
} from './model/store';
export { describeAccount, type AccountInfo } from './model/account';
export { DemoNotice } from './ui/demo-notice';
export { isDemoSession, makeDemoSession } from './model/demo-session';
export {
  decideEntry,
  homeFor,
  firstRunRoute,
  type EntryRoute,
  type EntryState,
} from './model/gate';
