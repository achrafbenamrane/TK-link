import { Share } from 'react-native';

import { fireEvent, render, screen } from '@/shared/testing/render';

import { useMerchantLoyaltyStore } from '../model/merchant-store';
import { MerchantLoyaltyScreen } from '../ui/merchant-loyalty-screen';

const MID = 'm_napoli';

beforeEach(() => {
  useMerchantLoyaltyStore.getState().resetDemo();
  // La feuille de partage est native : on l'espionne plutôt que de l'ouvrir.
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mount() {
  return render(
    <MerchantLoyaltyScreen merchantId={MID} merchantName="Pizzeria Napoli" onBack={jest.fn()} />,
  );
}

describe('<MerchantLoyaltyScreen />', () => {
  it('monte et reproduit le cas de la maquette : 113 points, 2 paliers ouverts', () => {
    mount();
    expect(screen.getByTestId('merchant-loyalty-screen')).toBeTruthy();
    expect(screen.getByText('113')).toBeTruthy();
    // Les deux premiers sont réclamables, les deux suivants verrouillés.
    expect(screen.getByTestId('tier-claim-1')).toBeTruthy();
    expect(screen.getByTestId('tier-claim-2')).toBeTruthy();
    expect(screen.queryByTestId('tier-claim-3')).toBeNull();
    expect(screen.queryByTestId('tier-claim-4')).toBeNull();
  });

  it('réclame un palier atteint', () => {
    mount();
    fireEvent.press(screen.getByTestId('tier-claim-1'));
    expect(useMerchantLoyaltyStore.getState().cards[MID]?.claimed).toContain(1);
    // Une fois pris, le bouton disparaît.
    expect(screen.queryByTestId('tier-claim-1')).toBeNull();
  });

  it('bascule sur l’historique', () => {
    mount();
    fireEvent.press(screen.getByTestId('loyalty-tab-historique'));
    expect(screen.getAllByText('Commande').length).toBeGreaterThan(0);
  });

  it('partage des points : le solde est débité et un code apparaît', () => {
    mount();
    fireEvent.press(screen.getByTestId('share-open'));
    fireEvent.press(screen.getByTestId('share-amount-20'));
    fireEvent.press(screen.getByTestId('share-confirm'));

    expect(useMerchantLoyaltyStore.getState().cards[MID]?.points).toBe(93);
    expect(screen.getByTestId('share-code')).toBeTruthy();
  });

  it('tient pour une enseigne sans carte', () => {
    render(
      <MerchantLoyaltyScreen merchantId="inconnu" merchantName="Nouveau" onBack={jest.fn()} />,
    );
    expect(screen.getByTestId('merchant-loyalty-screen')).toBeTruthy();
    expect(screen.getByTestId('loyalty-tab-historique')).toBeTruthy();
  });
});
