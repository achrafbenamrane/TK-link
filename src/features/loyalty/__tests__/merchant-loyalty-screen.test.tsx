import { fireEvent, render, screen } from '@/shared/testing/render';

import { useMerchantLoyaltyStore } from '../model/merchant-store';
import { MerchantLoyaltyScreen } from '../ui/merchant-loyalty-screen';

const MID = 'm_napoli';

beforeEach(() => {
  useMerchantLoyaltyStore.getState().resetDemo();
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
    expect(screen.getByTestId('loyalty-balance')).toHaveTextContent(/113/);
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

  it('montre l’historique des points sur la même page', () => {
    mount();
    // L'historique est sur la même page que les récompenses, comme la maquette.
    expect(screen.getAllByText('Commande').length).toBeGreaterThan(0);
  });

  it('ne propose aucun transfert de points bruts (CDC V1.1)', () => {
    mount();
    expect(screen.queryByTestId('share-open')).toBeNull();
    expect(screen.queryByText(/Partager mes points/)).toBeNull();
  });

  it('suit le programme de CE commerçant : ses paliers et son unité', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, {
      unit: 'achats',
      tiers: [{ rank: 1, cost: 5, reward: 'Un café offert' }],
    });
    mount();
    expect(screen.getByText('Un café offert')).toBeTruthy();
    expect(screen.getByTestId('loyalty-rule')).toHaveTextContent(/1 achat = 1 point/);
    // Les paliers par défaut ne s'affichent plus chez lui.
    expect(screen.queryByText('2 miso soupes')).toBeNull();
  });

  it('tient pour une enseigne sans carte', () => {
    render(
      <MerchantLoyaltyScreen merchantId="inconnu" merchantName="Nouveau" onBack={jest.fn()} />,
    );
    expect(screen.getByTestId('merchant-loyalty-screen')).toBeTruthy();
    expect(screen.getByTestId('loyalty-history-empty')).toBeTruthy();
  });
});
