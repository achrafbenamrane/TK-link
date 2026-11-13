import { OnboardingSchema } from '../model/schema';
import { useOnboardingStore } from '../model/store';

/**
 * Le rôle livreur a été retiré le 13/11/2026 (les livraisons partent chez Uber Direct). Un
 * téléphone installé avant garde `role: 'livreur'` sur le disque : la relecture ne doit ni planter
 * ni effacer le reste du profil — sinon l'ancien livreur perdrait son prénom, son avatar et ses
 * centres d'intérêt, et referait tout l'accueil.
 */
const legacyCourier = {
  ownerId: 'user-123',
  completed: true,
  firstName: 'Alex',
  avatar: { preset: 2 },
  role: 'livreur',
  siret: '',
  interests: ['restauration', 'mode'],
};

describe('relecture d’un profil enregistré AVANT le retrait du livreur', () => {
  it('le schéma relit l’ancien livreur en client, sans rien perdre d’autre', () => {
    const parsed = OnboardingSchema.safeParse(legacyCourier);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.role).toBe('consommateur');
    expect(parsed.data.firstName).toBe('Alex');
    expect(parsed.data.completed).toBe(true);
    expect(parsed.data.avatar.preset).toBe(2);
    expect(parsed.data.interests).toEqual(['restauration', 'mode']);
    expect(parsed.data.ownerId).toBe('user-123');
  });

  it('un rôle illisible retombe sur le client au lieu de faire échouer la relecture', () => {
    const parsed = OnboardingSchema.safeParse({ ...legacyCourier, role: 42 });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.role).toBe('consommateur');
    expect(parsed.success && parsed.data.firstName).toBe('Alex');
  });

  it('le store, relu depuis le disque, garde le profil et fait de l’ancien livreur un client', async () => {
    const { asyncStorageBackend } = jest.requireActual('@/shared/lib/storage');
    await asyncStorageBackend.setItem(
      'tklink-onboarding-v1',
      JSON.stringify({ state: legacyCourier, version: 0 }),
    );
    await useOnboardingStore.persist.rehydrate();

    const state = useOnboardingStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.role).toBe('consommateur');
    expect(state.firstName).toBe('Alex');
    expect(state.completed).toBe(true);
    expect(state.interests).toEqual(['restauration', 'mode']);
  });
});
