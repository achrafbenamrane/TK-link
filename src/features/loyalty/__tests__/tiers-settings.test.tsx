import { fireEvent, render, screen } from '@/shared/testing/render';

import {
  DEFAULT_TIERS,
  programOf,
  selectPrograms,
  useMerchantLoyaltyStore,
} from '../model/merchant-store';
import { TiersSettingsScreen } from '../ui/tiers-settings-screen';

const MID = 'm_boulanger';

const programNow = (id: string = MID) =>
  programOf(selectPrograms(useMerchantLoyaltyStore.getState()), id);

/**
 * CDC §8.3 et V1.1 — « jusqu'à 4 paliers » propres à CHAQUE commerçant, et une
 * unité de calcul (achats ou euros) choisie à la création, figée une fois en
 * ligne.
 *
 * Les paliers étaient une liste partagée par toutes les enseignes : un
 * boulanger offrait « 4 californias saumon-cheese ». Un barème qui ne ressemble
 * pas à ce que le commerce vend ne fidélise personne.
 */
describe('paliers de fidélité — CDC §8.3', () => {
  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ programs: {} });
  });

  it('enregistre un barème propre au commerçant', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '10');
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(programNow().tiers[0]).toMatchObject({
      rank: 1,
      cost: 10,
      reward: 'Un croissant offert',
    });
  });

  it('ne touche pas au barème des autres commerçants', () => {
    render(<TiersSettingsScreen merchantId={MID} />);
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(programNow('m_napoli').tiers).toEqual(DEFAULT_TIERS);
  });

  it('refuse un palier qui ne coûte pas plus cher que le précédent', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    // Palier 2 moins cher que le palier 1 : personne ne s'arrêterait au premier.
    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '100');
    fireEvent.changeText(screen.getByTestId('tier-cost-2'), '50');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(screen.getByTestId('tier-error-2')).toBeTruthy();
    // Et rien n'est enregistré : un barème à moitié valide n'existe pas.
    expect(selectPrograms(useMerchantLoyaltyStore.getState())[MID]).toBeUndefined();
  });

  it('refuse un avantage sans libellé', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    fireEvent.changeText(screen.getByTestId('tier-reward-1'), '   ');
    fireEvent.press(screen.getByTestId('tiers-save'));

    // Une case blanche sur la carte du client ne lui dit pas ce qu'il a gagné.
    expect(screen.getByTestId('tier-error-1')).toBeTruthy();
  });

  it('renumérote les rangs dans l’ordre et plafonne à quatre paliers', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, {
      unit: 'euros',
      tiers: [1, 2, 3, 4, 5].map((n) => ({ rank: 9, cost: n * 10, reward: `R${n}` })),
    });
    expect(programNow().tiers.map((t) => t.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('unité de calcul — CDC V1.1', () => {
  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ programs: {} });
  });

  it('se choisit à la création…', () => {
    render(<TiersSettingsScreen merchantId={MID} />);
    fireEvent.press(screen.getByTestId('program-unit-achats'));
    fireEvent.press(screen.getByTestId('tiers-save'));
    expect(programNow().unit).toBe('achats');
  });

  it('…puis ne change plus une fois le programme en ligne', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, { unit: 'achats', tiers: DEFAULT_TIERS });

    // Même en passant une autre unité, le programme en ligne garde la sienne.
    useMerchantLoyaltyStore.getState().saveProgram(MID, { unit: 'euros', tiers: DEFAULT_TIERS });
    expect(programNow().unit).toBe('achats');

    render(<TiersSettingsScreen merchantId={MID} />);
    expect(screen.getByTestId('program-unit-note')).toHaveTextContent(/ne peut plus être modifiée/);
  });
});
