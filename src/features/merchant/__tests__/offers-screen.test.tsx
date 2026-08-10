import { fireEvent, render, screen, within } from '@/shared/testing/render';

import { FREE_OPERATIONS } from '../lib/billing';
import { useMerchantStore } from '../model/store';
import { MerchantOffersScreen } from '../ui/offers-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const draft = {
  title: 'Invendus du soir',
  category: 'restauration' as const,
  priceCents: 500,
  oldPriceCents: 1200,
  stock: 4,
  durationMinutes: 30,
  description: '',
  audience: 'clients' as const,
};

beforeEach(() => useMerchantStore.getState().resetDemo());

describe('<MerchantOffersScreen />', () => {
  it('annonce le quota restant et l’état vide', () => {
    render(<MerchantOffersScreen />);

    expect(screen.getByTestId('merchant-empty')).toBeTruthy();
    expect(
      within(screen.getByTestId('merchant-quota')).getByText(`${FREE_OPERATIONS}`),
    ).toBeTruthy();
  });

  it('publie une offre depuis le formulaire et la liste ensuite', () => {
    render(<MerchantOffersScreen />);

    fireEvent.press(screen.getByTestId('merchant-new-offer'));
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Plateau de viennoiseries');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '18,00');
    fireEvent.changeText(screen.getByTestId('publish-price'), '9,00');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '6');
    fireEvent.press(screen.getByTestId('publish-submit'));

    const offers = useMerchantStore.getState().offers;
    expect(offers).toHaveLength(1);
    expect(offers[0]!.priceCents).toBe(900);
    expect(offers[0]!.oldPriceCents).toBe(1800);
    expect(screen.getByTestId(`merchant-offer-${offers[0]!.id}`)).toBeTruthy();
  });

  it('refuse un prix flash au-dessus du prix initial, sans rien publier', () => {
    render(<MerchantOffersScreen />);

    fireEvent.press(screen.getByTestId('merchant-new-offer'));
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Erreur de saisie');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '9,00');
    fireEvent.changeText(screen.getByTestId('publish-price'), '18,00');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '2');
    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(useMerchantStore.getState().offers).toHaveLength(0);
    expect(screen.getByTestId('publish-submit')).toBeTruthy(); // on reste sur le formulaire
  });

  it('verrouille la publication quand le quota est épuisé, et propose les packs', () => {
    for (let i = 0; i < FREE_OPERATIONS; i++) useMerchantStore.getState().publish(draft, '');
    render(<MerchantOffersScreen />);

    fireEvent.press(screen.getByTestId('merchant-new-offer'));

    // Le bouton est désactivé : on ne doit pas atteindre le formulaire.
    expect(screen.queryByTestId('publish-submit')).toBeNull();
    expect(screen.getByTestId('merchant-packs')).toBeTruthy();
  });

  it('retire une offre de l’app', () => {
    const r = useMerchantStore.getState().publish(draft, '');
    const id = r.ok ? r.offer.id : '';
    render(<MerchantOffersScreen />);

    fireEvent.press(screen.getByTestId(`merchant-offline-${id}`));

    expect(useMerchantStore.getState().offers[0]!.offline).toBe(true);
  });
});
