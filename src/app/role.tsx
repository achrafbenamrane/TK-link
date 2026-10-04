import { useRouter } from 'expo-router';

import { useCourierStore } from '@/features/courier';
import { DEFAULT_TIERS, useMerchantLoyaltyStore } from '@/features/loyalty';
import { useMerchantStore } from '@/features/merchant';
import { RoleScreen, useOnboardingStore } from '@/features/onboarding';
import { useReferralStore } from '@/features/referral';
import { LOCAL_MERCHANT_DEAL_IDS, productImageUri, useShopStore } from '@/features/shop';
import type { Role } from '@/shared/lib/roles';

/**
 * LE CHOIX DU PROFIL — avant l'inscription et la connexion.
 *
 * La route range le rôle puis ouvre l'inscription de ce profil : le client et
 * le commerçant partagent le formulaire (variantes), le livreur enchaîne ensuite
 * sur ses justificatifs, le grossiste sur le portail web.
 *
 * « Démo » ouvre l'app d'un profil déjà REMPLI — commandes, fidélité, offres,
 * boutique, missions, avec leurs images et leurs textes — pour montrer au client ce
 * que chacun voit. Ce sont des données d'exemple, posées dans les stores locaux ;
 * aucun serveur n'est touché.
 */

const MIN = 60_000;
const DAY = 24 * 3600 * 1000;

type Status = 'payee' | 'preparation' | 'prete' | 'recuperee' | 'livree';

function demoOrder(
  id: string,
  dealId: string,
  title: string,
  emoji: string,
  price: number,
  qty: number,
  status: Status,
  fulfilment: 'touch-collect' | 'livraison',
  ageMs: number,
  extra: { rated?: boolean } = {},
) {
  const total = Math.round(price * qty * 100) / 100;
  return {
    id,
    createdAt: Date.now() - ageMs,
    addressId: fulfilment === 'livraison' ? 'demo_addr' : null,
    items: [{ dealId, title, emoji, qty, price }],
    total,
    discount: 0,
    deliveryFee: 0,
    fulfilment,
    status,
    pointsEarned: Math.round(total),
    managed: true,
    rating: extra.rated
      ? { stars: 5, tags: ['Rapide' as const, 'Produit frais' as const], at: Date.now() - DAY }
      : null,
    issue: null,
  };
}

