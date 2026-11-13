import { fireEvent, render, screen } from '@/shared/testing/render';

import { sortByUrgency } from '../lib/urgency';
import { DEALS } from '../model/catalog';
import { useShopStore } from '../model/store';
import { LiquidationRail } from '../ui/components/liquidation-rail';

jest.mock('expo-router', () => ({
  // Valeurs par défaut d'abord (useFocusEffect…), remplacements ensuite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- why: une fabrique de jest.mock ne capture pas un import
  ...require('@/shared/testing/expo-router-mock').expoRouterDefaults(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('expo-image', () => ({ Image: () => null }));

const mostUrgent = sortByUrgency(DEALS)[0]!;

beforeEach(() => {
  useShopStore.setState({ cart: [] });
});

describe('<LiquidationRail />', () => {
  it('met en tête ce qui va disparaître en premier', () => {
    render(<LiquidationRail limit={3} />);
    expect(screen.getByTestId(`liquidation-${mostUrgent.id}`)).toBeTruthy();
    expect(screen.getAllByTestId(/^liquidation-d_\w+$/)).toHaveLength(3);
  });

  it('« Attraper » met l’offre au panier', () => {
    render(<LiquidationRail limit={2} />);

    fireEvent.press(screen.getByTestId(`liquidation-catch-${mostUrgent.id}`));

    expect(useShopStore.getState().cart).toEqual([{ dealId: mostUrgent.id, qty: 1 }]);
  });
});
