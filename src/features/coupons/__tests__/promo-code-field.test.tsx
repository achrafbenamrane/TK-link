import { fireEvent, render, screen } from '@/shared/testing/render';

import { PromoCodeField } from '../ui/promo-code-field';
import { selectAvailableCoupons, useCouponsStore } from '../model/store';

// Préfixe `mock` obligatoire : Babel remonte `jest.mock` au-dessus des
// imports, et seule cette convention autorise la fabrique à voir la variable.
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

describe('<PromoCodeField /> — la saisie d’un code dans La Chasse', () => {
  it('crédite un coupon quand le code est valide', () => {
    const before = selectAvailableCoupons(useCouponsStore.getState()).length;
    render(<PromoCodeField />);

    fireEvent.changeText(screen.getByTestId('hub-promo-input'), 'BIENVENUE');
    fireEvent.press(screen.getByTestId('hub-promo-submit'));

    expect(selectAvailableCoupons(useCouponsStore.getState()).length).toBe(before + 1);
    // On dit où il servira : un coupon crédité sans suite laisse l'utilisateur
    // chercher un portefeuille qui n'existe plus.
    // `getByText` avec une expression régulière, et non `toHaveTextContent` :
    // ce dernier compare la chaîne ENTIÈRE ici, et échouerait sur un message
    // qui contient pourtant le mot attendu.
    expect(screen.getByText(/panier/)).toBeTruthy();
  });

  it('explique le refus plutôt que d’échouer en silence', () => {
    render(<PromoCodeField />);

    fireEvent.changeText(screen.getByTestId('hub-promo-input'), 'NIMPORTEQUOI');
    fireEvent.press(screen.getByTestId('hub-promo-submit'));

    expect(screen.getByText(/Code inconnu/)).toBeTruthy();
  });

  it('efface le verdict dès qu’on retouche le code', () => {
    // Sinon « Code inconnu » reste affiché sous une saisie neuve, et l'on
    // croit que le nouveau code a échoué avant même de l'avoir validé.
    render(<PromoCodeField />);
    fireEvent.changeText(screen.getByTestId('hub-promo-input'), 'FAUX');
    fireEvent.press(screen.getByTestId('hub-promo-submit'));
    expect(screen.getByTestId('hub-promo-feedback')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('hub-promo-input'), 'FAUXX');
    expect(screen.queryByTestId('hub-promo-feedback')).toBeNull();
  });

  it('ne tente rien sur un champ vide', () => {
    const before = selectAvailableCoupons(useCouponsStore.getState()).length;
    render(<PromoCodeField />);

    fireEvent.press(screen.getByTestId('hub-promo-submit'));

    expect(screen.queryByTestId('hub-promo-feedback')).toBeNull();
    expect(selectAvailableCoupons(useCouponsStore.getState()).length).toBe(before);
  });

  it('mène au portefeuille depuis le même bloc', () => {
    // Le bouton et le champ partagent un encadré : « ce que j'ai » puis
    // « comment en avoir plus », répondus d'un seul regard.
    render(<PromoCodeField />);

    fireEvent.press(screen.getByTestId('hub-my-coupons'));

    expect(mockPush).toHaveBeenCalledWith('/coupons');
  });
});
