// La route et la biométrie sont hors sujet ici : on les neutralise pour tester
// le seul cœur « argent » : le total et le mode de retrait.
import { fireEvent, render, screen } from '@/shared/testing/render';

import { CartScreen } from '../ui/cart-screen';
import { useShopStore } from '../model/store';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));
jest.mock('../lib/biometrics', () => ({
  authenticate: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('<CartScreen /> — total', () => {
  beforeEach(() => {
    // d_pizza = 6,90 € (catalogue) ; panier à une ligne.
    useShopStore.setState({ cart: [{ dealId: 'd_pizza', qty: 1 }] });
  });

  it('le total est le sous-total : aucune réduction ni coupon à la caisse', () => {
    render(<CartScreen />);

    expect(screen.getByTestId('cart-total')).toHaveTextContent('6.90€');
    expect(screen.queryByTestId('cart-discount-line')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('cart-coupon-open')).not.toBeOnTheScreen();
  });
});

describe('<CartScreen /> — mode de retrait (CDC §12)', () => {
  beforeEach(() => {
    useShopStore.setState({ cart: [{ dealId: 'd_pizza', qty: 1 }], addresses: [] });
  });

  it('démarre en livraison et réclame une adresse', () => {
    render(<CartScreen />);
    expect(screen.getByTestId('cart-address')).toBeOnTheScreen();
    expect(screen.getByTestId('cart-checkout')).toHaveTextContent(/Choisir une adresse/);
  });

  it('bascule en Touch & Collect : plus d’adresse, plus de blocage', () => {
    render(<CartScreen />);
    fireEvent.press(screen.getByTestId('cart-fulfilment-touch-collect'));

    // L’adresse disparaît : c’est le client qui se déplace. Sans ce
    // basculement, le Touch & Collect resterait bloqué derrière un champ
    // « adresse de livraison » qui n’a aucun sens pour lui.
    expect(screen.queryByTestId('cart-address')).not.toBeOnTheScreen();
    expect(screen.getByTestId('cart-collect-note')).toBeOnTheScreen();
    expect(screen.getByTestId('cart-checkout')).toHaveTextContent(/Payer/);
  });

  it('revient à la livraison si on le redemande', () => {
    render(<CartScreen />);
    fireEvent.press(screen.getByTestId('cart-fulfilment-touch-collect'));
    fireEvent.press(screen.getByTestId('cart-fulfilment-livraison'));
    expect(screen.getByTestId('cart-address')).toBeOnTheScreen();
  });
});

describe('<CartScreen /> — crédit de parrainage (CDC V1.1)', () => {
  beforeEach(() => {
    useShopStore.setState({ cart: [{ dealId: 'd_pizza', qty: 1 }], addresses: [], orders: [] });
  });

  it('déduit le crédit AVANT le paiement et le montre sur sa propre ligne', () => {
    render(<CartScreen credit={5} />);
    fireEvent.press(screen.getByTestId('cart-fulfilment-touch-collect'));

    expect(screen.getByTestId('cart-credit')).toHaveTextContent(/−5.00€/);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('1.90€');
  });

  it('ne rembourse jamais plus que les articles', () => {
    render(<CartScreen credit={50} />);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00€');
  });

  it('enregistre la réduction dans la commande', async () => {
    render(<CartScreen credit={5} />);
    fireEvent.press(screen.getByTestId('cart-fulfilment-touch-collect'));
    fireEvent.press(screen.getByTestId('cart-checkout'));
    await screen.findByTestId('cart-checkout').catch(() => undefined);

    const order = useShopStore.getState().orders[0];
    expect(order?.discount).toBe(5);
    expect(order?.total).toBe(1.9);
  });

  it('sans crédit, aucune ligne de réduction', () => {
    render(<CartScreen />);
    expect(screen.queryByTestId('cart-credit')).not.toBeOnTheScreen();
  });
});
