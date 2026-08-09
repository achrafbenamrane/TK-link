import { fireEvent, render, screen } from '@/shared/testing/render';

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
      loyaltyPoints={85}
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
  it('monte et montre le solde de fidélité reçu en props', () => {
    mount();
    expect(screen.getByTestId('merchant-detail-screen')).toBeTruthy();
    expect(screen.getByText('85')).toBeTruthy();
  });

  it('ouvre la fidélité', () => {
    const onOpenLoyalty = jest.fn();
    mount({ onOpenLoyalty });
    fireEvent.press(screen.getByTestId('merchant-loyalty-card'));
    expect(onOpenLoyalty).toHaveBeenCalled();
  });

  it('le bouton FLASH PROMO ouvre l’offre', () => {
    const onOpenDeal = jest.fn();
    mount({ onOpenDeal });
    fireEvent.press(screen.getByTestId('merchant-flash-go'));
    expect(onOpenDeal).toHaveBeenCalledWith(HERO.id);
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
