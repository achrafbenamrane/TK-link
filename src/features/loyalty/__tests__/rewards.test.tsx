import { fireEvent, render, screen } from '@/shared/testing/render';

import { useMerchantLoyaltyStore } from '../model/merchant-store';
import { RewardsScreen } from '../ui/rewards-screen';
import { TiersSettingsScreen } from '../ui/tiers-settings-screen';

const MID = 'm_napoli';

const state = () => useMerchantLoyaltyStore.getState();

beforeEach(() => {
  state().resetDemo();
});

describe('inventaire de récompenses — CDC V1.1', () => {
  it('réclamer un palier crée une récompense à QR dans l’inventaire', () => {
    expect(state().claim(MID, 1, 'Pizzeria Napoli')).toBe(true);
    const [reward] = state().rewards;
    expect(reward).toMatchObject({
      merchantId: MID,
      merchantName: 'Pizzeria Napoli',
      rank: 1,
      status: 'disponible',
    });
    expect(reward?.code).toMatch(/^TK-[A-Z2-9]{6}$/);
  });

  it('ne crée rien pour un palier non atteint, ni deux fois pour le même', () => {
    expect(state().claim(MID, 4)).toBe(false);
    expect(state().claim(MID, 1)).toBe(true);
    expect(state().claim(MID, 1)).toBe(false);
    expect(state().rewards).toHaveLength(1);
  });

  it('une récompense partagée quitte l’inventaire : on ne la partage pas ET on l’utilise', () => {
    state().claim(MID, 1);
    const id = state().rewards[0]!.id;
    expect(state().shareReward(id)).toBe(true);
    expect(state().rewards[0]?.status).toBe('partagee');
    expect(state().shareReward(id)).toBe(false);
  });

  it('le commerçant valide par le code, une seule fois, et seulement chez lui', () => {
    state().claim(MID, 1);
    const { code } = state().rewards[0]!;

    expect(state().redeemReward('m_autre', code)).toEqual({ ok: false, reason: 'inconnu' });
    expect(state().redeemReward(MID, 'TK-ZZZZZZ')).toEqual({ ok: false, reason: 'inconnu' });
    expect(state().redeemReward(MID, ` ${code.toLowerCase()} `).ok).toBe(true);
    expect(state().rewards[0]?.status).toBe('utilisee');
    expect(state().redeemReward(MID, code)).toEqual({ ok: false, reason: 'deja_utilisee' });
  });

  it('les points bruts ne se transfèrent nulle part : aucune action ne le permet', () => {
    expect(state()).not.toHaveProperty('transferPoints');
    expect(state()).not.toHaveProperty('sharePoints');
  });
});

describe('<RewardsScreen />', () => {
  it('annonce un inventaire vide', () => {
    render(<RewardsScreen />);
    expect(screen.getByTestId('rewards-empty')).toBeTruthy();
  });

  it('montre le QR et le code d’une récompense disponible, avec un bouton de partage', () => {
    state().claim(MID, 1, 'Pizzeria Napoli');
    const reward = state().rewards[0]!;
    render(<RewardsScreen />);
    expect(screen.getByTestId(`reward-code-${reward.id}`)).toHaveTextContent(reward.code);
    expect(screen.getByTestId(`reward-share-${reward.id}`)).toBeTruthy();
  });

  it('range une récompense utilisée dans l’historique, sans bouton de partage', () => {
    state().claim(MID, 1);
    const reward = state().rewards[0]!;
    state().redeemReward(MID, reward.code);
    render(<RewardsScreen />);
    expect(screen.queryByTestId(`reward-share-${reward.id}`)).toBeNull();
    expect(screen.getByText('Utilisée')).toBeTruthy();
  });
});

describe('validation côté commerçant', () => {
  it('valide une récompense par son code', () => {
    state().claim(MID, 1);
    const { code } = state().rewards[0]!;
    render(<TiersSettingsScreen merchantId={MID} />);

    fireEvent.changeText(screen.getByTestId('reward-redeem-code'), code);
    fireEvent.press(screen.getByTestId('reward-redeem-submit'));
    expect(screen.getByTestId('reward-redeem-result')).toHaveTextContent(/Validée/);

    // Le même code, une seconde fois : refusé.
    fireEvent.changeText(screen.getByTestId('reward-redeem-code'), code);
    fireEvent.press(screen.getByTestId('reward-redeem-submit'));
    expect(screen.getByTestId('reward-redeem-result')).toHaveTextContent(/déjà été utilisée/);
  });
});
