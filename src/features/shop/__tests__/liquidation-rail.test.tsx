import { fireEvent, render, screen } from '@/shared/testing/render';

import { sortByUrgency } from '../lib/urgency';
import { DEALS } from '../model/catalog';
import { useShopStore } from '../model/store';
import { LiquidationRail } from '../ui/components/liquidation-rail';

jest.mock('expo-router', () => ({
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
    expect(screen.getAllByTestId(/^liquidation-d_/)).toHaveLength(3);
  });

  it('« Attraper » met au panier et signale la prise à la route', () => {
    const onCatch = jest.fn();
    render(<LiquidationRail limit={2} onCatch={onCatch} />);

    fireEvent.press(screen.getByTestId(`liquidation-catch-${mostUrgent.id}`));

    expect(useShopStore.getState().cart).toEqual([{ dealId: mostUrgent.id, qty: 1 }]);
    expect(onCatch).toHaveBeenCalledWith(mostUrgent.id);
  });
});
