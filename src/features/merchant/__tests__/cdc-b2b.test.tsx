import { fireEvent, render, screen } from '@/shared/testing/render';

import { dueOccurrence, recurrencePeriodMs } from '../lib/recurrence';
import { EMPTY_SUPPLIER, type PublishedOffer } from '../model/schema';
import { useMerchantStore } from '../model/store';
import { MerchantStatsScreen } from '../ui/stats-screen';
import { PublishForm } from '../ui/publish-form';
import { WholesalerOrdersScreen } from '../ui/wholesaler-orders-screen';
import { WholesalerStatsScreen } from '../ui/wholesaler-stats-screen';

jest.mock('expo-image', () => ({ Image: () => null }));

const DAY = 24 * 3600 * 1000;
const T0 = new Date(2026, 9, 1, 9).getTime();

const lot = (over: Partial<PublishedOffer> = {}): PublishedOffer => ({
  id: 'l1',
  title: 'Cagettes',
  category: 'restauration',
  priceCents: 4500,
  oldPriceCents: 6800,
  stock: 10,
  stockLeft: 3,
  durationMinutes: 1440,
  description: '',
  publishedAt: T0,
  startsAt: 0,
  state: 'publiee',
  offline: false,
  audience: 'commercants',
  photoUri: '',
  modes: ['touch-collect', 'livraison'],
  seller: 'Grossiste Occitan',
  minQty: 2,
  recurrence: 'aucune',
  ...over,
});

beforeEach(() =>
  useMerchantStore.setState({
    offers: [],
    wholesaleOrders: [],
    supplier: EMPTY_SUPPLIER,
    used: 0,
    purchased: 0,
  }),
);

describe('offre B2B récurrente — CDC V1.1, Grossiste (EXIGENCE)', () => {
  it('connaît ses rythmes : chaque jour, chaque semaine, chaque mois', () => {
    expect(recurrencePeriodMs('quotidienne')).toBe(DAY);
    expect(recurrencePeriodMs('hebdomadaire')).toBe(7 * DAY);
    expect(recurrencePeriodMs('mensuelle')).toBe(30 * DAY);
    expect(recurrencePeriodMs('aucune')).toBeNull();
  });

  it('ne republie rien avant l’échéance, ni une offre ponctuelle', () => {
    expect(dueOccurrence(T0, 'hebdomadaire', T0 + 6 * DAY)).toBeNull();
    expect(dueOccurrence(T0, 'aucune', T0 + 99 * DAY)).toBeNull();
  });

  it('saute à la DERNIÈRE occurrence échue, sans en créer une par période manquée', () => {
    expect(dueOccurrence(T0, 'hebdomadaire', T0 + 22 * DAY)).toBe(T0 + 21 * DAY);
  });

  it('republie à neuf (stock plein) et garde une seule chaîne vivante', () => {
    useMerchantStore.setState({ offers: [lot({ recurrence: 'hebdomadaire' })] });
    const now = T0 + 7 * DAY + 3600_000;

    expect(useMerchantStore.getState().republishDue(now)).toBe(1);
    const offers = useMerchantStore.getState().offers;
    expect(offers).toHaveLength(2);

    const fresh = offers.find((o) => o.id !== 'l1')!;
    expect(fresh.recurrence).toBe('hebdomadaire');
    expect(fresh.stockLeft).toBe(10);
    expect(fresh.startsAt).toBe(T0 + 7 * DAY);
    // L'ancienne reste dans l'historique, ponctuelle : plus de double republication.
    expect(offers.find((o) => o.id === 'l1')?.recurrence).toBe('aucune');

    // Idempotent : rappeler tout de suite ne republie rien.
    expect(useMerchantStore.getState().republishDue(now)).toBe(0);
    expect(useMerchantStore.getState().offers).toHaveLength(2);
  });

  it('ne republie pas une offre retirée, ni un brouillon', () => {
    useMerchantStore.setState({
      offers: [
        lot({ id: 'a', recurrence: 'quotidienne', offline: true }),
        lot({ id: 'b', recurrence: 'quotidienne', state: 'brouillon' }),
      ],
    });
    expect(useMerchantStore.getState().republishDue(T0 + 5 * DAY)).toBe(0);
  });

  it('une republication B2B ne consomme pas le quota des Flash', () => {
    useMerchantStore.setState({ offers: [lot({ recurrence: 'quotidienne' })], used: 5 });
    useMerchantStore.getState().republishDue(T0 + 2 * DAY);
    expect(useMerchantStore.getState().used).toBe(5);
  });

  it('se choisit à la création d’une offre pro, et pas à celle d’un Flash', () => {
    const onPublish = jest.fn();
    const { unmount } = render(
      <PublishForm wholesale onPublish={onPublish} onCancel={jest.fn()} />,
    );
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Cagettes');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '68');
    fireEvent.changeText(screen.getByTestId('publish-price'), '45');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '60');
    fireEvent.press(screen.getByTestId('publish-recurrence-hebdomadaire'));
    fireEvent.press(screen.getByTestId('publish-submit'));
    expect(onPublish.mock.calls[0]![0]).toMatchObject({ recurrence: 'hebdomadaire' });
    unmount();

    render(<PublishForm onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByTestId('publish-recurrence-hebdomadaire')).toBeNull();
  });
});

