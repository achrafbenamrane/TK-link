// La route et la biométrie sont hors sujet ici : on les neutralise pour tester
// le seul cœur « argent » — l'application d'un coupon au total.
import { useState } from 'react';

import { fireEvent, render, screen } from '@/shared/testing/render';

import { CartScreen, type CartCouponOption } from '../ui/cart-screen';
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

const OPTIONS: CartCouponOption[] = [
  { id: 'c1', code: 'GAGNE5', label: 'Victoire au jeu', discountLabel: '5,00 €', discountEur: 5 },
];

/** Reproduit le contrat contrôlé de la route : le parent tient `selectedId`. */
function Harness() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <CartScreen
      coupons={{ options: OPTIONS, selectedId, onSelect: setSelectedId, onApplied: jest.fn() }}
    />
  );
}

describe('<CartScreen /> — coupon à la caisse', () => {
  beforeEach(() => {
    // d_pizza = 6,90 € (catalogue) ; panier à une ligne.
    useShopStore.setState({ cart: [{ dealId: 'd_pizza', qty: 1 }] });
  });

  it('déduit la remise du total quand on applique un coupon', () => {
    render(<Harness />);

    // Départ : total = sous-total, pas de ligne de réduction.
    expect(screen.getByTestId('cart-total')).toHaveTextContent('6.90€');
    expect(screen.queryByTestId('cart-discount-line')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('cart-coupon-open'));
    fireEvent.press(screen.getByTestId('cart-coupon-option-c1'));

    expect(screen.getByTestId('cart-coupon-applied')).toBeOnTheScreen();
    // La ligne porte aussi « Réduction (GAGNE5) » : on cherche le montant.
    expect(screen.getByTestId('cart-discount-line')).toHaveTextContent(/5\.00€/);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('1.90€');
  });

  it('retire le coupon et rétablit le total plein', () => {
    render(<Harness />);

    fireEvent.press(screen.getByTestId('cart-coupon-open'));
    fireEvent.press(screen.getByTestId('cart-coupon-option-c1'));
    expect(screen.getByTestId('cart-total')).toHaveTextContent('1.90€');

    fireEvent.press(screen.getByTestId('cart-coupon-remove'));

    expect(screen.queryByTestId('cart-discount-line')).not.toBeOnTheScreen();
    expect(screen.getByTestId('cart-total')).toHaveTextContent('6.90€');
  });
});
