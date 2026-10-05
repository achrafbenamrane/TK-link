import type { Mission } from '../model/store';

/**
 * MISSIONS D'EXEMPLE — pour montrer au client ce que voit un livreur.
 *
 * Sans serveur, aucune course réelle n'arrive tant qu'un client n'a pas commandé
 * en livraison sur le même appareil. Ces trois missions, signalées « exemple » à
 * l'écran, remplissent la liste vide pour que la démonstration ait de la matière.
 * Elles disparaissent dès qu'une vraie commande est prête. Les codes de remise (4 chiffres
 * au retrait, 6 au client) sont affichés : c'est la démo ; en vrai, ils viennent du commerçant
 * et du client. Les numéros sont dans la plage réservée à la fiction (01 99 00 xx xx).
 */
export const DEMO_MISSIONS: Mission[] = [
  {
    orderId: 'demo_8892',
    ref: 'CMD-8892',
    merchantName: 'Sushi Tokyo',
    merchantArea: '12 rue des Arts, 31000 Toulouse',
    merchantPhone: '01 99 00 88 92',
    clientName: 'Emma Bernard',
    clientPhone: '01 99 00 24 24',
    dropoff: '24 rue des Lilas, 31000 Toulouse',
    instructions: 'Sonner à l’interphone, 2ème étage à droite.',
    itemCount: 2,
    bags: 1,
    totalEur: 38.5,
    distanceKm: 2.4,
    etaMin: 14,
    targetTime: '12:45',
    pickupGeo: { lat: 43.6047, lng: 1.4442 },
    dropoffGeo: { lat: 43.6118, lng: 1.4529 },
  },
  {
    orderId: 'demo_8893',
    ref: 'CMD-8893',
    merchantName: 'Boulangerie des Halles',
    merchantArea: 'Place Victor-Hugo, 31000 Toulouse',
    merchantPhone: '01 99 00 88 93',
    clientName: 'Lucas Moreau',
    clientPhone: '01 99 00 27 27',
    dropoff: '27 rue du Taur, 31000 Toulouse',
    itemCount: 3,
    bags: 1,
    totalEur: 12.9,
    distanceKm: 1.1,
    etaMin: 8,
    targetTime: '12:30',
    pickupGeo: { lat: 43.6045, lng: 1.4476 },
    dropoffGeo: { lat: 43.6068, lng: 1.4423 },
  },
  {
    orderId: 'demo_8894',
    ref: 'CMD-8894',
    merchantName: 'Pizzeria Napoli',
    merchantArea: 'Rue de Metz, 31000 Toulouse',
    merchantPhone: '01 99 00 88 94',
    clientName: 'Sarah Lopez',
    clientPhone: '01 99 00 03 03',
    dropoff: '3 avenue de Muret, 31300 Toulouse',
    instructions: 'Laisser le colis à la loge si je ne réponds pas.',
    itemCount: 2,
    bags: 2,
    totalEur: 21,
    distanceKm: 3.8,
    etaMin: 19,
    targetTime: '13:10',
    pickupGeo: { lat: 43.6008, lng: 1.4493 },
    dropoffGeo: { lat: 43.5871, lng: 1.4349 },
  },
];

export const isDemoMission = (orderId: string): boolean => orderId.startsWith('demo_');
