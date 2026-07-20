import { getDeal } from '../model/catalog';
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
