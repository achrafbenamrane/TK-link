/**
 * PUBLIC API du parrainage — CDC V1.1 (VALIDÉ) : code ou lien d'invitation,
 * récompense financée par TK LINK, débloquée après le premier achat du filleul.
 */
export { ReferralScreen } from './ui/referral-screen';
export {
  useReferralStore,
  selectCredit,
  selectReferredBy,
  makeReferralCode,
  type CreditState,
} from './model/store';