describe('ticket de préparation avec QR — CDC V1.1 (VALIDÉ)', () => {
  const order = {
    id: 'w_abc12',
    offerId: 'o1',
    title: 'Cagettes de légumes',
    seller: 'Grossiste Occitan',
    qty: 6,
    unitCents: 4500,
    totalCents: 27000,
    at: 1_700_000_000_000,
    status: 'recue' as const,
    buyer: 'Le Petit Toulousain',
    prep: [] as string[],
  };

  it('le grossiste ouvre le ticket : commerçant acheteur, lignes, partie détachable', () => {
    useMerchantStore.setState({ wholesaleOrders: [order] });
    render(<WholesalerOrdersScreen />);
    expect(screen.queryByTestId('wholesaler-order-w_abc12-ticket')).toBeNull();

    fireEvent.press(screen.getByTestId('wholesaler-order-w_abc12-ticket-toggle'));
    const ticket = screen.getByTestId('wholesaler-order-w_abc12-ticket');
    expect(ticket).toHaveTextContent(/Ticket de préparation/);
    expect(ticket).toHaveTextContent(/Le Petit Toulousain/);
    expect(ticket).toHaveTextContent(/×6/);
    expect(ticket).toHaveTextContent(/Partie détachable/);
    // L'impression n'est pas promise : l'imprimante reste à connecter.
    expect(ticket).toHaveTextContent(/imprimante/);
  });

  it('plus de ticket une fois la commande expédiée', () => {
    useMerchantStore.setState({ wholesaleOrders: [{ ...order, status: 'expediee' }] });
    render(<WholesalerOrdersScreen />);
    expect(screen.queryByTestId('wholesaler-order-w_abc12-ticket-toggle')).toBeNull();
  });
});

describe('statistiques B2B séparées des statistiques B2C — CDC V1.1 (EXIGENCE)', () => {
  const order = (id: string, title: string, qty: number, status: 'recue' | 'livree') => ({
    id,
    offerId: 'o1',
    title,
    seller: '',
    qty,
    unitCents: 1000,
    totalCents: qty * 1000,
    at: 1,
    status,
    buyer: '',
    prep: [] as string[],
  });

  it('le grossiste voit son chiffre B2B, la commission de 5 % et le détail par lot', () => {
    useMerchantStore.setState({
      offers: [lot()],
      wholesaleOrders: [order('a', 'Cagettes', 4, 'livree'), order('b', 'Fromages', 6, 'recue')],
    });
    render(<WholesalerStatsScreen />);

    expect(screen.getByTestId('b2b-stats-orders')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('b2b-stats-delivered')).toHaveTextContent(/^1/);
    expect(screen.getByTestId('b2b-stats-lots')).toHaveTextContent(/^10/);
    expect(screen.getByTestId('b2b-stats-gross')).toHaveTextContent(/100,00/);
    expect(screen.getByTestId('b2b-stats-net')).toHaveTextContent(/95,00/);
    expect(screen.getAllByTestId('b2b-stats-lot')).toHaveLength(2);
  });

  it('le commerçant ne compte PAS les offres pro dans ses statistiques de Flash', () => {
    useMerchantStore.setState({
      offers: [lot({ id: 'b2b' }), lot({ id: 'flash', audience: 'clients' })],
    });
    render(<MerchantStatsScreen honouredTotalsCents={[]} ordersCount={0} />);
    expect(screen.getByTestId('stats-flash-published')).toHaveTextContent(/^1/);
  });
});

describe('republication — jamais une offre déjà terminée', () => {
  it('un créneau dû mais entièrement passé est reprogrammé au créneau suivant, à venir', () => {
    // Offre quotidienne de 2 h ; le téléphone est rouvert 5 h après le créneau du jour 2.
    useMerchantStore.setState({
      offers: [lot({ recurrence: 'quotidienne', durationMinutes: 120 })],
    });
    const now = T0 + DAY + 5 * 3600 * 1000;
    expect(useMerchantStore.getState().republishDue(now)).toBe(1);

    const fresh = useMerchantStore.getState().offers.find((o) => o.id !== 'l1')!;
    // Programmée au créneau suivant (le jour 3), pas née terminée.
    expect(fresh.startsAt).toBe(T0 + 2 * DAY);
    expect(fresh.startsAt).toBeGreaterThan(now);
  });
});
