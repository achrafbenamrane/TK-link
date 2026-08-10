import { Text } from 'react-native';

import { fireEvent, render, screen, within } from '@/shared/testing/render';

import { useGameStore } from '../model/store';
import { HubScreen } from '../ui/hub-screen';

beforeEach(() => {
  useGameStore.getState().resetDemo();
});

describe('<HubScreen /> — l’onglet La Chasse', () => {
  it('réunit le déstockage, les jeux et les offres dans le même écran', () => {
    render(
      <HubScreen
        renderLiquidation={() => <Text testID="slot-liquidation">déstockage</Text>}
        renderGames={() => <Text testID="slot-games">jeux</Text>}
        renderOffers={() => <Text testID="slot-offers">offres</Text>}
      />,
    );

    expect(screen.getByTestId('hub-screen')).toBeTruthy();
    expect(screen.getByTestId('slot-liquidation')).toBeTruthy();
    expect(screen.getByTestId('slot-games')).toBeTruthy();
    expect(screen.getByTestId('slot-offers')).toBeTruthy();
    // La progression, elle, vient de la feature : elle n’a pas de slot.
    expect(screen.getByTestId('hub-chest')).toBeTruthy();
    expect(screen.getByTestId('hub-badges')).toBeTruthy();
    expect(screen.getByTestId('hub-leaderboard')).toBeTruthy();
  });

  it('affiche le butin : XP, points et coupons', () => {
    render(<HubScreen points={240} couponsCount={3} />);

    expect(within(screen.getByTestId('hub-loot-points')).getByText('240')).toBeTruthy();
    expect(within(screen.getByTestId('hub-loot-coupons')).getByText('3')).toBeTruthy();
  });

  it('annonce les offres en dernière chance quand il y en a', () => {
    render(<HubScreen criticalCount={4} />);
    expect(within(screen.getByTestId('hub-critical')).getByText(/4 offres/)).toBeTruthy();
  });

  it('ne montre aucune bannière d’urgence quand rien n’expire', () => {
    render(<HubScreen criticalCount={0} />);
    expect(screen.queryByTestId('hub-critical')).toBeNull();
  });

  it('ouvre le coffre : XP crédité, récompense remontée à la route, bouton retiré', () => {
    const onChestOpened = jest.fn();
    render(<HubScreen onChestOpened={onChestOpened} />);

    fireEvent.press(screen.getByTestId('hub-chest-open'));

    expect(onChestOpened).toHaveBeenCalledTimes(1);
    const reward = onChestOpened.mock.calls[0]![0];
    expect(useGameStore.getState().xp).toBe(reward.xp);
    expect(screen.queryByTestId('hub-chest-open')).toBeNull();
  });

  it('ne rouvre pas le coffre déjà ouvert aujourd’hui', () => {
    useGameStore.getState().openChest();
    const onChestOpened = jest.fn();
    render(<HubScreen onChestOpened={onChestOpened} />);

    expect(screen.queryByTestId('hub-chest-open')).toBeNull();
    expect(onChestOpened).not.toHaveBeenCalled();
  });
});
