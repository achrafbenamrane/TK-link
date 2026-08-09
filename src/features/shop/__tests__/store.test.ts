import { getDeal } from '../model/catalog';
import { OrderSchema } from '../model/schema';
import { selectCartCount, selectCartSubtotal, useShopStore } from '../model/store';

const reset = () => useShopStore.setState({ cart: [], favorites: [], orders: [], points: 120 });

describe('shop store', () => {
  beforeEach(reset);

  it('adds items and increments quantity for the same deal', () => {
    const { addToCart } = useShopStore.getState();
    addToCart('d_cote');
    addToCart('d_cote');
    addToCart('d_pizza');
    const state = useShopStore.getState();
    expect(state.cart).toHaveLength(2);
    expect(selectCartCount(state)).toBe(3);
  });

  it('decrements and drops the line when quantity hits zero', () => {
    const { addToCart, decrement } = useShopStore.getState();
    addToCart('d_cote');
    decrement('d_cote');
    expect(useShopStore.getState().cart).toHaveLength(0);
  });

  it('computes the subtotal from catalog prices', () => {
    useShopStore.getState().addToCart('d_cote', 2);
    const price = getDeal('d_cote')!.price;
    expect(selectCartSubtotal(useShopStore.getState())).toBeCloseTo(price * 2);
  });

  it('toggles favorites on and off', () => {
    const { toggleFavorite } = useShopStore.getState();
    toggleFavorite('d_pizza');
    expect(useShopStore.getState().favorites).toContain('d_pizza');
    toggleFavorite('d_pizza');
    expect(useShopStore.getState().favorites).not.toContain('d_pizza');
  });

  it('checkout creates an order, awards points and empties the cart', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_cote', 2);
    const pointsBefore = useShopStore.getState().points;

    const result = checkout();

    expect(result.ok).toBe(true);
    const state = useShopStore.getState();
    expect(state.cart).toHaveLength(0);
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0]?.items[0]?.dealId).toBe('d_cote');
    expect(state.points).toBeGreaterThan(pointsBefore);
  });

  it('checkout on an empty cart is a no-op', () => {
    expect(useShopStore.getState().checkout()).toEqual({ ok: false });
    expect(useShopStore.getState().orders).toHaveLength(0);
  });

  it('applique la remise d’un coupon au total et aux points', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_cote');
    const price = getDeal('d_cote')!.price;

    const res = checkout(null, { discountEur: 5, couponCode: 'TEST5' });
    expect(res.ok).toBe(true);

    const order = useShopStore.getState().orders[0]!;
    expect(order.discount).toBeCloseTo(5);
    expect(order.couponCode).toBe('TEST5');
    expect(order.total).toBeCloseTo(price - 5);
    // Points sur le montant réellement payé, pas sur le sous-total.
    expect(order.pointsEarned).toBe(Math.round(price - 5));
  });

  it('plafonne la remise au sous-total (jamais de total négatif)', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_cote');
    const price = getDeal('d_cote')!.price;

    checkout(null, { discountEur: price + 100, couponCode: 'HUGE' });
    const order = useShopStore.getState().orders[0]!;
    expect(order.discount).toBeCloseTo(price);
    expect(order.total).toBe(0);
    expect(order.pointsEarned).toBe(0);
  });
});

describe('checkout et adresse de livraison', () => {
  const DRAFT = { label: 'Maison', street: '12 rue des Filatiers', zip: '31000', city: 'Toulouse' };

  beforeEach(() => {
    useShopStore.setState({ cart: [], orders: [], addresses: [], points: 0 });
  });

  it('retient l’adresse de livraison sur la commande', () => {
    const addressId = useShopStore.getState().addAddress(DRAFT);
    useShopStore.getState().addToCart('d_cote');
    const res = useShopStore.getState().checkout(addressId);

    expect(res.ok).toBe(true);
    expect(useShopStore.getState().orders[0]?.addressId).toBe(addressId);
  });

  // Les commandes déjà stockées n'ont pas ce champ : il doit rester facultatif
  // côté modèle, sinon la validation efface tout l'historique au lancement.
  it('accepte une commande sans adresse au niveau du modèle', () => {
    useShopStore.getState().addToCart('d_cote');
    expect(useShopStore.getState().checkout().ok).toBe(true);
    expect(useShopStore.getState().orders[0]?.addressId).toBeNull();
  });

  it('refuse toujours un panier vide', () => {
    expect(useShopStore.getState().checkout('adr_1').ok).toBe(false);
  });
});

