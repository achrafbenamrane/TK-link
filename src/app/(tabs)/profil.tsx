import {
  AvatarView,
  selectAvatar,
  selectFirstName,
  selectRole,
  useOnboardingStore,
} from '@/features/onboarding';
import { ProfileScreen } from '@/features/shop';
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
export default function ProfilRoute() {
  const role = useOnboardingStore(selectRole);
  const avatar = useOnboardingStore(selectAvatar);
  const firstName = useOnboardingStore(selectFirstName);

  return (
    <ProfileScreen
      canPublishOffers={canPublishOffers(role)}
      renderAvatar={() => <AvatarView avatar={avatar} size={56} />}
      name={firstName}
      subtitle={ROLE_LABEL[role]}
    />
  );
}
