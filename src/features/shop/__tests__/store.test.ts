import { getDeal } from '../model/catalog';
import { selectCartCount, selectCartSubtotal, useShopStore } from '../model/store';

const reset = () => useShopStore.setState({ cart: [], favorites: [], orders: [], points: 120 });

describe('shop store', () => {
  beforeEach(reset);

  it('adds items and increments quantity for the same deal', () => {
    const { addToCart } = useShopStore.getState();
    addToCart('d_gigot');
    addToCart('d_gigot');
    addToCart('d_pizza');
    const state = useShopStore.getState();
    expect(state.cart).toHaveLength(2);
    expect(selectCartCount(state)).toBe(3);
  });

  it('decrements and drops the line when quantity hits zero', () => {
    const { addToCart, decrement } = useShopStore.getState();
    addToCart('d_gigot');
    decrement('d_gigot');
    expect(useShopStore.getState().cart).toHaveLength(0);
  });

  it('computes the subtotal from catalog prices', () => {
    useShopStore.getState().addToCart('d_gigot', 2);
    const price = getDeal('d_gigot')!.price;
    expect(selectCartSubtotal(useShopStore.getState())).toBeCloseTo(price * 2);
  });

  it('toggles favorites on and off', () => {
    const { toggleFavorite } = useShopStore.getState();
    toggleFavorite('d_sushi');
    expect(useShopStore.getState().favorites).toContain('d_sushi');
    toggleFavorite('d_sushi');
    expect(useShopStore.getState().favorites).not.toContain('d_sushi');
  });

  it('checkout creates an order, awards points and empties the cart', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_gigot', 2);
    const pointsBefore = useShopStore.getState().points;

    const result = checkout();

    expect(result.ok).toBe(true);
    const state = useShopStore.getState();
    expect(state.cart).toHaveLength(0);
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0]?.items[0]?.dealId).toBe('d_gigot');
    expect(state.points).toBeGreaterThan(pointsBefore);
  });

  it('checkout on an empty cart is a no-op', () => {
    expect(useShopStore.getState().checkout()).toEqual({ ok: false });
    expect(useShopStore.getState().orders).toHaveLength(0);
  });
});
