import type { Category, Deal, Merchant } from './schema';

/**
 * Static demo catalog — Toulouse merchants and their flash sales.
 * Product visuals are emoji placeholders on a tinted tile; they drop out the
 * day real merchant photos arrive. Prices in euros, durations in seconds.
 */

export const MERCHANTS: Record<string, Merchant> = {
  m_hammamet: {
    id: 'm_hammamet',
    name: 'Maison Hammamet',
    area: 'Empalot',
    coord: { lat: 43.5766, lng: 1.4358 },
    rating: 5.0,
    halal: true,
    emoji: '🥩',
  },
  m_petit: {
    id: 'm_petit',
    name: 'Le Petit Toulousain',
    area: 'Carmes',
    coord: { lat: 43.5968, lng: 1.4445 },
    rating: 4.8,
    halal: false,
    emoji: '🍽️',
  },
  m_stcyp: {
    id: 'm_stcyp',
    name: 'Boulangerie Saint-Cyprien',
    area: 'Saint-Cyprien',
    coord: { lat: 43.5985, lng: 1.43 },
    rating: 4.7,
    halal: false,
    emoji: '🥐',
  },
  m_carmes: {
    id: 'm_carmes',
    name: 'Primeur des Carmes',
    area: 'Carmes',
    coord: { lat: 43.5952, lng: 1.4425 },
    rating: 4.9,
    halal: false,
    emoji: '🥬',
  },
  m_napoli: {
    id: 'm_napoli',
    name: 'Pizzeria Napoli',
    area: 'Wilson',
    coord: { lat: 43.6053, lng: 1.4478 },
    rating: 4.6,
    halal: false,
    emoji: '🍕',
  },
  m_xavier: {
    id: 'm_xavier',
    name: 'Fromagerie Xavier',
    area: 'Capitole',
    coord: { lat: 43.6043, lng: 1.4437 },
    rating: 4.9,
    halal: false,
    emoji: '🧀',
  },
  m_jeanne: {
    id: 'm_jeanne',
    name: 'Épicerie Bio Jeanne',
    area: 'Minimes',
    coord: { lat: 43.6182, lng: 1.4365 },
    rating: 4.8,
    halal: false,
    emoji: '🍎',
  },
  m_racines: {
    id: 'm_racines',
    name: 'Café Racines',
    area: 'Saint-Aubin',
    coord: { lat: 43.6063, lng: 1.453 },
    rating: 4.8,
    halal: false,
    emoji: '🥗',
  },
};

export const DEALS: Deal[] = [
  {
    id: 'd_cote',
    title: 'Côte de bœuf maturée',
    merchantId: 'm_hammamet',
    category: 'courses',
    emoji: '🥩',
    tint: '#F7E0D6',
    price: 24.9,
    oldPrice: 34.9,
    unit: 'la pièce · 1,2–1,6 kg',
    rating: 5.0,
    stockTotal: 50,
    stockLeft: 25,
    endsInSeconds: 285,
    description: 'Viande fraîche, découpe du jour. Halal, origine France.',
    perk: '50 % sur le 2ᵉ',
    origin: 'Origine France',
  },
  {
    id: 'd_cassoulet',
    title: 'Cassoulet maison · 2 pers.',
    merchantId: 'm_petit',
    category: 'restos',
    emoji: '🍲',
    tint: '#F6E7CE',
    price: 12.9,
    oldPrice: 19.0,
    unit: 'la portion',
    rating: 4.8,
    stockTotal: 20,
    stockLeft: 6,
    endsInSeconds: 1800,
    description: 'Le vrai, mijoté 12 h au confit. À emporter bien chaud.',
    perk: 'Dernières parts',
  },
  {
    id: 'd_viennoiseries',
    title: 'Panier viennoiseries',
    merchantId: 'm_stcyp',
    category: 'artisans',
    emoji: '🥐',
    tint: '#F9EAD1',
    price: 4.5,
    oldPrice: 11.0,
    unit: 'le panier de 6',
    rating: 4.7,
    stockTotal: 15,
    stockLeft: 4,
    endsInSeconds: 900,
    description: 'Invendus du jour, encore tièdes. Geste anti-gaspi.',
    perk: 'Anti-gaspi',
  },
  {
    id: 'd_legumes',
    title: 'Panier de légumes de saison',
    merchantId: 'm_carmes',
    category: 'courses',
    emoji: '🥦',
    tint: '#E4EEDA',
    price: 6.9,
    oldPrice: 12.0,
    unit: 'le panier · 3 kg',
    rating: 4.9,
    stockTotal: 30,
    stockLeft: 12,
    endsInSeconds: 3600,
    description: 'Producteurs du Sud-Ouest, cueilli ce matin.',
    origin: 'Sud-Ouest',
  },
  {
    id: 'd_pizza',
    title: 'Pizza Margherita',
    merchantId: 'm_napoli',
    category: 'restos',
    emoji: '🍕',
    tint: '#FBE3D3',
    price: 6.9,
    oldPrice: 11.9,
    unit: 'la pizza',
    rating: 4.6,
    stockTotal: 40,
    stockLeft: 18,
    endsInSeconds: 1200,
    description: 'Pâte maturée 48 h, mozzarella fior di latte.',
    perk: '2 = 1 boisson',
  },
  {
    id: 'd_fromage',
    title: 'Plateau de fromages',
    merchantId: 'm_xavier',
    category: 'artisans',
    emoji: '🧀',
    tint: '#F5EBCF',
    price: 12.0,
    oldPrice: 18.0,
    unit: 'le plateau',
    rating: 4.9,
    stockTotal: 12,
    stockLeft: 3,
    endsInSeconds: 2400,
    description: 'Sélection de l’affineur : 5 fromages fermiers.',
  },
  {
    id: 'd_fruits',
    title: 'Corbeille de fruits bio',
    merchantId: 'm_jeanne',
    category: 'courses',
    emoji: '🍎',
    tint: '#F6E2E0',
    price: 5.9,
    oldPrice: 10.0,
    unit: 'la corbeille · 2 kg',
    rating: 4.8,
    stockTotal: 22,
    stockLeft: 7,
    endsInSeconds: 5400,
    description: 'Bio et de saison : pommes, poires, agrumes.',
  },
  {
    id: 'd_brunch',
    title: 'Brunch box complète',
    merchantId: 'm_racines',
    category: 'restos',
    emoji: '🥗',
    tint: '#E9EFD9',
    price: 10.0,
    oldPrice: 16.0,
    unit: 'la box',
    rating: 4.8,
    stockTotal: 16,
    stockLeft: 8,
    endsInSeconds: 1500,
    description: 'Œufs, avocat, granola et jus pressé.',
  },
];

const DEAL_BY_ID: Record<string, Deal> = Object.fromEntries(DEALS.map((d) => [d.id, d]));

export function getDeal(id: string): Deal | undefined {
  return DEAL_BY_ID[id];
}

export function getMerchant(id: string): Merchant | undefined {
  return MERCHANTS[id];
}

export function dealsByCategory(category: Category | null): Deal[] {
  if (!category) return DEALS;
  return DEALS.filter((d) => d.category === category);
}

/** The hero flash sale surfaced at the top of the feed. */
export const FEATURED_DEAL_ID = 'd_cote';
