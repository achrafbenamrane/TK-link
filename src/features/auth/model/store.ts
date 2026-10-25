import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { isPhoneAuthEnabled, isSupabaseConfigured } from '@/shared/lib/env';
import type { Role } from '@/shared/lib/roles';
import { secureStorage } from '@/shared/lib/storage';
import { supabase } from '@/shared/lib/supabase';

import type { AuthErrorCode } from './auth-errors';
import { DEMO_CODE, isDemoSession, makeDemoSession, type DemoProvider } from './demo-session';
import { parseIdentifier } from './identifier';
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
export type SocialSignIn = {
  isNewUser: boolean;
  firstName: string;
  lastName: string;
  /** L'adresse donnée par le fournisseur (chez Apple, souvent une adresse relais). */
  email: string;
};

/** Le profil du serveur, tel que l'app doit l'utiliser (voir `syncProfile`). */
export type ServerProfile = {
  firstName: string;
  lastName: string;
  accountType: Role;
  /** Le type est-il DÉCLARÉ sur le serveur ? Sinon `accountType` n'est que la valeur par défaut. */
  declared: boolean;
  /** Ce compte a déjà fait l'accueil : on entre directement dans l'app, avec ses centres d'intérêt. */
  onboarded: boolean;
  interests: string[];
};

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

  /**
   * Associe un numéro au compte connecté, SANS code (la vérification par SMS viendra avec Prelude).
   * Ensuite, on peut se connecter avec ce numéro et le même mot de passe.
   */
  linkPhone: (phone: string) => Promise<AuthResult>;
  /**
   * Range un numéro saisi à l'inscription par Google ou Apple comme CONTACT du compte (métadonnées,
   * aucun SMS) : il sera associé à la connexion suivante si l'association échoue maintenant. Sans
   * serveur, rien à faire. Un échec est silencieux : le numéro reste saisissable plus tard.
   */
  saveContactPhone: (phone: string) => Promise<void>;

  /** Mot de passe oublié, par e-mail : (1) demander le code, (2) le vérifier, (3) le nouveau mot de passe. */
  requestPasswordReset: (email: string) => Promise<AuthResult<{ email: string }>>;
  verifyResetCode: (email: string, code: string) => Promise<AuthResult>;
  setNewPassword: (password: string) => Promise<AuthResult>;

  signInWithGoogle: () => Promise<AuthResult<SocialSignIn>>;
  signInWithApple: () => Promise<AuthResult<SocialSignIn>>;

  /**
   * Le profil du serveur, aligné avec l'app — à appeler une fois connecté. Le type de compte DÉCLARÉ
   * fait foi (un nouvel appareil ne le connaît pas) ; s'il ne l'est pas encore (compte créé par
   * Google ou Apple), `localRole` — le profil choisi dans l'app — est déclaré, une fois pour toutes.
   * `null` : pas de serveur (démonstration) ou pas de réseau ; l'app garde ce qu'elle a en local.
   */
  syncProfile: (localRole: Role, options?: { declare?: boolean }) => Promise<ServerProfile | null>;
  /**
   * L'accueil vient d'être terminé : le COMPTE le retient (et les centres d'intérêt), pour ne plus le
   * redemander à la connexion suivante. Sans serveur, rien à faire. Un échec est silencieux : au pire,
   * l'accueil sera reproposé une fois.
   */
  saveOnboarding: (interests: string[]) => Promise<void>;

  /**
   * Builds de démonstration : ouvre une session locale sans serveur (boutons « Démo » du choix du
   * profil). Elle n'ouvre l'accès à rien côté serveur : aucun jeton réel n'existe.
   */
  openDemo: (identifier: string) => void;

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

/* ─────────────────────────────────── la session de démonstration, d'un lancement à l'autre */

/**
 * Le compte étant obligatoire, une démonstration qui oublierait sa session à chaque ouverture
 * obligerait à se reconnecter sans cesse. On garde donc l'IDENTIFIANT (pas de mot de passe, il n'y
 * en a pas) dans le stockage sécurisé — c'est une donnée personnelle — et on refabrique la session
 * au lancement. Un vrai serveur garde sa propre session (voir `src/shared/lib/supabase.ts`).
 */
const DEMO_SESSION_KEY = 'tklink-demo-session-v1';

const SavedDemoSchema = z.object({
  identifier: z.string().min(3).max(160),
  provider: z.enum(['demo', 'google', 'apple']).default('demo'),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/)
    .optional(),
});
/** Ce qu'on enregistre (le fournisseur vaut « demo » s'il est omis). */
type SavedDemo = z.input<typeof SavedDemoSchema>;

function demoSessionOf(saved: SavedDemo): Session {
  const session = makeDemoSession(saved.identifier, Date.now(), saved.provider ?? 'demo');
  if (saved.phone) {
    session.user.phone = saved.phone.slice(1);
    session.user.phone_confirmed_at = session.user.created_at;
  }
  return session;
}

