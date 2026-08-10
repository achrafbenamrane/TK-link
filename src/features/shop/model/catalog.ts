import { countCritical } from '../lib/urgency';
import { PRODUCT_IMAGES } from './product-images';
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

  /* ---- Enseignes des 7 autres catégories du CDC (§4, §23 Q2) ----
     Sans elles, sept des huit onglets de l'accueil seraient vides : la
     taxonomie du CDC serait respectée sur le papier et absurde à l'écran. */
  m_techno: {
    id: 'm_techno',
    name: 'Techno Capitole',
    area: 'Capitole',
    coord: { lat: 43.6047, lng: 1.4442 },
    rating: 4.5,
    halal: false,
    emoji: '📱',
  },
  m_atelier: {
    id: 'm_atelier',
    name: 'L’Atelier Déco',
    area: 'Saint-Étienne',
    coord: { lat: 43.6008, lng: 1.4497 },
    rating: 4.7,
    halal: false,
    emoji: '🏠',
  },
  m_fripe: {
    id: 'm_fripe',
    name: 'Friperie Saint-Sernin',
    area: 'Saint-Sernin',
    coord: { lat: 43.6083, lng: 1.4419 },
    rating: 4.6,
    halal: false,
    emoji: '👗',
  },
  m_bulle: {
    id: 'm_bulle',
    name: 'Bulle & Baume',
    area: 'Jean Jaurès',
    coord: { lat: 43.6069, lng: 1.4498 },
    rating: 4.9,
    halal: false,
    emoji: '💄',
  },
  m_sprint: {
    id: 'm_sprint',
    name: 'Sprint Garonne',
    area: 'Amidonniers',
    coord: { lat: 43.6109, lng: 1.4321 },
    rating: 4.4,
    halal: false,
    emoji: '⚽',
  },
  m_garage: {
    id: 'm_garage',
    name: 'Garage des Ponts',
    area: 'Ponts-Jumeaux',
    coord: { lat: 43.6165, lng: 1.4257 },
    rating: 4.6,
    halal: false,
    emoji: '🚗',
  },
  m_evasion: {
    id: 'm_evasion',
    name: 'Évasion Toulouse',
    area: 'Esquirol',
    coord: { lat: 43.6002, lng: 1.4437 },
    rating: 4.8,
    halal: false,
    emoji: '🎁',
  },
};

