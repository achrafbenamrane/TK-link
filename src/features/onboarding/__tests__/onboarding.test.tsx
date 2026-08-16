import { fireEvent, render, screen } from '@/shared/testing/render';

import { AVATAR_COUNT, canFinish, randomAvatar, toggleInterest } from '../lib/avatar';
import { AVATARS, avatarAt } from '../model/avatars';
import { OnboardingSchema } from '../model/schema';
import { useOnboardingStore } from '../model/store';
import { OnboardingScreen } from '../ui/onboarding-screen';

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('galerie d’avatars', () => {
  it('a un identifiant, un libellé et une image par avatar', () => {
    expect(AVATARS.length).toBeGreaterThan(0);
    for (const a of AVATARS) {
      expect(a.id).toMatch(/^[a-z-]+$/);
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.source).toBeDefined();
    }
  });

  it('n’a pas deux fois le même identifiant', () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
  });

  it('borne un index hors galerie au lieu de rendre un trou', () => {
    expect(avatarAt(0)).toBe(AVATARS[0]);
    expect(AVATARS).toContain(avatarAt(999));
  });
});

describe('randomAvatar', () => {
  it('reste dans la galerie', () => {
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar();
      expect(a.preset).toBeGreaterThanOrEqual(0);
      expect(a.preset).toBeLessThan(AVATAR_COUNT);
    }
  });

  it('est déterministe avec un générateur fourni', () => {
    expect(randomAvatar(() => 0)).toEqual({ preset: 0 });
    // Un générateur qui rend 1 (borne haute exclue en théorie) ne doit pas
    // sortir de la galerie.
    expect(randomAvatar(() => 1)).toEqual({ preset: AVATAR_COUNT - 1 });
  });
});

describe('toggleInterest', () => {
  it('ajoute puis retire', () => {
    expect(toggleInterest([], 'beaute')).toEqual(['beaute']);
    expect(toggleInterest(['beaute'], 'beaute')).toEqual([]);
    expect(toggleInterest(['beaute'], 'sport')).toEqual(['beaute', 'sport']);
  });
});

describe('canFinish', () => {
  it('exige un prénom non vide et un intérêt', () => {
    expect(canFinish('', [])).toBe(false);
    expect(canFinish('  ', ['beaute'])).toBe(false);
    expect(canFinish('Sofiane', [])).toBe(false);
    expect(canFinish('Sofiane', ['beaute'])).toBe(true);
  });
});

describe('OnboardingSchema', () => {
  it('fournit des valeurs par défaut sûres', () => {
    const s = OnboardingSchema.parse({});
    expect(s.completed).toBe(false);
    expect(s.interests).toEqual([]);
    expect(s.holderType).toBe('particulier');
  });

  it('démarre au rôle consommateur — CDC §4', () => {
    expect(OnboardingSchema.parse({}).role).toBe('consommateur');
  });

  it('survit à un profil enregistré AVANT le CDC', () => {
    // Le vrai risque de la bascule vers les 8 catégories : un `z.enum` strict
    // ferait échouer safeParse sur `alimentation`, et le store repartirait de
    // zéro — l'utilisateur refait tout l'onboarding.
    const s = OnboardingSchema.parse({
      completed: true,
      firstName: 'Sofiane',
      interests: ['alimentation', 'carburant', 'mode'],
    });
    expect(s.interests).toEqual(['mode']); // les disparus sont écartés
    expect(s.firstName).toBe('Sofiane'); // le profil, lui, est intact
    expect(s.completed).toBe(true);
  });

  it('relit un avatar DESSINÉ (hue/face/accessory) sans casser le profil', () => {
    // L'ancien avatar composable n'a pas d'équivalent dans la galerie : il
    // retombe sur la première illustration. Ce qui compte, c'est que la
    // réhydratation n'échoue PAS — sinon tout le profil serait perdu avec lui.
    const s = OnboardingSchema.parse({
      completed: true,
      firstName: 'Sofiane',
      avatar: { hue: 2, face: 1, accessory: 3 },
      interests: ['mode'],
    });
    expect(s.avatar).toEqual({ preset: 0 });
    expect(s.firstName).toBe('Sofiane');
    expect(s.completed).toBe(true);
  });
});

describe('rôle — CDC §4', () => {
  it('un commerçant est forcément un professionnel', () => {
    const store = useOnboardingStore.getState();
    store.setRole('commercant');
    expect(useOnboardingStore.getState().role).toBe('commercant');
    // Sans cette règle, on obtiendrait un « commerçant particulier » et
    // l'audience des cadeaux fidélité deviendrait fausse.
    expect(useOnboardingStore.getState().holderType).toBe('pro');
  });

  it('un grossiste aussi', () => {
    useOnboardingStore.getState().setRole('grossiste');
    expect(useOnboardingStore.getState().holderType).toBe('pro');
  });

  it('le consommateur garde son choix particulier / pro', () => {
    useOnboardingStore.getState().setHolderType('particulier');
    useOnboardingStore.getState().setRole('consommateur');
    expect(useOnboardingStore.getState().holderType).toBe('particulier');
  });
});

