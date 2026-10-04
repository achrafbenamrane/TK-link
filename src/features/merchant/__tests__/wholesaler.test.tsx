import { fireEvent, render, screen } from '@/shared/testing/render';

import {
  nextWholesaleStatus,
  WHOLESALE_ACTION_LABEL,
  WHOLESALE_STATUS_LABEL,
  WHOLESALE_STATUSES,
} from '../lib/wholesale-orders';
import { WholesaleOrderSchema } from '../model/schema';
import { useMerchantStore } from '../model/store';
import { PublishForm } from '../ui/publish-form';
import { WholesalerDashboardScreen } from '../ui/wholesaler-dashboard-screen';
import { WholesalerOrdersScreen } from '../ui/wholesaler-orders-screen';

jest.mock('expo-image', () => ({ Image: () => null }));

const order = (id: string, status: 'recue' | 'preparation' | 'terminee' = 'recue') => ({
  id,
  offerId: 'o1',
  title: 'Cagettes de légumes',
  seller: 'Grossiste Occitan',
  qty: 6,
  unitCents: 4500,
  totalCents: 27000,
  at: 1_700_000_000_000,
  status,
  buyer: 'Le Petit Toulousain',
});

beforeEach(() => useMerchantStore.setState({ wholesaleOrders: [], offers: [] }));

describe('cycle d’une commande grossiste — schéma du client, CDC V1.1', () => {
  it('suit les statuts du schéma, sans étape « Acceptée » (le paiement vaut acceptation)', () => {
    expect([...WHOLESALE_STATUSES]).toEqual([
      'recue',
      'preparation',
      'expediee',
      'livree',
      'terminee',
    ]);
    expect(Object.values(WHOLESALE_STATUS_LABEL)).not.toContain('Acceptée');
    expect(Object.values(WHOLESALE_ACTION_LABEL)).not.toContain('Accepter');
  });

  it('avance d’un cran à la fois, et s’arrête à « Terminée »', () => {
    expect(nextWholesaleStatus('recue')).toBe('preparation');
    expect(nextWholesaleStatus('livree')).toBe('terminee');
    expect(nextWholesaleStatus('terminee')).toBeNull();
  });

  it('relit une commande enregistrée avant le suivi, comme « reçue »', () => {
    const legacy = WholesaleOrderSchema.parse({
      id: 'x',
      offerId: 'o',
      title: 'Lot',
      qty: 1,
      unitCents: 100,
      totalCents: 100,
      at: 1,
    });
    expect(legacy.status).toBe('recue');
  });
});

describe('<WholesalerOrdersScreen />', () => {
  it('liste les commandes des commerçants et les fait avancer', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_abc12')] });
    render(<WholesalerOrdersScreen />);

    const card = screen.getByTestId('wholesaler-order-w_abc12');
    expect(card).toHaveTextContent(/Le Petit Toulousain/);
    expect(card).toHaveTextContent(/COMMANDE REÇUE/);

    fireEvent.press(screen.getByTestId('wholesaler-order-w_abc12-advance'));
    expect(useMerchantStore.getState().wholesaleOrders[0]?.status).toBe('preparation');
    expect(screen.getByTestId('wholesaler-order-w_abc12')).toHaveTextContent(/EN PRÉPARATION/);
  });

  it('range les commandes terminées dans leur onglet, sans bouton d’action', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_done1', 'terminee')] });
    render(<WholesalerOrdersScreen />);
    expect(screen.getByTestId('wholesaler-orders-empty')).toBeTruthy();

    fireEvent.press(screen.getByTestId('wholesaler-filter-done'));
    expect(screen.getByTestId('wholesaler-order-w_done1')).toBeTruthy();
    expect(screen.queryByTestId('wholesaler-order-w_done1-advance')).toBeNull();
  });
});

describe('<WholesalerDashboardScreen />', () => {
  it('montre ses propres chiffres : offres B2B, commandes de commerçants, chiffre d’affaires', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_1'), order('w_2', 'preparation')] });
    render(<WholesalerDashboardScreen companyName="Grossiste Occitan" onOpen={jest.fn()} />);
    expect(screen.getByTestId('wholesaler-dashboard')).toBeTruthy();
    expect(screen.getByText('Nouvelle offre pro')).toBeTruthy();
    expect(screen.getByTestId('wholesaler-recent-w_1')).toBeTruthy();
    // Aucun vocabulaire de client : pas de « Flash » ni de fidélité.
    expect(screen.queryByText('Fidélité')).toBeNull();
  });

  it('ouvre la création d’une offre pro', () => {
    const onOpen = jest.fn();
    render(<WholesalerDashboardScreen companyName="Grossiste Occitan" onOpen={onOpen} />);
    fireEvent.press(screen.getByTestId('wholesaler-create-offer'));
    expect(onOpen).toHaveBeenCalledWith('new');
  });
});

describe('<PublishForm wholesale />', () => {
  it('parle en prix grossiste, demande une quantité minimale et propose des durées longues', () => {
    render(<PublishForm wholesale onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Prix grossiste')).toBeTruthy();
    expect(screen.getByTestId('publish-min-qty')).toBeTruthy();
    expect(screen.getByTestId('publish-duration-1440')).toBeTruthy();
    expect(screen.queryByTestId('publish-duration-15')).toBeNull();
  });

  it('publie une offre B2B avec son minimum, sans refuser une durée de plusieurs jours', () => {
    const onPublish = jest.fn();
    render(<PublishForm wholesale onPublish={onPublish} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Cagettes de légumes');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '68');
    fireEvent.changeText(screen.getByTestId('publish-price'), '45');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '60');
    fireEvent.changeText(screen.getByTestId('publish-min-qty'), '5');
    fireEvent.press(screen.getByTestId('publish-duration-4320'));
    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0]![0]).toMatchObject({
      minQty: 5,
      durationMinutes: 4320,
      audience: 'commercants',
    });
  });
});
