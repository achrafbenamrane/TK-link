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

  it('ne montre QUE le portefeuille, sans raccourci vers d’où l’on vient', () => {
    // Gagner un coupon se fait dans La Chasse, et c'est de là qu'on arrive
    // ici : des raccourcis en tête de page renverraient vers l'écran
    // précédent — un aller-retour, pas un chemin.
    useCouponsStore.getState().grantEarnedCoupon({ kind: 'percent', pct: 10 }, 'Bien joué');
    render(<CouponsScreen />);

    expect(screen.queryByTestId('coupon-code-input')).toBeNull();
    expect(screen.queryByTestId('coupon-goto-promo')).toBeNull();
    expect(screen.queryByTestId('coupon-play')).toBeNull();
  });
});