async function readSavedDemo(): Promise<Session | null> {
  try {
    const raw = await secureStorage.get(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = SavedDemoSchema.safeParse(JSON.parse(raw));
    return parsed.success ? demoSessionOf(parsed.data) : null;
  } catch {
    return null;
  }
}

function saveDemo(saved: SavedDemo): void {
  secureStorage.set(DEMO_SESSION_KEY, JSON.stringify(saved)).catch(() => undefined);
}

function forgetDemo(): void {
  secureStorage.remove(DEMO_SESSION_KEY).catch(() => undefined);
}

/** Le fournisseur d'une session de démonstration, pour la refabriquer à l'identique. */
function demoProviderOf(session: Session): DemoProvider {
  const provider = (session.user.app_metadata as { provider?: string } | undefined)?.provider;
  return provider === 'google' || provider === 'apple' ? provider : 'demo';
}

/* ─────────────────────────────── l'association du numéro, une seule fois à la fois */

/**
 * Le numéro saisi à l'inscription s'associe dès qu'une session existe. Deux chemins y mènent au même
 * moment (l'écran d'inscription, et l'écoute de la session à la connexion) : on ne fait qu'UN appel
 * par numéro en vol, que les deux attendent.
 */
const linksInFlight = new Map<string, Promise<service.Outcome>>();

function linkPhoneOnce(phone: string): Promise<service.Outcome> {
  const pending = linksInFlight.get(phone);
  if (pending) return pending;
  const call = service.linkPhone(phone).finally(() => linksInFlight.delete(phone));
  linksInFlight.set(phone, call);
  return call;
}

const E164 = /^\+[1-9]\d{7,14}$/;

/** Le numéro saisi à l'inscription et pas encore associé, s'il y en a un. */
function pendingPhoneOf(session: Session): string | null {
  if (session.user.phone) return null;
  const contact = (session.user.user_metadata as { contact_phone?: unknown } | undefined)
    ?.contact_phone;
  return typeof contact === 'string' && E164.test(contact) ? contact : null;
}

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
  const openDemoSession = (saved: SavedDemo) => {
    set({ session: demoSessionOf(saved), status: 'authenticated', error: null });
    // En vrai mode (build de démonstration branchée sur Supabase), la session de démo ne survit pas
    // au redémarrage : c'est la session du serveur qui fait foi.
    if (!isSupabaseConfigured) saveDemo(saved);
  };

  /** Google ou Apple : la fenêtre native (ou, pour Apple sur Android, la page d'Apple). */
  const socialSignIn = async (provider: SocialProvider): Promise<AuthResult<SocialSignIn>> => {
    if (get().demoMode) {
      const demo = DEMO_SOCIAL[provider];
      openDemoSession({ identifier: demo.email, provider });
      return succeeded({
        isNewUser: true,
        firstName: demo.firstName,
        lastName: demo.lastName,
        email: demo.email,
      });
    }

    // Apple n'a de fenêtre native que sur iPhone : sur Android, sa page web, avec PKCE.
    if (provider === 'apple' && Platform.OS === 'android') {
      const web = await service.signInWithAppleWeb();
      if (!web.ok) return failed(web.code);
      return succeeded({ isNewUser: web.isNewUser, firstName: '', lastName: '', email: web.email });
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
    return succeeded({
      isNewUser: result.isNewUser,
      firstName,
      lastName,
      email: identity.email ?? '',
    });
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
      // Sans serveur : la session de démonstration enregistrée, s'il y en a une. Aucun appel réseau
      // (interroger Supabase ne produirait qu'une erreur DNS au démarrage).
      // Les deux lectures ci-dessous ne s'appliquent que si RIEN n'a décidé entre-temps : une
      // connexion ouverte pendant la lecture ne doit pas être écrasée par l'état d'avant.
      if (!isSupabaseConfigured) {
        let alive = true;
        void readSavedDemo().then((session) => {
          if (alive && get().status === 'loading') set({ session, status: statusFor(session) });
        });
        return () => {
          alive = false;
        };
      }
      void supabase.auth.getSession().then(({ data }) => {
        if (get().status === 'loading') {
          set({ session: data.session, status: statusFor(data.session) });
        }
      });
      // ⚠️ Ne PAS appeler d'autre méthode de `supabase.auth` dans ce rappel : il s'exécute sous le
      // verrou de session, et la méthode appelée attendrait ce même verrou (blocage garanti). Ce qui
      // doit suivre une connexion part donc au tour suivant (`setTimeout`).
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        set({ session, status: statusFor(session) });
        const phone =
          event === 'SIGNED_IN' && session && isPhoneAuthEnabled ? pendingPhoneOf(session) : null;
        // Le numéro saisi à l'inscription s'associe à la première connexion (e-mail confirmé plus
        // tard, autre appareil…). Un refus (numéro déjà pris) se verra dans « Mon compte ».
        if (phone) setTimeout(() => void linkPhoneOnce(phone), 0);
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
        const { kind, value } = identifier.identifier;
        openDemoSession(
          kind === 'email' ? { identifier: value } : { identifier: value, phone: value },
        );
        return succeeded();
      }
      const result = await service.signInWithPassword(identifier.identifier, password);
      return result.ok ? succeeded() : failed(result.code);
    },

    signUp: async (email, password, profile) => {
      const parsed = CredentialsSchema.safeParse({ email: normalizeEmail(email), password });
      if (!parsed.success) return failed('invalid_input');

      if (get().demoMode) {
        // La démonstration associe le numéro tout de suite, comme le fera le serveur — si la
        // connexion par numéro est proposée (sinon, comme pour Google et Apple, il n'est pas associé).
        const phone =
          isPhoneAuthEnabled && profile?.phone && E164.test(profile.phone)
            ? profile.phone
            : undefined;
        openDemoSession({ identifier: parsed.data.email, ...(phone ? { phone } : {}) });
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
        openDemoSession({ identifier: normalizeEmail(email) });
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

    saveContactPhone: async (rawPhone) => {
      const phone = phoneOf(rawPhone);
      const session = get().session;
      if (!phone || get().demoMode || !session || isDemoSession(session)) return;
      await service.saveContactPhone(phone);
    },

    linkPhone: async (rawPhone) => {
      const phone = phoneOf(rawPhone);
      if (!phone) return failed('invalid_input');
      if (!isPhoneAuthEnabled) return failed('provider_disabled');
      // Le numéro se rattache à un compte DÉJÀ connecté : sans session, on ne sait à qui l'attribuer.
      const session = get().session;
      if (!session) return failed('session_missing');
      if (get().demoMode || isDemoSession(session)) {
        openDemoSession({
          identifier: session.user.email ?? phone,
          provider: demoProviderOf(session),
          phone,
        });
        return succeeded();
      }
      const result = await linkPhoneOnce(phone);
      return result.ok ? succeeded() : failed(result.code);
    },

    requestPasswordReset: async (rawEmail) => {
      const parsed = parseIdentifier(rawEmail, { allowPhone: false });
      if (!parsed.ok || parsed.identifier.kind !== 'email') return failed('invalid_input');
      const email = parsed.identifier.value;
      if (get().demoMode) return succeeded({ email });
      const result = await service.requestPasswordReset(email);
      return result.ok ? succeeded({ email }) : failed(result.code);
    },

    verifyResetCode: async (email, code) => {
      if (!OtpSchema.safeParse(code).success) return failed('invalid_input');
      if (get().demoMode) {
        if (code !== DEMO_CODE) return failed('otp_invalid');
        openDemoSession({ identifier: normalizeEmail(email) });
        return succeeded();
      }
      const result = await service.verifyPasswordReset(normalizeEmail(email), code);
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

    syncProfile: async (localRole, options = {}) => {
      const session = get().session;
      if (get().demoMode || !session || isDemoSession(session)) return null;
      const read = await service.fetchMyProfile(session.user.id);
      if (!read.ok || !read.profile) return null;
      const { firstName, lastName, accountType, accountTypeDeclared, onboarded, interests } =
        read.profile;
      const base = { firstName, lastName, onboarded, interests };
      if (accountTypeDeclared) return { ...base, accountType, declared: true };
      // Déclarer est un geste d'INSCRIPTION (le formulaire et ses CGU l'accompagnent) : la connexion
      // et la synchronisation au lancement passent `declare: false` et laissent le type en blanc.
      if (options.declare === false) {
        return { ...base, accountType: localRole, declared: false };
      }
      // Pas encore déclaré : le profil choisi dans l'app le devient. Si la déclaration échoue (réseau),
      // on garde le profil local — la valeur par défaut du serveur n'en sait pas plus.
      const declared = await service.declareAccountType(localRole);
      return declared.ok
        ? { ...base, accountType: declared.accountType, declared: true }
        : { ...base, accountType: localRole, declared: false };
    },

    saveOnboarding: async (interests) => {
      const session = get().session;
      if (get().demoMode || !session || isDemoSession(session)) return;
      await service.saveOnboarding(session.user.id, interests);
    },

    openDemo: (identifier) => {
      const phone = phoneOf(identifier);
      openDemoSession(phone ? { identifier: phone, phone } : { identifier });
    },

    signOut: async () => {
      const session = get().session;
      forgetDemo();
      try {
        if (!get().demoMode && !(session && isDemoSession(session))) {
          // Le temps que le serveur ferme la session, le statut est « en attente » : la porte
          // d'entrée ne décide rien (ni l'accueil d'un compte qui s'en va, ni la connexion trop
          // tôt). Ce changement est SYNCHRONE — avant le premier `await` — pour que l'écran qui
          // déconnecte puisse remettre l'app à zéro juste après.
          set({ status: 'loading' });
          // supabase-js efface la session du stockage sécurisé, même hors ligne. Google, lui, garde
          // son compte en mémoire : on l'oublie, pour que la personne suivante puisse choisir.
          await googleSignOut();
          await service.signOut();
        }
      } finally {
        set({ session: null, status: 'unauthenticated', error: null });
      }
    },

    deleteAccount: async () => {
      // En démonstration il n'y a rien à supprimer côté serveur : on ferme la
      // session locale. La VRAIE suppression (exigée par les stores) passe par la
      // fonction Edge dès qu'un back-end existe.
      const session = get().session;
      if (get().demoMode || (session && isDemoSession(session))) {
        forgetDemo();
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
export const selectAuthStatus = (s: AuthState): Status => s.status;
