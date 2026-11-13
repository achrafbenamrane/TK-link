import {
  AvatarPicker,
  selectFirstName,
  selectRole,
  useOnboardingStore,
} from '@/features/onboarding';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/features/auth';
import { useMerchantLoyaltyStore } from '@/features/loyalty';
import { useMerchantStore } from '@/features/merchant';
import { usePushStore } from '@/features/notifications';
import { useReceiptsStore } from '@/features/receipts';
import { useReferralStore } from '@/features/referral';
import { ProfileScreen, useServerOrdersStore, useShopStore } from '@/features/shop';
import { useWelcomeStore } from '@/features/welcome';
import { isDemoBuild } from '@/shared/lib/env';
import { canPublishOffers, ROLE_LABEL } from '@/shared/lib/roles';

/**
 * Le compte. La ROUTE croise l'identité et le rôle (feature `onboarding`) avec
 * la boutique : un professionnel y trouve le renvoi vers l'espace pro web, où
 * il publie ses ventes flash et suit ses commandes — décision client du
 * 2026-08-10.
 *
 * L'entête montrait un « F » et « Farid · Empalot · Toulouse » codés en dur.
 * L'avatar et le nom viennent maintenant de ce que la personne a choisi à
 * l'inscription. Le quartier, lui, n'est PAS affiché : le CDC §5 le demande au
 * formulaire mais rien ne le conserve aujourd'hui, et un lieu inventé sous le
 * nom de quelqu'un est pire qu'une ligne en moins. Le rôle prend sa place —
 * il est vrai, et il explique ce que l'écran propose.
 */
/**
 * SE DÉCONNECTER : l'app revient comme pour un NOUVEL utilisateur. Le profil, les
 * commandes, la fidélité, les offres, la boutique et le parrainage
 * repartent de zéro (en démonstration, tout vit sur l'appareil), et l'ouverture
 * rejoue le logo animé avant le choix du profil.
 *
 * La navigation revient à la porte du layout : le logo animé se rejoue dès que
 * `splashDone` repasse à faux, et la suite attend que la session soit fermée — la
 * session part donc EN PREMIER (son statut passe aussitôt en attente).
 *
 * Juste avant : ce téléphone est retiré des notifications du compte (il faut encore la session pour
 * le faire), sinon il recevrait les commandes de la personne précédente. Borné à 2,5 s : hors
 * ligne, la déconnexion ne reste pas bloquée.
 */
export function useSignOut() {
  return () => {
    void (async () => {
      await Promise.race([
        usePushStore
          .getState()
          .forget()
          .catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
      void useAuthStore.getState().signOut();
      resetLocalData();
      useWelcomeStore.setState({ splashDone: false });
    })();
  };
}

/**
 * Ce que l'appareil garde d'un compte : profil, panier, commandes, fidélité, boutique,
 * parrainage, tickets. Remis à zéro à la déconnexion, et quand un AUTRE compte se connecte sur cet
 * appareil (voir `AccountOwnerGuard` dans le layout racine) : il n'hérite de rien.
 */
export function resetLocalData(): void {
  useOnboardingStore.getState().reset();
  useShopStore.setState({
    cart: [],
    favorites: [],
    orders: [],
    addresses: [],
    merchantApplication: null,
  });
  useMerchantStore.getState().resetDemo();
  useMerchantLoyaltyStore.setState({ cards: {}, programs: {}, rewards: [] });
  useReferralStore.setState({ myCode: '', referredBy: null, credit: 'aucun' });
  useReceiptsStore.setState({ receipts: [] });
  // Les commandes du serveur relues pour ce compte : le suivant ne doit pas les voir, même un instant.
  useServerOrdersStore.setState({ mine: [], shop: [], mineError: null, shopError: null });
}

export default function ProfilRoute() {
  const role = useOnboardingStore(selectRole);
  const router = useRouter();
  const firstName = useOnboardingStore(selectFirstName);
  const signOut = useSignOut();

  return (
    <ProfileScreen
      canPublishOffers={canPublishOffers(role)}
      wholesaler={role === 'grossiste'}
      renderAvatar={() => <AvatarPicker size={56} />}
      name={firstName}
      subtitle={ROLE_LABEL[role]}
      onSignOut={signOut}
      onOpenAccount={() => router.push('/account')}
      onOpenSupport={() => router.push('/aide')}
      {...(isDemoBuild ? { onOpenDemoSettings: () => router.push('/reglages-demo') } : {})}
      // Les paliers de fidélité sont ceux d'un COMMERÇANT ; un grossiste vend des lots, pas des points.
      {...(role === 'commercant' ? { onOpenTiers: () => router.push('/paliers') } : {})}
    />
  );
}
