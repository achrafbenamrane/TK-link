import { useEffect } from 'react';

import { selectRole, useOnboardingStore } from '@/features/onboarding';

import SignUpRoute from './sign-up';

/**
 * LA PORTE DES COMMERÇANTS — « Créer mon compte commerçant ».
 *
 * C'est la même inscription que celle des consommateurs, dans sa variante
 * professionnelle (nom du commerce, catégorie, SIRET, adresse, modes de remise,
 * bascule Commerçant / Grossiste). La route n'a donc qu'une chose à faire : poser
 * le rôle avant de la montrer — qui arrive ici veut un compte professionnel.
 *
 * Un grossiste y est accueilli aussi (onglet « Grossiste »), mais ses outils
 * vivent sur le portail web : décision du client du 10/08/2026.
 */
export default function MerchantRoute() {
  const role = useOnboardingStore(selectRole);
  const setRole = useOnboardingStore((s) => s.setRole);

  useEffect(() => {
    if (role === 'consommateur') setRole('commercant');
  }, [role, setRole]);

  return <SignUpRoute />;
}
