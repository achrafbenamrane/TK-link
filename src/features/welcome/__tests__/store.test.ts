import { useWelcomeStore } from '../model/store';

beforeEach(() => {
  useWelcomeStore.setState({ seen: false });
});

describe('welcome store', () => {
  it('démarre non vu', () => {
    expect(useWelcomeStore.getState().seen).toBe(false);
  });

  it('markSeen mémorise le passage', () => {
    useWelcomeStore.getState().markSeen();
    expect(useWelcomeStore.getState().seen).toBe(true);
  });

  // Pour re-jouer la démo sans réinstaller l'app.
  it('reset ré-affiche l’accueil', () => {
    useWelcomeStore.getState().markSeen();
    useWelcomeStore.getState().reset();
    expect(useWelcomeStore.getState().seen).toBe(false);
  });
});
