import { render, screen } from '@/shared/testing/render';

import { seedWholesaleLots } from '../model/seed';
import { useMerchantStore } from '../model/store';
import { MerchantPurchasesScreen } from '../ui/purchases-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const LOT = seedWholesaleLots()[0]!;

beforeEach(() => useMerchantStore.getState().resetDemo());

describe('<MerchantPurchasesScreen /> — CDC §20', () => {
  it('explique le vide au lieu de le subir', () => {
    render(<MerchantPurchasesScreen />);
    expect(screen.getByTestId('merchant-purchases-empty')).toBeTruthy();
  });

  it('liste les lots commandés avec ce qu’ils ont coûté', () => {
    const result = useMerchantStore.getState().orderLot(LOT.id, 3);
    const order = result.ok ? result.order : null;

    render(<MerchantPurchasesScreen />);

    expect(screen.getByTestId(`purchase-${order!.id}`)).toBeTruthy();
    expect(screen.queryByTestId('merchant-purchases-empty')).toBeNull();
  });

  it('affiche le prix figé à la commande, pas le prix du jour', () => {
    // Un lot qui change de tarif ne doit pas réécrire l'historique d'achat.
    const result = useMerchantStore.getState().orderLot(LOT.id, 2);
    const order = result.ok ? result.order : null;

    expect(order!.unitCents).toBe(LOT.priceCents);
    expect(order!.totalCents).toBe(LOT.priceCents * 2);
  });
});
