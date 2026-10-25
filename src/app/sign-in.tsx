import { useIsFocused, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { homeFor, SignInScreen, useAuthStore, type ServerProfile } from '@/features/auth';
import { useOnboardingStore } from '@/features/onboarding';
import { isCategory } from '@/shared/lib/categories';
import type { Role } from '@/shared/lib/roles';

/**
 * Range dans le profil LOCAL ce que le compte sait déjà : son type, son prénom (si l'appareil n'en a
 * pas), et — s'il a déjà fait l'accueil — ses centres d'intérêt, l'accueil étant alors marqué fait.
 * Une personne déjà inscrite ne repasse donc jamais par les centres d'intérêt, ni après une
 * déconnexion ni sur un autre appareil. Partagé par la connexion et le lancement (`AccountSync`).
 */
export function adoptServerProfile(profile: ServerProfile, role: Role): void {
  const local = useOnboardingStore.getState();
  local.setRole(role);
  // Le prénom choisi sur cet appareil l'emporte ; à défaut, celui du compte.
  if (profile.firstName && !local.firstName) local.setFirstName(profile.firstName);
  if (profile.onboarded) {
    local.setInterests(profile.interests.filter(isCategory));
    local.complete();
  }
}

/**
 * Entrer dans l'app une fois connecté — après la connexion, ou après un nouveau mot de passe.
 *
 * Le TYPE DE COMPTE vient du serveur : sur un nouvel appareil (ou après une déconnexion, qui remet
 * l'accueil à zéro), le profil local ne le connaît pas, et un grossiste se verrait proposer l'accueil
 * d'un client. On l'aligne donc AVANT de partir (`syncProfile`) — l'écran garde son indicateur de
 * chargement pendant ce temps — puis on va là où la porte du layout l'enverrait (`homeFor`) :
 * l'accueil, ou les étapes d'accueil de ce profil si cet appareil ne les a pas encore vues.
 */
export function useEnterApp() {
  const router = useRouter();
  const syncProfile = useAuthStore((s) => s.syncProfile);
  return useCallback(async () => {
    // Se connecter ne DÉCLARE rien : un compte dont le type n'a jamais été déclaré (créé par Google
    // ou Apple depuis cet écran, sans le formulaire) est un compte client. Un professionnel passe par
    // l'inscription, sa fiche et ses CGU.
    const profile = await syncProfile(useOnboardingStore.getState().role, { declare: false });
    if (profile)
      adoptServerProfile(profile, profile.declared ? profile.accountType : 'consommateur');
    const { completed, role } = useOnboardingStore.getState();
    router.replace(homeFor({ auth: 'authenticated', onboardingCompleted: completed, role }));
  }, [router, syncProfile]);
}

/**
 * LA CONNEXION — e-mail ou numéro + mot de passe, Google, Apple. Un compte est obligatoire : la
 * porte du layout amène ici quiconque a déjà installé l'app sans session ouverte.
 */
export default function SignInRoute() {
  const router = useRouter();
  const enterApp = useEnterApp();
  // Au premier plan seulement : sous « Mot de passe oublié », la session du code de récupération ne
  // doit pas faire entrer dans l'app avant le nouveau mot de passe.
  const focused = useIsFocused();
  const onCreateAccount = useCallback(() => router.replace('/role'), [router]);
  const onForgotPassword = useCallback(() => router.push('/forgot-password'), [router]);
  // Google / Apple donnent le prénom : il rejoint le profil local, comme celui du formulaire.
  const setFirstName = useOnboardingStore((s) => s.setFirstName);
  const onProfile = useCallback(
    ({ firstName }: { firstName: string }) => {
      if (firstName) setFirstName(firstName);
    },
    [setFirstName],
  );
  return (
    <SignInScreen
      onCreateAccount={onCreateAccount}
      onSignedIn={enterApp}
      onForgotPassword={onForgotPassword}
      onProfile={onProfile}
      active={focused}
    />
  );
}
