import { deliveryCode } from '@/shared/lib/handover';
import { fireEvent, render, screen } from '@/shared/testing/render';

import { routeIssue } from '../lib/issues';
import { canRate, clampStars } from '../lib/rating';
import type { Order } from '../model/schema';
import { OrderSchema } from '../model/schema';
import { useShopStore } from '../model/store';
import { OrderDetailScreen } from '../ui/order-detail-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({ id: 'o1' }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1',
  createdAt: Date.now(),
  addressId: null,
  items: [{ dealId: 'd_cote', title: 'Côte', emoji: '🥩', qty: 1, price: 24.9 }],
  total: 24.9,
  discount: 0,
  deliveryFee: 0,
  fulfilment: 'touch-collect',
  status: 'preparation',
  pointsEarned: 24,
  managed: true,
  rating: null,
  issue: null,
  ...over,
});

describe('routeIssue — CDC V1.1 « Signaler un problème »', () => {
  it('« je n’ai rien reçu » avant la remise : remboursement automatique', () => {
    expect(routeIssue('non_recue', 'preparation', 'touch-collect')).toEqual({
      route: 'remboursement',
      status: 'remboursement_en_cours',
    });
  });

  it('« je n’ai rien reçu » APRÈS la remise : un humain vérifie, pas de remboursement en un clic', () => {
    const d = routeIssue('non_recue', 'livree', 'livraison');
    expect(d.route).toBe('admin');
    expect(d.status).toBe('litige');
  });

  it('produit non conforme ou autre : file Super Admin', () => {
    expect(routeIssue('non_conforme', 'recuperee', 'touch-collect').route).toBe('admin');
    expect(routeIssue('autre', 'payee', 'livraison').route).toBe('admin');
  });

  it('garde le statut quand la machine à états ne permet pas le litige', () => {
    // Une commande déjà close n'a plus de transition : le signalement s'y attache.
    expect(routeIssue('autre', 'annulee', 'livraison').status).toBeNull();
  });
});

describe('notation — CDC V1.1', () => {
  it('seule une commande terminée se note', () => {
    expect(canRate('recuperee')).toBe(true);
    expect(canRate('livree')).toBe(true);
    expect(canRate('preparation')).toBe(false);
    expect(canRate('annulee')).toBe(false);
  });

  it('borne les étoiles entre 1 et 5', () => {
    expect(clampStars(0)).toBe(1);
    expect(clampStars(9)).toBe(5);
    expect(clampStars(3.4)).toBe(3);
  });

  it('relit une commande enregistrée avant la note et le signalement, sans la perdre', () => {
    const legacy = {
      id: 'x',
      createdAt: 1,
      items: [],
      total: 0,
      deliveryFee: 0,
      status: 'livree',
      pointsEarned: 0,
    };
    const parsed = OrderSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rating).toBeNull();
      expect(parsed.data.issue).toBeNull();
    }
  });
});

describe('store — signaler et noter', () => {
  it('le signalement envoie la commande en remboursement et se fait une seule fois', () => {
    useShopStore.setState({ orders: [order()] });
    const res = useShopStore.getState().reportIssue('o1', 'non_recue');
    expect(res).toEqual({ ok: true, route: 'remboursement' });
    expect(useShopStore.getState().orders[0]?.status).toBe('remboursement_en_cours');
    expect(useShopStore.getState().reportIssue('o1', 'autre')).toEqual({
      ok: false,
      reason: 'deja_signale',
    });
  });

  it('refuse de noter une commande non terminée, puis une seconde fois', () => {
    useShopStore.setState({ orders: [order({ status: 'preparation' })] });
    expect(useShopStore.getState().rateOrder('o1', 5, [])).toEqual({
      ok: false,
      reason: 'non_terminee',
    });

    useShopStore.setState({ orders: [order({ status: 'recuperee' })] });
    expect(useShopStore.getState().rateOrder('o1', 4, ['Rapide'])).toEqual({ ok: true });
    expect(useShopStore.getState().orders[0]?.rating).toMatchObject({ stars: 4, tags: ['Rapide'] });
    expect(useShopStore.getState().rateOrder('o1', 1, [])).toEqual({
      ok: false,
      reason: 'deja_notee',
    });
  });
});

describe('<OrderDetailScreen /> — retours client', () => {
  it('signale un problème depuis l’unique point d’entrée', () => {
    useShopStore.setState({ orders: [order()] });
    render(<OrderDetailScreen />);

    // Le bouton est unique, et le choix du motif ne part qu'une fois confirmé.
    fireEvent.press(screen.getByTestId('order-report-open'));
    expect(screen.getByTestId('report-submit').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('report-kind-non_recue'));
    fireEvent.press(screen.getByTestId('report-submit'));

    expect(screen.getByTestId('order-issue-done')).toHaveTextContent(/Remboursement en cours/);
    expect(screen.queryByTestId('order-report-open')).toBeNull();
  });

  it('propose la note après la remise, avec étoiles et tags — sans champ texte', () => {
    useShopStore.setState({ orders: [order({ status: 'recuperee' })] });
    render(<OrderDetailScreen />);

    expect(screen.getByTestId('order-rating')).toBeTruthy();
    fireEvent.press(screen.getByTestId('rating-star-4'));
    fireEvent.press(screen.getByTestId('rating-tag-Rapide'));
    fireEvent.press(screen.getByTestId('rating-submit'));

    expect(screen.getByTestId('order-rating-done')).toHaveTextContent(/4\/5/);
  });

  it('ne propose pas de note tant que la commande n’est pas terminée', () => {
    useShopStore.setState({ orders: [order({ status: 'preparation' })] });
    render(<OrderDetailScreen />);
    expect(screen.queryByTestId('order-rating')).toBeNull();
  });
});

describe('<OrderDetailScreen /> — le code de remise du client', () => {
  it('une livraison en route montre au client le code à six chiffres à donner au livreur', () => {
    useShopStore.setState({ orders: [order({ fulfilment: 'livraison', status: 'en_livraison' })] });
    render(<OrderDetailScreen />);
    expect(screen.getByTestId('order-delivery-code-value')).toHaveTextContent(
      new RegExp(`^${deliveryCode('o1')}$`),
    );
  });

  it('pas de code pour un Touch & Collect, ni avant que la commande soit prête', () => {
    useShopStore.setState({ orders: [order({ fulfilment: 'touch-collect', status: 'prete' })] });
    const { unmount } = render(<OrderDetailScreen />);
    expect(screen.queryByTestId('order-delivery-code')).toBeNull();
    unmount();

    useShopStore.setState({ orders: [order({ fulfilment: 'livraison', status: 'preparation' })] });
    render(<OrderDetailScreen />);
    expect(screen.queryByTestId('order-delivery-code')).toBeNull();
  });
});
