import { render, screen } from '@/shared/testing/render';

import { useShopStore } from '../model/store';
import { ProfileScreen } from '../ui/profile-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}));

describe('<ProfileScreen />', () => {
  it('rend sans planter, solde vide', () => {
    useShopStore.setState({ points: 0, vouchers: [] });
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-screen')).toBeOnTheScreen();
  });

  it('rend avec des points et des bons (palier atteint)', () => {
    useShopStore.setState({
      points: 250,
      vouchers: [{ id: 'v1', code: 'ABCD-1234', value: 2, createdAt: 1, usedAt: null }],
    });
    render(<ProfileScreen />);
    expect(screen.getByTestId('claim-reward')).toBeOnTheScreen();
  });
});
