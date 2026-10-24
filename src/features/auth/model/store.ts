import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isPhoneAuthEnabled, isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import type { AuthErrorCode } from './auth-errors';
import { DEMO_CODE, makeDemoSession, type DemoProvider } from './demo-session';
import { parseIdentifier, type Identifier } from './identifier';
import { CredentialsSchema, OtpSchema, PasswordSchema } from './schema';
import * as service from './service';
import { appleIdentity } from './social/apple';
import { googleIdentity, googleSignOut } from './social/google';
import type { SocialProvider } from './social/types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Le résultat d'une action. En cas d'échec, `error` est une CATÉGORIE (`AuthErrorCode`), jamais un
 * message du serveur : c'est l'écran qui la traduit (`friendlyAuthError`), et qui choisit de ne rien
 * dire quand l'utilisateur a simplement fermé la fenêtre Google ou Apple.
 */
export type AuthResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: AuthErrorCode };

/** Ce que rend une connexion Google ou Apple, pour que la route range le prénom dans le profil local. */
export type SocialSignIn = { isNewUser: boolean; firstName: string; lastName: string };

type AuthState = {
  status: Status;
  session: Session | null;
  /** La dernière erreur, en catégorie (ou, pour compatibilité, en texte brut) — voir `friendlyAuthError`. */
  error: string | null;
  /**
   * Aucun back-end n'est configuré : l'app tourne en démonstration et les
   * comptes ne sont vérifiés par personne. Les écrans le disent à l'utilisateur.
   */
  demoMode: boolean;
  /** Load the current session and subscribe to changes. Returns an unsubscribe. */
  init: () => () => void;
  clearError: () => void;

  /** `identifier` : une adresse e-mail OU un numéro de téléphone (voir `parseIdentifier`). */
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    profile?: service.SignUpMeta,
  ) => Promise<AuthResult<{ needsCode: boolean }>>;
  confirmSignUp: (email: string, code: string) => Promise<AuthResult>;
  resendSignUpCode: (email: string) => Promise<AuthResult>;

  /** Le compte est connecté : rattacher un numéro, et recevoir le code par SMS. */
  startPhoneVerification: (phone: string) => Promise<AuthResult>;
  confirmPhone: (phone: string, code: string) => Promise<AuthResult>;
  resendPhoneCode: (phone: string) => Promise<AuthResult>;

  /** Mot de passe oublié : (1) demander le code, (2) le vérifier, (3) choisir le nouveau mot de passe. */
  requestPasswordReset: (identifier: string) => Promise<AuthResult<{ identifier: Identifier }>>;
  verifyResetCode: (identifier: Identifier, code: string) => Promise<AuthResult>;
  setNewPassword: (password: string) => Promise<AuthResult>;

  signInWithGoogle: () => Promise<AuthResult<SocialSignIn>>;
  signInWithApple: () => Promise<AuthResult<SocialSignIn>>;

  signOut: () => Promise<void>;
  /** Permanently delete the account + all its data (store-compliance requirement). */
  deleteAccount: () => Promise<AuthResult>;
};

function statusFor(session: Session | null): Status {
  return session ? 'authenticated' : 'unauthenticated';
}

/** Les comptes fictifs de la démonstration : ce que « Continuer avec Google / Apple » ouvre sans serveur. */
const DEMO_SOCIAL: Record<SocialProvider, { email: string; firstName: string; lastName: string }> =
  {
    google: { email: 'alex.demo@gmail.com', firstName: 'Alex', lastName: 'M.' },
    apple: { email: 'alex.demo@privaterelay.appleid.com', firstName: 'Alex', lastName: 'M.' },
  };

