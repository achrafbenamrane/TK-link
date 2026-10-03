import { POINTS_PER_EURO } from '../model/loyalty';
import { getDeal } from '../model/catalog';
import { useShopStore } from '../model/store';

beforeEach(() => {
  useShopStore.setState({ cart: [], orders: [] });
});

/**
 * La règle des points — CDC §8.1, V1.1 (Utilisateur > Points) :
 * 1 € TTC dépensé en produits = 1 point, livraison et frais annexes exclus.
 * Les points sont attribués par le commerçant sur son propre programme : le
 * magasin du client n'en tient AUCUN solde global.
 */
describe('points de fidélité — CDC §8.1', () => {
  it('1 € dépensé = 1 point', () => {
    expect(POINTS_PER_EURO).toBe(1);
  });

  it('une commande porte les points gagnés, sans solde global', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_cote', 2);
    const total = getDeal('d_cote')!.price * 2;

    expect(checkout().ok).toBe(true);

    const state = useShopStore.getState();
    expect(state.orders[0]?.pointsEarned).toBe(Math.round(total * POINTS_PER_EURO));
    expect(state).not.toHaveProperty('points');
    expect(state).not.toHaveProperty('vouchers');
  });

  it('la livraison n’entre pas dans le calcul des points', () => {
    const { addToCart, checkout } = useShopStore.getState();
    addToCart('d_cote');
    checkout(null, 'livraison');

    const order = useShopStore.getState().orders[0]!;
    expect(order.pointsEarned).toBe(Math.round(order.total * POINTS_PER_EURO));
  });
});
