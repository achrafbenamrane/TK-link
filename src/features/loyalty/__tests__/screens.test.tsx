import { fireEvent, render, screen } from '@/shared/testing/render';

import { balanceOf } from '../lib/loyalty';
import { GIFTS, seedCard, seedEntries, seedOffers } from '../model/seed';
import { useLoyaltyStore } from '../model/store';
import { LoyaltyCardScreen } from '../ui/card-screen';
import { GiftsScreen } from '../ui/gifts-screen';
import { OffersScreen } from '../ui/offers-screen';

/**
 * Filet anti-plantage des écrans de fidélité. Le piège Zustand v5 (sélecteur
 * qui filtre → boucle infinie) ne se voit qu'en montant réellement l'écran.
 */
beforeEach(() => {
  useLoyaltyStore.setState({
    card: seedCard(),
    entries: seedEntries(),
    claimedGiftIds: [],
    gifts: GIFTS,
    offers: seedOffers(),
  });
});

describe('<LoyaltyCardScreen />', () => {
  it('monte et affiche le solde', () => {
    render(<LoyaltyCardScreen onOpenGifts={jest.fn()} />);
    expect(screen.getByTestId('loyalty-card-screen')).toBeTruthy();
    const balance = balanceOf(seedEntries());
    expect(screen.getByText(String(balance))).toBeTruthy();
  });

  it('ouvre les cadeaux', () => {
    const onOpen = jest.fn();
    render(<LoyaltyCardScreen onOpenGifts={onOpen} />);
    fireEvent.press(screen.getByTestId('loyalty-open-gifts'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('tient sans carte activée', () => {
    useLoyaltyStore.setState({ card: null });
    render(<LoyaltyCardScreen onOpenGifts={jest.fn()} />);
    expect(screen.getByTestId('loyalty-card-screen')).toBeTruthy();
  });
});

describe('<GiftsScreen />', () => {
  it('échange un cadeau accessible et débite les points', () => {
    render(<GiftsScreen onBack={jest.fn()} />);
    const before = balanceOf(useLoyaltyStore.getState().entries);

    // « Café offert » coûte 150 points — accessible avec le solde de démo.
    fireEvent.press(screen.getByTestId('gift-claim-g_cafe'));

    const after = balanceOf(useLoyaltyStore.getState().entries);
    expect(after).toBe(before - 150);
    expect(useLoyaltyStore.getState().claimedGiftIds).toContain('g_cafe');
  });

  it('n’offre pas d’échange sur un cadeau hors budget', () => {
    render(<GiftsScreen onBack={jest.fn()} />);
    // 1800 points : hors de portée du solde de démo.
    expect(screen.getByTestId('gift-g_bon20')).toBeTruthy();
    expect(screen.queryByTestId('gift-claim-g_bon20')).toBeNull();
  });

  it('masque les cadeaux réservés aux pros pour un particulier', () => {
    render(<GiftsScreen onBack={jest.fn()} />);
    expect(screen.queryByTestId('gift-g_compta')).toBeNull();

    useLoyaltyStore.setState({ card: { ...seedCard(), holderType: 'pro' } });
    render(<GiftsScreen onBack={jest.fn()} />);
    expect(screen.getAllByTestId('gift-g_compta').length).toBeGreaterThan(0);
  });
});

describe('<OffersScreen />', () => {
  it('montre les offres flash par défaut et bascule sur tout le catalogue', () => {
    render(<OffersScreen />);
    expect(screen.getByTestId('offers-screen')).toBeTruthy();
    // o1 est flash, o3 ne l'est pas.
    expect(screen.getByTestId('offer-o1')).toBeTruthy();
    expect(screen.queryByTestId('offer-o3')).toBeNull();

    fireEvent.press(screen.getByTestId('offers-filter-all'));
    expect(screen.getByTestId('offer-o3')).toBeTruthy();
  });

  it('écarte une offre expirée', () => {
    useLoyaltyStore.setState({
      offers: [
        {
          id: 'old',
          merchant: 'M',
          title: 'T',
          claim: '-10 %',
          category: '',
          flash: true,
          endsAt: Date.now() - 1000,
        },
      ],
    });
    render(<OffersScreen />);
    expect(screen.getByTestId('offers-empty')).toBeTruthy();
  });
});
