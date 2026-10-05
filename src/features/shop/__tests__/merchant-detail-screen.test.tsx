import { fireEvent, render, screen } from '@/shared/testing/render';

import { demoShowcase, videoSource } from '../lib/showcase';
import { DEALS } from '../model/catalog';
import { useShopStore } from '../model/store';
import { MerchantDetailScreen } from '../ui/merchant-detail-screen';

/** Une enseigne qui a au moins une offre dans le catalogue. */
const MID = DEALS[0]!.merchantId;
const HERO = DEALS.find((d) => d.merchantId === MID)!;

function mount(over: Partial<Parameters<typeof MerchantDetailScreen>[0]> = {}) {
  return render(
    <MerchantDetailScreen
      merchantId={MID}
      loyalty={{ points: 85, remaining: 165, progress: 0.4 }}
      onOpenLoyalty={jest.fn()}
      onOpenDeal={jest.fn()}
      onBack={jest.fn()}
      {...over}
    />,
  );
}

beforeEach(() => {
  useShopStore.setState({ favorites: [], cart: [] });
});

describe('<MerchantDetailScreen />', () => {
  it('monte et montre le solde de fidélité et ce qu’il reste avant le palier', () => {
    mount();
    expect(screen.getByTestId('merchant-detail-screen')).toBeTruthy();
    expect(screen.getByText('85 points')).toBeTruthy();
    expect(screen.getByText(/Plus que 165 points/)).toBeTruthy();
  });

  it('ouvre la fidélité', () => {
    const onOpenLoyalty = jest.fn();
    mount({ onOpenLoyalty });
    fireEvent.press(screen.getByTestId('merchant-loyalty-card'));
    expect(onOpenLoyalty).toHaveBeenCalled();
  });

  it('toucher une carte « Flash du moment » ouvre l’offre', () => {
    const onOpenDeal = jest.fn();
    mount({ onOpenDeal });
    fireEvent.press(screen.getByTestId(`merchant-deal-${HERO.id}`));
    expect(onOpenDeal).toHaveBeenCalledWith(HERO.id);
  });

  it('le « + » ajoute l’offre au panier', () => {
    mount();
    fireEvent.press(screen.getByTestId(`merchant-add-${HERO.id}`));
    expect(useShopStore.getState().cart[0]?.dealId).toBe(HERO.id);
  });

  it('n’invente ni vidéo ni numéro : « Appeler » est grisé, la vidéo absente', () => {
    mount();
    expect(screen.queryByTestId('merchant-video')).toBeNull();
    expect(screen.getByTestId('merchant-action-call').props.accessibilityState?.disabled).toBe(
      true,
    );
  });

  it('montre la vidéo, l’état ouvert et le téléphone quand le commerçant les a réglés', () => {
    mount({
      phone: '06 12 34 56 78',
      profile: {
        presentation: 'Pizzeria familiale',
        photos: [],
        videos: ['file:///v.mp4'],
        status: 'Ouvert jusqu’à 22:00',
      },
    });
    expect(screen.getByTestId('merchant-video')).toBeTruthy();
    expect(screen.getByTestId('merchant-open-badge')).toHaveTextContent('OUVERT');
    fireEvent.press(screen.getByTestId('merchant-action-infos'));
    expect(screen.getByText('Pizzeria familiale')).toBeTruthy();
  });

  it('le cœur agit sur l’OFFRE, jamais sur l’enseigne', () => {
    mount();
    fireEvent.press(screen.getByTestId('merchant-favorite'));
    const favs = useShopStore.getState().favorites;
    // Un id d'enseigne dans cette liste la corromprait.
    expect(favs).toContain(HERO.id);
    expect(favs).not.toContain(MID);
  });

  it('reste stable sur une enseigne inconnue', () => {
    render(
      <MerchantDetailScreen
        merchantId="nope"
        onOpenLoyalty={jest.fn()}
        onOpenDeal={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    expect(screen.getByTestId('merchant-detail-missing')).toBeTruthy();
  });
});

describe('<MerchantDetailScreen /> — la vidéo du magasin', () => {
  it('montre une vignette, puis lance le lecteur au premier appui', () => {
    mount({
      profile: { presentation: '', photos: [], videos: ['file:///v.mp4'], status: 'Ouvert' },
    });
    // Rien n'est chargé avant que le client ne le demande.
    expect(screen.queryByTestId('merchant-video-player')).toBeNull();

    fireEvent.press(screen.getByTestId('merchant-video-play'));
    expect(screen.getByTestId('merchant-video-player')).toBeTruthy();
    expect(screen.queryByTestId('merchant-video-play')).toBeNull();
  });

  it('la vitrine d’exemple de Techno Capitole a sa vidéo, son portfolio et son téléphone', () => {
    const showcase = demoShowcase('m_techno')!;
    mount({ merchantId: 'm_techno', profile: showcase.profile, phone: showcase.phone });
    expect(screen.getByTestId('merchant-video')).toBeTruthy();
    expect(screen.getByText('Techno Capitole')).toBeTruthy();
  });
});

describe('vitrines d’exemple', () => {
  it('seule Techno Capitole en a une, et sa vidéo est une clé du dépôt', () => {
    expect(demoShowcase('m_techno')?.profile.videos).toEqual(['demo-techno']);
    expect(demoShowcase('m_inconnu')).toBeUndefined();
  });

  it('résout les clés d’exemple, l’ancien « demo » et l’adresse d’un commerçant', () => {
    expect(videoSource('demo-techno')).toBe(videoSource('demo-techno'));
    expect(videoSource('demo')).toBe(videoSource('demo-resto'));
    expect(videoSource('demo-techno')).not.toBe(videoSource('demo-resto'));
    expect(videoSource('file:///v.mp4')).toEqual({ uri: 'file:///v.mp4' });
  });
});
