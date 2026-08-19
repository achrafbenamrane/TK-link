import ProPortal from '../pro/portal';

/**
 * L'espace GROSSISTE.
 *
 * Le schéma remis par le client donne au grossiste la même ossature qu'au
 * commerçant : mêmes commandes, mêmes documents, mêmes offres à piloter. Quatre
 * différences seulement, et elles tiennent au vocabulaire et à une règle de
 * parcours — il publie des LOTS à un prix pro, ses acheteurs sont des
 * commerçants, et il EXPÉDIE là où le commerçant remet en main propre.
 *
 * D'où un portail partagé plutôt qu'une copie : deux fichiers auraient divergé
 * dès la première correction, et c'est exactement le défaut qu'on vient de
 * corriger entre le web et l'app sur la machine à états des commandes.
 */
export default function GrossistePage() {
  return <ProPortal role="grossiste" />;
}
