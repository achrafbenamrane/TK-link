import { fireEvent, render, screen } from '@/shared/testing/render';

import { makeReferralCode, useReferralStore } from '../model/store';
import { ReferralScreen } from '../ui/referral-screen';

const state = () => useReferralStore.getState();

beforeEach(() => {
  useReferralStore.setState({ myCode: '', referredBy: null, credit: 'aucun' });
});

describe('code de parrainage — CDC V1.1', () => {
  it('fabrique des codes lisibles, sans caractères ambigus', () => {
    for (let i = 0; i < 50; i++) expect(makeReferralCode()).toMatch(/^TK-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('garde le même code une fois créé', () => {
    const a = state().ensureCode();
    expect(state().ensureCode()).toBe(a);
  });

  it('refuse un code mal formé, le sien, un second parrain, ou après une commande', () => {
    const mine = state().ensureCode();
    expect(state().applyCode('coucou', false)).toEqual({ ok: false, reason: 'invalide' });
    expect(state().applyCode(mine, false)).toEqual({ ok: false, reason: 'son_propre_code' });
    expect(state().applyCode('TK-ABC234', true)).toEqual({ ok: false, reason: 'deja_client' });
    expect(state().applyCode(' tk-abc234 ', false)).toEqual({ ok: true });
    expect(state().applyCode('TK-ZZZ999', false)).toEqual({ ok: false, reason: 'deja_parraine' });
  });
});

describe('crédit du filleul', () => {
  it('se débloque au premier achat, puis se consomme une seule fois', () => {
    state().applyCode('TK-ABC234', false);
    expect(state().credit).toBe('a_debloquer');

    state().onPurchase();
    expect(state().credit).toBe('disponible');

    state().consumeCredit();
    expect(state().credit).toBe('utilise');
    // Un achat de plus ne redébloque rien.
    state().onPurchase();
    expect(state().credit).toBe('utilise');
  });

  it('sans code, un achat ne crédite rien', () => {
    state().onPurchase();
    expect(state().credit).toBe('aucun');
  });
});

describe('<ReferralScreen />', () => {
  it('montre mon code et propose de le partager', () => {
    render(<ReferralScreen hasOrdered={false} />);
    expect(screen.getByTestId('referral-code').props.children).toMatch(/^TK-/);
    expect(screen.getByTestId('referral-share')).toBeTruthy();
  });

  it('enregistre le code d’un parrain, ou explique pourquoi pas', () => {
    render(<ReferralScreen hasOrdered={false} />);
    fireEvent.changeText(screen.getByTestId('referral-input'), 'nope');
    fireEvent.press(screen.getByTestId('referral-apply'));
    expect(screen.getByTestId('referral-error')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('referral-input'), 'TK-ABC234');
    fireEvent.press(screen.getByTestId('referral-apply'));
    expect(screen.getByTestId('referral-status')).toHaveTextContent(/première commande/);
  });

  it('refuse le code d’un parrain à qui a déjà commandé', () => {
    render(<ReferralScreen hasOrdered />);
    fireEvent.changeText(screen.getByTestId('referral-input'), 'TK-ABC234');
    fireEvent.press(screen.getByTestId('referral-apply'));
    expect(screen.getByTestId('referral-error')).toHaveTextContent(/nouveaux clients/);
  });
});
