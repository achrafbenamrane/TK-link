import { render, screen } from '@/shared/testing/render';

import { CouponsScreen } from '../ui/coupons-screen';
import { useCouponsStore } from '../model/store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

beforeEach(() => {
  // Le portefeuille démarre VIDE : les codes promo sont seedés, pas les
  // coupons détenus. Chaque test pose donc l'état dont il parle.
  useCouponsStore.setState({ wallet: [] });
});

describe('<CouponsScreen /> — le portefeuille', () => {
  it('montre les coupons détenus', () => {
    const coupon = useCouponsStore
      .getState()
      .grantEarnedCoupon({ kind: 'percent', pct: 10 }, 'Bien joué');

    render(<CouponsScreen />);

    expect(screen.getByTestId(`coupon-${coupon.id}`)).toBeTruthy();
    expect(screen.queryByTestId('coupons-empty')).toBeNull();
  });

  it('dit quoi faire quand il n’y a rien, plutôt que d’afficher un blanc', () => {
    render(<CouponsScreen />);

    expect(screen.getByTestId('coupons-empty')).toBeTruthy();
  });

  it('ne propose PAS de saisir un code ici — il se saisit dans La Chasse', () => {
    // Le champ a déménagé à côté des jeux. Le laisser en double ferait deux
    // sources de vérité pour une même action, et l'une finirait par diverger.
    render(<CouponsScreen />);

    expect(screen.queryByTestId('coupon-code-input')).toBeNull();
    // Mais on DIT où il est : arriver ici avec un code en main et ne rien
    // trouver serait une impasse.
    expect(screen.getByTestId('coupon-goto-promo')).toBeTruthy();
  });
});
