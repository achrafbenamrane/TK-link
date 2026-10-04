import { Text } from 'react-native';

import { fireEvent, render, screen, within } from '@/shared/testing/render';

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
  it('rend sans planter', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-screen')).toBeOnTheScreen();
  });

  it('ne propose ni solde global, ni bon d’achat, ni partage de points (CDC V1.1)', () => {
    render(<ProfileScreen />);
    expect(screen.queryByTestId('claim-reward')).toBeNull();
    expect(screen.queryByTestId('share-points')).toBeNull();
    expect(screen.queryByText(/Fidélité TK LINK/)).toBeNull();
  });
});

describe('se déconnecter', () => {
  it('appelle l’action de la route, qui remet l’app à zéro et rouvre le logo', () => {
    const onSignOut = jest.fn();
    render(<ProfileScreen onSignOut={onSignOut} />);
    fireEvent.press(screen.getByTestId('profile-signout'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
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
