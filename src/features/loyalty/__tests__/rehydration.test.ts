import { useMerchantLoyaltyStore } from '../model/merchant-store';

/**
 * Les cartes de fidélité vivent sur les téléphones, enregistrées quand les
 * paliers étaient UNE liste partagée (`tiers`). Passer à un programme par
 * commerçant ne doit pas effacer un seul point.
 */
describe('réhydratation — ancien format', () => {
  it('relit les cartes enregistrées avec l’ancienne clé `tiers`', async () => {
    const legacy = {
      state: {
        cards: {
          m_napoli: {
            points: 113,
            claimed: [1],
            history: [{ id: 'h1', label: 'Commande', points: 74, at: 1_700_000_000_000 }],
          },
        },
        tiers: [{ rank: 1, cost: 20, reward: '1 boisson' }],
      },
      version: 0,
    };
    const { asyncStorageBackend } = jest.requireActual('@/shared/lib/storage');
    await asyncStorageBackend.setItem('tklink-merchant-loyalty-v1', JSON.stringify(legacy));
    await useMerchantLoyaltyStore.persist.rehydrate();

    const state = useMerchantLoyaltyStore.getState();
    expect(state.cards.m_napoli?.points).toBe(113);
    expect(state.cards.m_napoli?.claimed).toEqual([1]);
    expect(state.programs).toEqual({});
  });

  it('démarre sans aucun point au premier lancement', () => {
    useMerchantLoyaltyStore.setState({ cards: {}, programs: {} });
    expect(useMerchantLoyaltyStore.getState().cards).toEqual({});
  });
});