export const useAuthStore = create<AuthState>()((set, get) => {
  /** Mémorise l'échec — sauf une fenêtre fermée, qui n'en est pas un — et le rend à l'appelant. */
  const failed = (code: AuthErrorCode): { ok: false; error: AuthErrorCode } => {
    set({ error: code === 'cancelled' ? null : code });
    return { ok: false, error: code };
  };
  const succeeded = <T extends object>(extra?: T): { ok: true } & T => {
    set({ error: null });
    return { ok: true, ...extra } as { ok: true } & T;
  };
  const openDemoSession = (identifier: string, provider: DemoProvider = 'demo') =>
    set({
      session: makeDemoSession(identifier, Date.now(), provider),
      status: 'authenticated',
      error: null,
    });

  /** Google ou Apple : la fenêtre native, puis le jeton remis à Supabase. */
  const socialSignIn = async (provider: SocialProvider): Promise<AuthResult<SocialSignIn>> => {
    if (get().demoMode) {
      const demo = DEMO_SOCIAL[provider];
      openDemoSession(demo.email, provider);
      return succeeded({ isNewUser: true, firstName: demo.firstName, lastName: demo.lastName });
    }

    const identity = provider === 'google' ? await googleIdentity() : await appleIdentity();
    if (!identity.ok) return failed(identity.code);

    const result = await service.signInWithIdToken(provider, identity);
    if (!result.ok) return failed(result.code);

    const firstName = identity.firstName ?? '';
    const lastName = identity.lastName ?? '';
    // Apple ne donne le nom qu'UNE fois : on le range aussitôt. Google l'a déjà mis dans le profil
    // à la création du compte ; on ne le réécrit pas à chaque connexion (la personne a pu le corriger).
    if ((result.isNewUser || provider === 'apple') && (firstName || lastName)) {
      await service.rememberName(result.userId, { firstName, lastName });
    }
    return succeeded({ isNewUser: result.isNewUser, firstName, lastName });
  };

  /** Une adresse e-mail comme le serveur la range : sans espaces, en minuscules. */
  const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

  /** Un numéro de téléphone valide, ou `null`. */
  const phoneOf = (raw: string): string | null => {
    const parsed = parseIdentifier(raw);
    return parsed.ok && parsed.identifier.kind === 'phone' ? parsed.identifier.value : null;
  };

  return {
    status: 'loading',
    session: null,
    error: null,
    demoMode: !isSupabaseConfigured,

    init: () => {
      // Sans serveur, il n'y a ni session à relire ni changement à écouter :
      // interroger Supabase ne produirait qu'une erreur DNS au démarrage.
      if (!isSupabaseConfigured) {
        set({ status: 'unauthenticated' });
        return () => {};
      }
      void supabase.auth.getSession().then(({ data }) => {
        set({ session: data.session, status: statusFor(data.session) });
      });
      // ⚠️ Ne PAS appeler d'autre méthode de `supabase.auth` dans ce rappel : il s'exécute sous le
      // verrou de session, et la méthode appelée attendrait ce même verrou (blocage garanti).
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, status: statusFor(session) });
      });
      return () => data.subscription.unsubscribe();
    },

    clearError: () => set({ error: null }),

    signIn: async (rawIdentifier, password) => {
      const identifier = parseIdentifier(rawIdentifier, { allowPhone: isPhoneAuthEnabled });
      if (!identifier.ok || !PasswordSchema.safeParse(password).success) {
        return failed('invalid_input');
      }
      if (get().demoMode) {
        // Démonstration : on ouvre une session locale. Rien n'est vérifié — c'est dit à l'écran,
        // et le mode disparaît dès qu'un projet Supabase existe.
        openDemoSession(identifier.identifier.value);
        return succeeded();
      }
      const result = await service.signInWithPassword(identifier.identifier, password);
      return result.ok ? succeeded() : failed(result.code);
    },

    signUp: async (email, password, profile) => {
      const parsed = CredentialsSchema.safeParse({ email: normalizeEmail(email), password });
      if (!parsed.success) return failed('invalid_input');

      if (get().demoMode) {
        openDemoSession(parsed.data.email);
        return succeeded({ needsCode: false });
      }
      const result = await service.signUpWithEmail(
        parsed.data.email,
        parsed.data.password,
        profile,
      );
      return result.ok ? succeeded({ needsCode: result.needsCode }) : failed(result.code);
    },

    confirmSignUp: async (email, code) => {
      if (!OtpSchema.safeParse(code).success) return failed('invalid_input');
      if (get().demoMode) {
        if (code !== DEMO_CODE) return failed('otp_invalid');
        openDemoSession(email);
        return succeeded();
      }
      const result = await service.confirmSignUp(normalizeEmail(email), code);
      return result.ok ? succeeded() : failed(result.code);
    },

    resendSignUpCode: async (email) => {
      if (get().demoMode) return succeeded();
      const result = await service.resendSignUpCode(normalizeEmail(email));
      return result.ok ? succeeded() : failed(result.code);
    },

    startPhoneVerification: async (rawPhone) => {
      const phone = phoneOf(rawPhone);
      if (!phone) return failed('invalid_input');
      if (!isPhoneAuthEnabled) return failed('provider_disabled');
      if (get().demoMode) return succeeded();
      // Le numéro se rattache à un compte DÉJÀ connecté : sans session, on ne sait à qui l'attribuer.
      if (!get().session) return failed('session_missing');
      const result = await service.startPhoneVerification(phone);
      return result.ok ? succeeded() : failed(result.code);
    },

    confirmPhone: async (rawPhone, code) => {
      const phone = phoneOf(rawPhone);
      if (!phone || !OtpSchema.safeParse(code).success) return failed('invalid_input');
      if (get().demoMode) {
        if (code !== DEMO_CODE) return failed('otp_invalid');
        // La démonstration range le numéro dans sa session, comme le serveur le ferait.
        const identifier = get().session?.user.email ?? phone;
        const session = makeDemoSession(identifier);
        session.user.phone = phone.replace(/^\+/, '');
        session.user.phone_confirmed_at = new Date().toISOString();
        set({ session, status: 'authenticated' });
        return succeeded();
      }
      const result = await service.confirmPhone(phone, code);
      return result.ok ? succeeded() : failed(result.code);
    },

    resendPhoneCode: async (rawPhone) => {
      const phone = phoneOf(rawPhone);
      if (!phone) return failed('invalid_input');
      if (get().demoMode) return succeeded();
      const result = await service.resendPhoneCode(phone);
      return result.ok ? succeeded() : failed(result.code);
    },

    requestPasswordReset: async (rawIdentifier) => {
      const identifier = parseIdentifier(rawIdentifier, { allowPhone: isPhoneAuthEnabled });
      if (!identifier.ok) return failed('invalid_input');
      if (get().demoMode) return succeeded({ identifier: identifier.identifier });
      const result = await service.requestPasswordReset(identifier.identifier);
      return result.ok ? succeeded({ identifier: identifier.identifier }) : failed(result.code);
    },

    verifyResetCode: async (identifier, code) => {
      if (!OtpSchema.safeParse(code).success) return failed('invalid_input');
      if (get().demoMode) {
        if (code !== DEMO_CODE) return failed('otp_invalid');
        openDemoSession(identifier.value);
        return succeeded();
      }
      const result = await service.verifyPasswordReset(identifier, code);
      return result.ok ? succeeded() : failed(result.code);
    },

    setNewPassword: async (password) => {
      if (!PasswordSchema.safeParse(password).success) return failed('weak_password');
      if (get().demoMode) return succeeded();
      // Le code vérifié a ouvert une session : c'est elle qui autorise ce changement.
      if (!get().session) return failed('session_missing');
      const result = await service.setPassword(password);
      return result.ok ? succeeded() : failed(result.code);
    },

    signInWithGoogle: () => socialSignIn('google'),
    signInWithApple: () => socialSignIn('apple'),

    signOut: async () => {
      if (!get().demoMode) {
        // supabase-js clears the LargeSecureStore session via its storage adapter. Google, lui,
        // garde son compte en mémoire : on l'oublie, pour que la personne suivante puisse choisir.
        await googleSignOut();
        await service.signOut();
      }
      set({ session: null, status: 'unauthenticated', error: null });
    },

    deleteAccount: async () => {
      // En démonstration il n'y a rien à supprimer côté serveur : on ferme la
      // session locale. La VRAIE suppression (exigée par les stores) passe par la
      // fonction Edge dès qu'un back-end existe.
      if (get().demoMode) {
        set({ session: null, status: 'unauthenticated', error: null });
        return { ok: true };
      }
      // The Edge Function validates the JWT and deletes the user + cascaded data.
      const result = await service.deleteAccount();
      if (!result.ok) return failed(result.code);
      await googleSignOut({ revoke: true });
      await service.signOut();
      set({ session: null, status: 'unauthenticated', error: null });
      return { ok: true };
    },
  };
});

export const selectIsAuthenticated = (s: AuthState): boolean => s.status === 'authenticated';
export const selectDemoMode = (s: AuthState): boolean => s.demoMode;
export const selectSession = (s: AuthState): Session | null => s.session;
