import { forgetRetiredStores, RETIRED_STORE_KEYS } from '../retired-stores';
import { appStorage } from '../storage';

describe('magasins des fonctions retirées', () => {
  it('efface le magasin de l’ancien livreur, et lui seul', async () => {
    await appStorage.set(
      'tklink-courier-v1',
      JSON.stringify({ state: { identity: { givenName: 'Alex' } }, version: 0 }),
    );
    await appStorage.set('tklink-onboarding-v1', JSON.stringify({ state: { firstName: 'Alex' } }));

    await forgetRetiredStores();

    expect(await appStorage.get('tklink-courier-v1')).toBeNull();
    // Le profil reste : l'ancien livreur devient client, il ne perd pas son prénom.
    expect(await appStorage.get('tklink-onboarding-v1')).not.toBeNull();
  });

  it('ne fait rien de mal quand il n’y a rien à effacer', async () => {
    await expect(forgetRetiredStores()).resolves.toBeUndefined();
    expect(RETIRED_STORE_KEYS).toContain('tklink-courier-v1');
    expect(RETIRED_STORE_KEYS).toContain('tklink-messages-v1');
  });
});
