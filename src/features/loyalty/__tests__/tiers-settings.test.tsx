import { fireEvent, render, screen } from '@/shared/testing/render';

import { DEFAULT_TIERS, selectTiers, useMerchantLoyaltyStore } from '../model/merchant-store';
import { TiersSettingsScreen } from '../ui/tiers-settings-screen';

/**
 * CDC §8.3 — « quatre paliers configurables par le commerçant ».
 *
 * Ils étaient écrits en dur et partagés par toutes les enseignes : un boulanger
 * offrait « 4 californias saumon-cheese ». Un barème qui ne ressemble pas à ce
 * que le commerce vend ne fidélise personne.
 */
describe('paliers de fidélité — CDC §8.3', () => {
  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ tiers: DEFAULT_TIERS });
  });

  it('enregistre un barème propre au commerçant', () => {
    render(<TiersSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '10');
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    const tiers = selectTiers(useMerchantLoyaltyStore.getState());
    expect(tiers[0]).toMatchObject({ rank: 1, cost: 10, reward: 'Un croissant offert' });
  });

  it('refuse un palier qui ne coûte pas plus cher que le précédent', () => {
    render(<TiersSettingsScreen />);

    // Palier 2 moins cher que le palier 1 : personne ne s'arrêterait au premier.
    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '100');
    fireEvent.changeText(screen.getByTestId('tier-cost-2'), '50');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(screen.getByTestId('tier-error-2')).toBeTruthy();
    // Et rien n'est enregistré : un barème à moitié valide n'existe pas.
    expect(selectTiers(useMerchantLoyaltyStore.getState())).toEqual(DEFAULT_TIERS);
  });

  it('refuse un avantage sans libellé', () => {
    render(<TiersSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('tier-reward-1'), '   ');
    fireEvent.press(screen.getByTestId('tiers-save'));

    // Une case blanche sur la carte du client ne lui dit pas ce qu'il a gagné.
    expect(screen.getByTestId('tier-error-1')).toBeTruthy();
  });

  it('renumérote les rangs dans l’ordre', () => {
    useMerchantLoyaltyStore.getState().setTiers([
      { rank: 9, cost: 5, reward: 'A' },
      { rank: 3, cost: 10, reward: 'B' },
    ]);
    expect(selectTiers(useMerchantLoyaltyStore.getState()).map((t) => t.rank)).toEqual([1, 2]);
  });
});