describe('<OnboardingScreen />', () => {
  it('propose le compte AVANT la personnalisation, et ne termine qu’une fois rempli', () => {
    const onDone = jest.fn();
    render(<OnboardingScreen onDone={onDone} />);

    // 1 — impact
    expect(screen.getByTestId('onboarding-screen')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 2 — le compte, tout de suite après l’accroche. Rien n’a encore été
    // demandé : on ne récapitule donc pas, on donne des raisons.
    expect(screen.getByTestId('onboarding-signup')).toBeTruthy();
    expect(screen.getByTestId('onboarding-account-perks')).toBeTruthy();
    expect(useOnboardingStore.getState().completed).toBe(false);
    fireEvent.press(screen.getByTestId('onboarding-next')); // « Continuer sans compte »

    // 3 — rôle (CDC §4)
    expect(screen.getByTestId('role-consommateur')).toBeTruthy();
    fireEvent.press(screen.getByTestId('role-consommateur'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 4 — avatar
    expect(screen.getByTestId('avatar-random')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`avatar-${AVATARS[2]!.id}`));
    expect(useOnboardingStore.getState().avatar).toEqual({ preset: 2 });
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 5 — profil
    fireEvent.press(screen.getByTestId('holder-pro'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 6 — intérêts : incomplet, donc on n’avance pas
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-firstname')).toBeTruthy();
    expect(useOnboardingStore.getState().completed).toBe(false);

    fireEvent.changeText(screen.getByTestId('onboarding-firstname'), 'Sofiane');
    fireEvent.press(screen.getByTestId('interest-restauration'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(onDone).toHaveBeenCalledWith('app');
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useOnboardingStore.getState().firstName).toBe('Sofiane');
    expect(useOnboardingStore.getState().interests).toEqual(['restauration']);
  });

  it('l’étape compte mène à l’inscription ou à la connexion', () => {
    const onDone = jest.fn();
    render(<OnboardingScreen onDone={onDone} />);

    fireEvent.press(screen.getByTestId('onboarding-next')); // impact → compte

    fireEvent.press(screen.getByTestId('onboarding-signup'));
    expect(onDone).toHaveBeenCalledWith('sign-up');
    // L’onboarding est clos AVANT de partir : sinon la porte du layout
    // renverrait sur l’onboarding au lieu de laisser voir l’inscription.
    expect(useOnboardingStore.getState().completed).toBe(true);
  });

  it('ne redemande PAS le prénom quand l’inscription l’a déjà donné', () => {
    // Le vrai motif du changement : l’inscription du CDC §5 collecte déjà le
    // prénom. Le redemander deux écrans plus loin donne l’impression que rien
    // n’a été retenu.
    useOnboardingStore.setState({ firstName: 'Sofiane' });
    render(<OnboardingScreen onDone={jest.fn()} hasAccount />);

    for (let i = 0; i < 4; i++) fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('interest-restauration')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-firstname')).toBeNull();
  });

  it('demande le prénom à qui a refusé le compte', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('onboarding-firstname')).toBeTruthy();
  });

  it('ne propose pas de compte à qui vient de se connecter', () => {
    const onDone = jest.fn();
    useOnboardingStore.setState({ firstName: 'Sofiane', interests: ['restauration'] });
    render(<OnboardingScreen onDone={onDone} hasAccount />);

    expect(screen.queryByTestId('onboarding-signup')).toBeNull();
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(onDone).toHaveBeenCalledWith('app');
  });

  it('saute l’étape particulier / pro pour un commerçant — CDC §4', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next')); // impact → compte
    fireEvent.press(screen.getByTestId('onboarding-next')); // compte → rôle
    fireEvent.press(screen.getByTestId('role-commercant'));
    fireEvent.press(screen.getByTestId('onboarding-next')); // rôle → avatar
    fireEvent.press(screen.getByTestId('onboarding-next')); // avatar → …

    expect(screen.queryByTestId('holder-particulier')).toBeNull();
    expect(screen.getByTestId('onboarding-firstname')).toBeTruthy();
  });

  it('propose les huit catégories du CDC', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId('onboarding-next'));

    for (const key of ['restauration', 'high-tech', 'maison', 'mode', 'auto', 'services']) {
      expect(screen.getByTestId(`interest-${key}`)).toBeTruthy();
    }
  });

  it('permet de revenir en arrière', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-signup')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-back'));
    // Retour à l'accroche : plus de proposition de compte à l'écran.
    expect(screen.queryByTestId('onboarding-signup')).toBeNull();
  });
});

describe('rôles proposés dans l’app — décision client du 2026-08-10', () => {
  it('ne propose PAS le grossiste : il passe par l’espace pro web', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next')); // impact → compte
    fireEvent.press(screen.getByTestId('onboarding-next')); // compte → rôle

    expect(screen.getByTestId('role-consommateur')).toBeTruthy();
    expect(screen.getByTestId('role-commercant')).toBeTruthy();
    expect(screen.queryByTestId('role-grossiste')).toBeNull();
  });
});

describe('plus de support physique — décision client du 16/08/2026', () => {
  it('ne demande plus de choisir entre la carte et la pastille', () => {
    // « On reste uniquement sur du soft. » Le CDC V1.0 ne mentionne plus aucun
    // matériel : demander à quelqu'un de choisir un support qui n'existera pas
    // est une promesse qu'on ne tiendra pas.
    render(<OnboardingScreen onDone={jest.fn()} />);
    for (let i = 0; i < 4; i++) fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(screen.getByTestId('holder-particulier')).toBeTruthy();
    expect(screen.queryByTestId('medium-carte')).toBeNull();
    expect(screen.queryByTestId('medium-pastille')).toBeNull();
  });

  it('garde le champ dans le profil enregistré, avec son défaut', () => {
    // Le retirer du schéma PERSISTÉ ferait échouer `safeParse` sur les profils
    // déjà en place, et effacerait prénom, avatar, rôle et centres d'intérêt —
    // pour supprimer une valeur que plus personne ne lit.
    const profil = OnboardingSchema.parse({});
    expect(profil.medium).toBe('carte');
  });
});
