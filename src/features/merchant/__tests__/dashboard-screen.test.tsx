import { fireEvent, render, screen } from '@/shared/testing/render';

import { EMPTY_SUPPLIER } from '../model/schema';
import { useMerchantStore } from '../model/store';
import { MerchantDashboardScreen, type DashboardOrder } from '../ui/dashboard-screen';

jest.mock('expo-image', () => ({ Image: () => null }));

const order = (over: Partial<DashboardOrder> = {}): DashboardOrder => ({
  id: 'o1',
  ref: '#TKL-1028',
  title: 'Plateau de viennoiseries',
  modeLabel: 'Touch & Collect',
  statusLabel: 'Payée',
  tone: 'todo',
  totalCents: 900,
  createdAt: Date.now(),
  ...over,
});

const mount = (over: Partial<Parameters<typeof MerchantDashboardScreen>[0]> = {}) =>
  render(
    <MerchantDashboardScreen
      shopName="Le Petit Toulousain"
      area="Carmes"
      orders={[order()]}
      tiersCount={2}
      onOpen={jest.fn()}
      {...over}
    />,
  );

beforeEach(() => useMerchantStore.setState({ offers: [], used: 0, supplier: EMPTY_SUPPLIER }));

describe('<MerchantDashboardScreen /> — la maquette du commerçant', () => {
  it('montre le commerce, son quartier et les commandes à préparer sur la cloche', () => {
    mount();
    expect(screen.getByTestId('merchant-dashboard')).toHaveTextContent(/Le Petit Toulousain/);
    expect(screen.getByTestId('merchant-dashboard')).toHaveTextContent(/Carmes/);
    expect(screen.getByTestId('dashboard-bell')).toHaveProp(
      'accessibilityLabel',
      '1 commande à préparer',
    );
  });

  it('ouvre les commandes depuis la cloche et les réglages depuis la roue', () => {
    const onOpen = jest.fn();
    mount({ onOpen });
    fireEvent.press(screen.getByTestId('dashboard-bell'));
    expect(onOpen).toHaveBeenLastCalledWith('orders');
    fireEvent.press(screen.getByTestId('dashboard-settings'));
    expect(onOpen).toHaveBeenLastCalledWith('account');
  });

  it('dossier pro non validé : un bandeau, et « Créer un Flash » mène au dossier', () => {
    const onOpen = jest.fn();
    mount({ onOpen });
    expect(screen.getByTestId('pro-setup-banner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('dashboard-create-flash'));
    expect(onOpen).toHaveBeenCalledWith('setup');
  });

  it('dossier validé : pas de bandeau, et « Créer un Flash » ouvre la création', () => {
    useMerchantStore.setState({ supplier: { ...EMPTY_SUPPLIER, status: 'valide' } });
    const onOpen = jest.fn();
    mount({ onOpen });
    expect(screen.queryByTestId('pro-setup-banner')).toBeNull();
    fireEvent.press(screen.getByTestId('dashboard-create-flash'));
    expect(onOpen).toHaveBeenCalledWith('flash');
  });

  it('sans commande à préparer, la cloche le dit', () => {
    mount({ orders: [order({ tone: 'done' })] });
    expect(screen.getByTestId('dashboard-bell')).toHaveProp('accessibilityLabel', 'Commandes');
  });
});
