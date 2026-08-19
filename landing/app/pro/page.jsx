import ProPortal from './portal';

/**
 * L'espace COMMERÇANT.
 *
 * Le portail est partagé avec l'espace grossiste : mêmes commandes, mêmes
 * documents, mêmes offres à piloter. Seuls changent le vocabulaire et deux
 * règles de parcours — un grossiste EXPÉDIE là où un commerçant remet en main
 * propre. Deux copies du portail auraient divergé dès la première correction.
 */
export default function ProPage() {
  return <ProPortal role="commercant" />;
}
