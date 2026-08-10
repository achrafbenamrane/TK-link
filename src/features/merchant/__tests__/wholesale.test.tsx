import { fireEvent, render, screen } from '@/shared/testing/render';

import { seedWholesaleLots } from '../model/seed';
import { useMerchantStore } from '../model/store';
import { WholesaleScreen } from '../ui/wholesale-screen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const LOTS = seedWholesaleLots();

beforeEach(() => useMerchantStore.getState().resetDemo());

describe('marché des grossistes — CDC §20', () => {
  it('ouvre sur des lots, pas sur le vide', () => {
    render(<WholesaleScreen />);

    expect(screen.getByTestId('wholesale-screen')).toBeTruthy();
    expect(screen.queryByTestId('wholesale-empty')).toBeNull();
    for (const lot of LOTS) {
      expect(screen.getByTestId(`lot-${lot.id}`)).toBeTruthy();
    }
  });

  it('affiche aussi MES annonces B2B, jamais mes ventes aux clients', () => {
    const base = {
      title: 'Lot de test',
      category: 'mode' as const,
      priceCents: 5000,
      oldPriceCents: 9000,
      stock: 3,
      durationMinutes: 240,
      description: '',
    };
    const b2b = useMerchantStore.getState().publish({ ...base, audience: 'commercants' }, 'Moi');
    const b2c = useMerchantStore
      .getState()
      .publish({ ...base, title: 'Vente client', audience: 'clients' }, 'Moi');

    render(<WholesaleScreen />);

    expect(screen.getByTestId(`lot-${b2b.ok ? b2b.offer.id : ''}`)).toBeTruthy();
    expect(screen.queryByTestId(`lot-${b2c.ok ? b2c.offer.id : ''}`)).toBeNull();
  });

  it('sans blocage, commander décrémente le stock et crée la commande', () => {
    const lot = LOTS[0]!;
    const before = useMerchantStore.getState().lots.find((l) => l.id === lot.id)!.stockLeft;

    const result = useMerchantStore.getState().orderLot(lot.id, 2);

    expect(result.ok).toBe(true);
    expect(useMerchantStore.getState().lots.find((l) => l.id === lot.id)!.stockLeft).toBe(
      before - 2,
    );
    const order = useMerchantStore.getState().wholesaleOrders[0]!;
    expect(order.qty).toBe(2);
    // Prix figé à la commande — un lot qui change de prix ne réécrit pas
    // l'historique.
    expect(order.totalCents).toBe(lot.priceCents * 2);
  });

  it('refuse une quantité supérieure au stock, sans rien commander', () => {
    const lot = LOTS[0]!;
    const result = useMerchantStore.getState().orderLot(lot.id, 999);

    expect(result).toEqual({ ok: false, reason: 'stock' });
    expect(useMerchantStore.getState().wholesaleOrders).toHaveLength(0);
  });

  it('refuse un lot inconnu', () => {
    expect(useMerchantStore.getState().orderLot('lot_fantome', 1)).toEqual({
      ok: false,
      reason: 'introuvable',
    });
  });

  it('sans SIRET, le blocage est annoncé et le bouton est inerte — CDC §5', () => {
    render(<WholesaleScreen blockedReason="Renseignez votre SIRET pour commander." />);

    expect(screen.getByTestId('wholesale-blocked')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`lot-order-${LOTS[0]!.id}`));

    // Rien ne part : la garde du §5 tient au clic, pas seulement à l'affichage.
    expect(useMerchantStore.getState().wholesaleOrders).toHaveLength(0);
  });

  it('propose de réparer le profil quand c’est le SIRET qui manque', () => {
    const onFixProfile = jest.fn();
    render(<WholesaleScreen blockedReason="Renseignez votre SIRET." onFixProfile={onFixProfile} />);

    fireEvent.press(screen.getByTestId('wholesale-blocked'));
    expect(onFixProfile).toHaveBeenCalled();
  });
});
