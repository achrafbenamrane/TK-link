// Filet anti-crash pour les écrans coupons (parcours démo).
import { render, screen } from '@/shared/testing/render';

import { AdminCouponsScreen } from '../ui/admin-coupons-screen';
import { CouponsScreen } from '../ui/coupons-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

describe('smoke — écrans coupons montent sans planter', () => {
  it('CouponsScreen (portefeuille + saisie de code)', () => {
    render(<CouponsScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('AdminCouponsScreen (catalogue de codes promo seedé)', () => {
    render(<AdminCouponsScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
