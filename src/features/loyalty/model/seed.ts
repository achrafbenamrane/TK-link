import type { Gift, LoyaltyCard, Offer, PointsEntry } from './schema';

/**
 * Données de démonstration de la fidélité.
 *
 * En production, la carte vient du commerçant (particuliers) ou du comptable
 * (pros), les points des tickets, et les offres du back-office. Ici on sème de
 * quoi montrer le programme complet.
 */

const DAY = 24 * 3600 * 1000;

export function seedCard(now: number = Date.now()): LoyaltyCard {
  return {
    number: '70142299',
    medium: 'carte',
    holder: '',
    holderType: 'particulier',
    activatedAt: now - 60 * DAY,
  };
}

export function seedEntries(now: number = Date.now()): PointsEntry[] {
  return [
    { id: 'p1', points: 120, label: 'Carrefour City', at: now - 1 * DAY, source: 'achat' },
    { id: 'p2', points: 68, label: 'TotalEnergies', at: now - 3 * DAY, source: 'achat' },
    { id: 'p3', points: 50, label: 'Victoire à PacTK', at: now - 4 * DAY, source: 'jeu' },
    { id: 'p4', points: 38, label: 'Le Comptoir du Midi', at: now - 5 * DAY, source: 'achat' },
    {
      id: 'p5',
      points: 100,
      label: 'Parrainage — Sofiane',
      at: now - 9 * DAY,
      source: 'parrainage',
    },
    { id: 'p6', points: -200, label: 'Café offert échangé', at: now - 12 * DAY, source: 'cadeau' },
    { id: 'p7', points: 60, label: 'Monoprix', at: now - 34 * DAY, source: 'achat' },
    { id: 'p8', points: 50, label: 'Bienvenue chez TK LINK', at: now - 60 * DAY, source: 'bonus' },
  ];
}

export const GIFTS: Gift[] = [
  {
    id: 'g_cafe',
    title: 'Café offert',
    partner: 'Le Comptoir du Midi',
    cost: 150,
    detail: 'Un café, chez l’un des commerces partenaires.',
    audience: null,
  },
  {
    id: 'g_bon5',
    title: 'Bon d’achat 5 €',
    partner: 'Tous commerces',
    cost: 500,
    detail: 'Valable sur votre prochain passage en caisse.',
    audience: null,
  },
  {
    id: 'g_livraison',
    title: 'Pain offert',
    partner: 'Boulangerie Marchand',
    cost: 250,
    detail: 'Une baguette tradition, tous les jours jusqu’à 19 h.',
    audience: null,
  },
  {
    id: 'g_bon20',
    title: 'Bon d’achat 20 €',
    partner: 'Tous commerces',
    cost: 1800,
    detail: 'Le palier qui récompense les habitués.',
    audience: null,
  },
  {
    id: 'g_compta',
    title: 'Export comptable illimité',
    partner: 'TK LINK',
    cost: 1200,
    detail: 'Un mois d’exports sans limite pour votre comptable.',
    audience: 'pro',
  },
  {
    id: 'g_plante',
    title: 'Un arbre planté',
    partner: 'Reforest’Action',
    cost: 800,
    detail: 'Vos tickets évités deviennent un arbre bien réel.',
    audience: null,
  },
];

export function seedOffers(now: number = Date.now()): Offer[] {
  return [
    {
      id: 'o1',
      merchant: 'Carrefour City',
      title: 'Le rayon frais',
      claim: '-30 %',
      category: 'Alimentation',
      flash: true,
      endsAt: now + 5 * 3600 * 1000,
    },
    {
      id: 'o2',
      merchant: 'Boulangerie Marchand',
      title: 'Viennoiseries',
      claim: '2 + 1 offert',
      category: 'Alimentation',
      flash: true,
      endsAt: now + 2 * DAY,
    },
    {
      id: 'o3',
      merchant: 'Le Comptoir du Midi',
      title: 'Formule déjeuner',
      claim: '-20 %',
      category: 'Restauration',
      flash: false,
      endsAt: null,
    },
    {
      id: 'o4',
      merchant: 'Bureau Vallée',
      title: 'Fournitures de bureau',
      claim: '-15 %',
      category: 'Fournitures',
      flash: false,
      endsAt: null,
    },
    {
      id: 'o5',
      merchant: 'TotalEnergies',
      title: 'Carburant',
      claim: '-3 c€ / L',
      category: 'Carburant',
      flash: true,
      endsAt: now + 12 * 3600 * 1000,
    },
    {
      id: 'o6',
      merchant: 'Cinéma Pathé',
      title: 'Séances en semaine',
      claim: '-25 %',
      category: 'Loisirs',
      flash: false,
      endsAt: null,
    },
  ];
}