function seedDemo(role: Role) {
  const now = Date.now();

  // --- Le profil ----------------------------------------------------------
  const onboarding = useOnboardingStore.getState();
  onboarding.setFirstName(role === 'commercant' ? 'Karim' : role === 'livreur' ? 'Alex' : 'Neo');
  onboarding.setInterests(['restauration', 'high-tech', 'maison']);
  onboarding.setRole(role);
  onboarding.complete();

  // --- Boutique (client) : adresse, favoris, commandes ----------------------
  const localDeal = LOCAL_MERCHANT_DEAL_IDS[0] ?? 'd_cassoulet';
  useShopStore.setState({
    favorites: ['d_cote', 'd_pizza', 'd_casque', 'd_viennoiseries'],
    addresses: [
      {
        id: 'demo_addr',
        label: 'Maison',
        street: '12 rue des Arts',
        zip: '31000',
        city: 'Toulouse',
        notes: 'Digicode 4521, 2e étage',
        isDefault: true,
      },
    ],
    merchantApplication: {
      shopName: 'Le Petit Toulousain',
      category: 'restauration',
      contactName: 'Karim Ben Salah',
      phone: '05 61 22 33 44',
      email: 'contact@petit-toulousain.fr',
      area: 'Carmes',
      address: '8 rue des Carmes, 31000 Toulouse',
      modes: ['touch-collect', 'livraison'],
    },
    orders: [
      // Côté commerçant : les commandes à traiter
      demoOrder(
        'demo_ord_4a1b2c',
        localDeal,
        'Cassoulet maison · 2 pers.',
        '🍲',
        12.9,
        1,
        'payee',
        'touch-collect',
        4 * MIN,
      ),
      demoOrder(
        'demo_ord_5d3e4f',
        localDeal,
        'Cassoulet maison · 2 pers.',
        '🍲',
        12.9,
        2,
        'preparation',
        'livraison',
        12 * MIN,
      ),
      demoOrder(
        'demo_ord_6a7b8c',
        localDeal,
        'Cassoulet maison · 2 pers.',
        '🍲',
        12.9,
        1,
        'prete',
        'livraison',
        25 * MIN,
      ),
      demoOrder(
        'demo_ord_7c8d9e',
        localDeal,
        'Cassoulet maison · 2 pers.',
        '🍲',
        12.9,
        3,
        'recuperee',
        'touch-collect',
        3 * 3600_000,
      ),
      // Côté client : ses propres commandes
      demoOrder(
        'demo_ord_a1b2c3',
        'd_pizza',
        'Pizza Margherita',
        '🍕',
        6.9,
        2,
        'recuperee',
        'touch-collect',
        2 * DAY,
        { rated: true },
      ),
      demoOrder(
        'demo_ord_b4c5d6',
        'd_cote',
        'Côte de bœuf maturée',
        '🥩',
        24.9,
        1,
        'preparation',
        'livraison',
        8 * MIN,
      ),
      demoOrder(
        'demo_ord_c7d8e9',
        'd_viennoiseries',
        'Plateau de viennoiseries',
        '🥐',
        4.5,
        1,
        'prete',
        'touch-collect',
        15 * MIN,
      ),
    ],
    cart: [],
  });

  // --- Fidélité : points chez plusieurs commerçants, une récompense à QR -----
  const history = (a: number, b: number) => [
    { id: `h${a}`, label: 'Commande', points: a, at: now - 2 * DAY },
    { id: `h${b}`, label: 'Commande', points: b, at: now - 9 * DAY },
    { id: 'hb', label: 'Bonus', points: 14, at: now - 24 * DAY },
  ];
  useMerchantLoyaltyStore.setState({
    cards: {
      m_napoli: { points: 113, claimed: [1], history: history(74, 25) },
      m_hammamet: { points: 85, claimed: [], history: history(60, 11) },
      m_stcyp: { points: 42, claimed: [], history: history(30, 12) },
      m_petit: { points: 26, claimed: [], history: history(18, 8) },
    },
    programs: { m_petit: { unit: 'euros', tiers: DEFAULT_TIERS } },
    rewards: [
      {
        id: 'demo_rw_1',
        merchantId: 'm_napoli',
        merchantName: 'Pizzeria Napoli',
        rank: 1,
        label: '1 boisson 33 cl',
        code: 'TK-DEMO24',
        status: 'disponible',
        at: now - DAY,
      },
    ],
  });
  useReferralStore.setState({ myCode: 'TK-NEV234', referredBy: null, credit: 'aucun' });

  // --- Espace commerçant : offres avec photo, boutique, vitrine --------------
  const offer = (
    id: string,
    title: string,
    dealId: string,
    category: 'restauration',
    price: number,
    old: number,
    stock: number,
    left: number,
    minutes: number,
    description: string,
  ) => ({
    id,
    title,
    category,
    priceCents: price,
    oldPriceCents: old,
    stock,
    stockLeft: left,
    durationMinutes: minutes,
    description,
    publishedAt: now - 20 * MIN,
    startsAt: 0,
    state: 'publiee' as const,
    offline: false,
    audience: 'clients' as const,
    photoUri: productImageUri(dealId),
    modes: ['touch-collect' as const, 'livraison' as const],
    seller: '',
    minQty: 1,
  });
  useMerchantStore.setState({
    offers: [
      offer(
        'demo_o1',
        'Cassoulet maison · 2 pers.',
        'd_cassoulet',
        'restauration',
        1290,
        1890,
        20,
        12,
        120,
        'Mijoté hier, à finir de réchauffer.',
      ),
      offer(
        'demo_o2',
        'Plateau de viennoiseries',
        'd_viennoiseries',
        'restauration',
        450,
        900,
        15,
        6,
        60,
        'Les invendus du matin, cuits ce jour.',
      ),
      offer(
        'demo_o3',
        'Pizza Margherita',
        'd_pizza',
        'restauration',
        690,
        1190,
        10,
        4,
        90,
        'Pâte maturée 48 h, mozzarella fior di latte.',
      ),
    ],
    used: 3,
    purchased: 0,
    profile: {
      presentation:
        'Cuisine du Sud-Ouest depuis 1998, au cœur des Carmes. Nous vendons à prix réduit ce qui doit partir dans la journée : plats mijotés, viennoiseries, pizzas.',
      photos: [
        productImageUri('d_cassoulet'),
        productImageUri('d_viennoiseries'),
        productImageUri('d_pizza'),
        productImageUri('d_brunch'),
      ],
      videos: ['demo'],
      zone: 'Toulouse centre · rayon 5 km',
      modes: ['touch-collect', 'livraison'],
      hours: {
        lundi: { open: true, from: '09:00', to: '19:00' },
        mardi: { open: true, from: '09:00', to: '19:00' },
        mercredi: { open: true, from: '09:00', to: '19:00' },
        jeudi: { open: true, from: '09:00', to: '19:00' },
        vendredi: { open: true, from: '09:00', to: '21:00' },
        samedi: { open: true, from: '10:00', to: '21:00' },
        dimanche: { open: false, from: '09:00', to: '18:00' },
      },
    },
  });

  // --- Livreur : compte validé, en ligne, quelques courses livrées ----------
  useCourierStore.setState({
    status: 'valide',
    vehicle: 'scooter',
    zone: 'Toulouse centre',
    idUri: 'demo',
    selfieUri: 'demo',
    deviceEnrolled: true,
    online: role === 'livreur',
    active: null,
    declined: [],
    history: [
      {
        orderId: 'demo_h1',
        merchantName: 'Sushi Tokyo',
        at: now - 3 * 3600_000,
        distanceKm: 2.4,
        gainEur: 3,
        gainComplet: false,
        proofUri: 'demo',
      },
      {
        orderId: 'demo_h2',
        merchantName: 'Pizzeria Napoli',
        at: now - DAY,
        distanceKm: 3.8,
        gainEur: 3,
        gainComplet: false,
        proofUri: 'demo',
      },
      {
        orderId: 'demo_h3',
        merchantName: 'Boulangerie des Halles',
        at: now - 2 * DAY,
        distanceKm: 1.1,
        gainEur: 3,
        gainComplet: false,
        proofUri: 'demo',
      },
    ],
  });
}

export default function RoleRoute() {
  const router = useRouter();
  const setRole = useOnboardingStore((s) => s.setRole);

  return (
    <RoleScreen
      onPick={(role) => {
        setRole(role);
        router.replace('/sign-up');
      }}
      onDemo={(role) => {
        seedDemo(role);
        router.replace('/');
      }}
      onSignIn={() => router.replace('/sign-in')}
    />
  );
}
