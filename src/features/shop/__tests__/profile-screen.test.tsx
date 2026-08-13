import { Text } from 'react-native';

import { render, screen, within } from '@/shared/testing/render';

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

describe('l’identité affichée est celle de l’utilisateur', () => {
  it('montre le nom saisi et l’avatar choisi, pas une initiale codée en dur', () => {
    render(
      <ProfileScreen
        name="Sofiane"
        subtitle="Consommateur"
        renderAvatar={() => <Text testID="mon-avatar">avatar</Text>}
      />,
    );

    const header = screen.getByTestId('profile-identity');
    expect(within(header).getByText('Sofiane')).toBeTruthy();
    expect(within(header).getByText('Consommateur')).toBeTruthy();
    expect(within(header).getByTestId('mon-avatar')).toBeTruthy();
  });

  it('n’invente ni nom ni lieu quand rien n’a été saisi', () => {
    // L’écran affichait « Farid · Empalot · Toulouse » pour tout le monde.
    // Sans donnée, on le dit — on ne remplit pas le trou avec quelqu’un d’autre.
    render(<ProfileScreen />);

    const header = screen.getByTestId('profile-identity');
    expect(within(header).getByText('Votre profil')).toBeTruthy();
    expect(within(header).queryByText(/Toulouse|Empalot|Farid/)).toBeNull();
  });
});