describe('progression de commande (démo)', () => {
  const orderAgedBy = (seconds: number) => ({
    id: 'o_1',
    createdAt: Date.now() - seconds * 1000,
    addressId: null,
    items: [{ dealId: 'd_cote', title: 'Côte', emoji: '🥩', qty: 1, price: 24.9 }],
    total: 24.9,
    discount: 0,
    couponCode: null,
    deliveryFee: 0,
    fulfilment: 'livraison' as const,
    status: 'creee' as const,
    pointsEarned: 24,
  });

  it('vient d’être créée juste après la commande', () => {
    useShopStore.setState({ orders: [orderAgedBy(5)] });
    useShopStore.getState().syncOrderStatuses();
    expect(useShopStore.getState().orders[0]?.status).toBe('creee');
  });

  it('traverse les statuts du CDC avec le temps', () => {
    const at = (seconds: number) => {
      useShopStore.setState({ orders: [orderAgedBy(seconds)] });
      useShopStore.getState().syncOrderStatuses();
      return useShopStore.getState().orders[0]?.status;
    };
    expect(at(15)).toBe('payee');
    expect(at(40)).toBe('preparation');
    expect(at(90)).toBe('prete');
    expect(at(300)).toBe('livree');
  });

  it('se termine « récupérée » en Click & Collect — CDC §12', () => {
    useShopStore.setState({
      orders: [{ ...orderAgedBy(300), fulfilment: 'click-collect' as const }],
    });
    useShopStore.getState().syncOrderStatuses();
    expect(useShopStore.getState().orders[0]?.status).toBe('recuperee');
  });

  it('ne ressuscite pas une commande annulée', () => {
    // La démo dérive le statut du temps écoulé : sans garde, une annulation
    // serait écrasée cinq secondes plus tard.
    useShopStore.setState({ orders: [{ ...orderAgedBy(300), status: 'annulee' as const }] });
    useShopStore.getState().syncOrderStatuses();
    expect(useShopStore.getState().orders[0]?.status).toBe('annulee');
  });

  // Le tableau ne doit être remplacé que s'il change vraiment : sinon chaque
  // tick notifie les abonnés et l'écran se re-rend en boucle.
  it('ne remplace pas le tableau quand rien ne change', () => {
    useShopStore.setState({ orders: [orderAgedBy(5)] });
    const before = useShopStore.getState().orders;
    useShopStore.getState().syncOrderStatuses();
    expect(useShopStore.getState().orders).toBe(before);
  });
});

describe('migration des commandes stockées — CDC §11', () => {
  it('traduit les anciens statuts sans effacer l’historique', () => {
    // Le vrai risque : un z.enum strict ferait échouer safeParse et le store
    // repartirait de zéro — toutes les commandes du client disparaîtraient.
    const legacy = {
      id: 'o_old',
      createdAt: 1_700_000_000_000,
      addressId: null,
      items: [{ dealId: 'd_cote', title: 'Côte', emoji: '🥩', qty: 1, price: 24.9 }],
      total: 24.9,
      discount: 0,
      couponCode: null,
      deliveryFee: 3,
      status: 'en_preparation',
      pointsEarned: 24,
    };
    const parsed = OrderSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe('preparation');
      // Pas de mode de retrait avant le CDC : la livraison est le défaut.
      expect(parsed.data.fulfilment).toBe('livraison');
    }
  });

  it('traduit aussi « en livraison »', () => {
    const parsed = OrderSchema.safeParse({
      id: 'o',
      createdAt: 1_700_000_000_000,
      items: [],
      total: 0,
      deliveryFee: 0,
      status: 'en_livraison',
      pointsEarned: 0,
    });
    expect(parsed.success && parsed.data.status).toBe('prete');
  });
});