export const DEALS: Deal[] = [
  {
    id: 'd_cote',
    title: 'Côte de bœuf maturée',
    merchantId: 'm_hammamet',
    category: 'restauration',
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
    category: 'restauration',
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
    diet: ['vegetarien'] as ('vegetarien' | 'vegan')[],
    title: 'Panier viennoiseries',
    merchantId: 'm_stcyp',
    category: 'restauration',
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
    diet: ['vegetarien', 'vegan'] as ('vegetarien' | 'vegan')[],
    title: 'Panier de légumes de saison',
    merchantId: 'm_carmes',
    category: 'restauration',
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
    diet: ['vegetarien'] as ('vegetarien' | 'vegan')[],
    title: 'Pizza Margherita',
    merchantId: 'm_napoli',
    category: 'restauration',
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
    diet: ['vegetarien'] as ('vegetarien' | 'vegan')[],
    title: 'Plateau de fromages',
    merchantId: 'm_xavier',
    category: 'restauration',
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
    diet: ['vegetarien', 'vegan'] as ('vegetarien' | 'vegan')[],
    title: 'Corbeille de fruits bio',
    merchantId: 'm_jeanne',
    category: 'restauration',
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
    category: 'restauration',
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

  /* ---- Les 7 autres catégories du CDC ----
     ⚠️ Ces offres n'ont pas encore de photo produit : `ProductImage` retombe
     sur la tuile emoji. C'est visible et assumé — une vignette de secours vaut
     mieux qu'un onglet vide, et ces visuels sont à remplacer par les photos
     réelles des commerçants (cf. l'avertissement de `product-images.ts`). */
  {
    id: 'd_casque',
    title: 'Casque audio sans fil',
    merchantId: 'm_techno',
    category: 'high-tech',
    emoji: '🎧',
    tint: '#E1E8F2',
    price: 39.0,
    oldPrice: 89.0,
    unit: 'la pièce',
    rating: 4.5,
    stockTotal: 18,
    stockLeft: 5,
    endsInSeconds: 2700,
    description: 'Réduction de bruit active, 30 h d’autonomie. Fin de série.',
    perk: 'Fin de série',
  },
  {
    id: 'd_tablette',
    title: 'Tablette 10" reconditionnée',
    merchantId: 'm_techno',
    category: 'high-tech',
    emoji: '📱',
    tint: '#E7EAF0',
    price: 129.0,
    oldPrice: 249.0,
    unit: 'la pièce · garantie 12 mois',
    rating: 4.3,
    stockTotal: 8,
    stockLeft: 2,
    endsInSeconds: 4200,
    description: 'Grade A, batterie neuve, chargeur inclus.',
    perk: 'Reconditionné',
  },
  {
    id: 'd_lampe',
    title: 'Lampe artisanale en grès',
    merchantId: 'm_atelier',
    category: 'maison',
    emoji: '🪔',
    tint: '#F0E7DA',
    price: 34.0,
    oldPrice: 62.0,
    unit: 'la pièce',
    rating: 4.7,
    stockTotal: 10,
    stockLeft: 4,
    endsInSeconds: 6000,
    description: 'Tournée à la main à Toulouse. Pièce unique.',
    origin: 'Fabriqué à Toulouse',
  },
  {
    id: 'd_veste',
    title: 'Veste en jean vintage',
    merchantId: 'm_fripe',
    category: 'mode',
    emoji: '🧥',
    tint: '#DEE6F0',
    price: 18.0,
    oldPrice: 45.0,
    unit: 'la pièce · tailles S à XL',
    rating: 4.6,
    stockTotal: 14,
    stockLeft: 6,
    endsInSeconds: 3300,
    description: 'Seconde main sélectionnée, lavée et repassée.',
    perk: 'Seconde main',
  },
  {
    id: 'd_soin',
    diet: ['vegetarien', 'vegan'] as ('vegetarien' | 'vegan')[],
    title: 'Coffret soin visage bio',
    merchantId: 'm_bulle',
    category: 'beaute',
    emoji: '🧴',
    tint: '#F3E4EC',
    price: 22.0,
    oldPrice: 39.0,
    unit: 'le coffret de 3',
    rating: 4.9,
    stockTotal: 20,
    stockLeft: 9,
    endsInSeconds: 5100,
    description: 'Formules courtes, sans parfum de synthèse.',
  },
  {
    id: 'd_padel',
    title: 'Raquette de padel',
    merchantId: 'm_sprint',
    category: 'sport',
    emoji: '🎾',
    tint: '#E2EFE4',
    price: 49.0,
    oldPrice: 95.0,
    unit: 'la raquette',
    rating: 4.4,
    stockTotal: 12,
    stockLeft: 3,
    endsInSeconds: 1500,
    description: 'Modèle de l’an dernier, housse comprise.',
    perk: 'Déstockage',
  },
  {
    id: 'd_revision',
    title: 'Révision + vidange',
    merchantId: 'm_garage',
    category: 'auto',
    emoji: '🔧',
    tint: '#E6E9EC',
    price: 69.0,
    oldPrice: 119.0,
    unit: 'la prestation',
    rating: 4.6,
    stockTotal: 6,
    stockLeft: 2,
    endsInSeconds: 7200,
    description: 'Créneaux libres de la semaine. Filtre et huile inclus.',
    perk: 'Créneaux libres',
  },
  {
    id: 'd_poterie',
    title: 'Atelier poterie · 2 h',
    merchantId: 'm_evasion',
    category: 'services',
    emoji: '🏺',
    tint: '#EFE6DC',
    price: 25.0,
    oldPrice: 45.0,
    unit: 'la place',
    rating: 4.8,
    stockTotal: 8,
    stockLeft: 3,
    endsInSeconds: 3900,
    description: 'Places restantes sur la session de samedi.',
    perk: 'Dernières places',
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

/**
 * Combien d'invendus sont en dernière chance, tout le catalogue confondu.
 *
 * Les écrans qui affichent ce compteur (le bandeau du hub) n'ont pas la liste
 * des offres sous la main : leur passer `DEALS` entier pour qu'ils le comptent
 * eux-mêmes exposerait le catalogue sans raison.
 */
export function criticalDealCount(): number {
  return countCritical(DEALS);
}

/** The hero flash sale surfaced at the top of the feed. */
export const FEATURED_DEAL_ID = 'd_cote';

/**
 * Le commerçant sous lequel apparaissent les offres publiées depuis l'app —
 * CDC §9.
 *
 * En démonstration, l'utilisateur qui publie n'a pas encore de fiche
 * commerçant : ses ventes flash s'affichent donc sous une enseigne du
 * catalogue, à quelques rues d'ici. Le jour où le back-office existe, elles
 * porteront sa vraie fiche — seule cette constante disparaît.
 */
export const LOCAL_MERCHANT_ID = 'm_petit';

/**
 * Source d'image d'une pièce de jeu. `number` = asset embarqué ; `{ uri }` =
 * URL distante. expo-image accepte les deux, donc une photo uploadée par le
 * commerçant s'affiche sans rien changer aux jeux.
 */
export type GameImageSource = number | { uri: string };

/**
 * Le visuel d'une offre pour les jeux : la PHOTO RÉELLE uploadée par le
 * commerçant si elle existe, sinon le visuel embarqué de secours. `null` si
 * l'offre n'a aucun visuel (elle n'apparaît alors pas dans les jeux).
 */
function dealImageSource(deal: Deal): GameImageSource | null {
  if (deal.imageUrl) return { uri: deal.imageUrl };
  const bundled = PRODUCT_IMAGES[deal.id];
  return bundled != null ? bundled : null;
}

/**
 * Réservoir d'images des jeux : chaque offre AVEC visuel devient une pièce. On
 * dérive de la liste vivante des offres, donc toute offre ajoutée ou dont la
 * photo change se répercute automatiquement — priorité à la photo uploadée.
 */
export function dealImagePool(): { id: string; source: GameImageSource }[] {
  const pool: { id: string; source: GameImageSource }[] = [];
  for (const deal of DEALS) {
    const source = dealImageSource(deal);
    if (source !== null) pool.push({ id: deal.id, source });
  }
  return pool;
}

/**
 * Réservoir pour le quiz « Le juste prix » : titre + vrai prix + la photo de
 * l'offre (uploadée si dispo). Se remplit tout seul avec les offres.
 */
export function dealQuizPool(): {
  id: string;
  title: string;
  price: number;
  emoji: string;
  image?: GameImageSource;
}[] {
  return DEALS.map((d) => {
    const source = dealImageSource(d);
    return {
      id: d.id,
      title: d.title,
      price: d.price,
      emoji: d.emoji,
      ...(source !== null ? { image: source } : {}),
    };
  });
}
