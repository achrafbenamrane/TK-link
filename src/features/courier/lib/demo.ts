import type { Mission } from '../model/store';

/**
 * MISSIONS D'EXEMPLE — pour montrer au client ce que voit un livreur.
 *
 * Sans serveur, aucune course réelle n'arrive tant qu'un client n'a pas commandé
 * en livraison sur le même appareil. Ces trois missions, signalées « exemple » à
 * l'écran, remplissent la liste vide pour que la démonstration ait de la matière.
 * Elles disparaissent dès qu'une vraie commande est prête. Le code de remise d'une
 * mission d'exemple est affiché (c'est la démo) ; en vrai, il vient du commerçant.
 */
export const DEMO_MISSIONS: Mission[] = [
  {
    orderId: 'demo_8892',
    merchantName: 'Sushi Tokyo',
    merchantArea: '12 rue des Arts, 31000 Toulouse',
    dropoff: '5 allée Jean-Jaurès, 31000 Toulouse',
    itemCount: 5,
    totalEur: 38.5,
    distanceKm: 2.4,
    etaMin: 14,
  },
  {
    orderId: 'demo_8893',
    merchantName: 'Boulangerie des Halles',
    merchantArea: 'Place Victor-Hugo, 31000 Toulouse',
    dropoff: '27 rue du Taur, 31000 Toulouse',
    itemCount: 3,
    totalEur: 12.9,
    distanceKm: 1.1,
    etaMin: 8,
  },
  {
    orderId: 'demo_8894',
    merchantName: 'Pizzeria Napoli',
    merchantArea: 'Rue de Metz, 31000 Toulouse',
    dropoff: '3 avenue de Muret, 31300 Toulouse',
    itemCount: 2,
    totalEur: 21,
    distanceKm: 3.8,
    etaMin: 19,
  },
];

export const isDemoMission = (orderId: string): boolean => orderId.startsWith('demo_');
