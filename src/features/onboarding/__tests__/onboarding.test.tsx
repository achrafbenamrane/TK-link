import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { AVATAR_COUNT, INTERESTS, randomAvatar, toggleInterest } from '../lib/avatar';
import { AVATARS, avatarAt } from '../model/avatars';
import { OnboardingSchema } from '../model/schema';
import { useOnboardingStore } from '../model/store';
import { AvatarPicker } from '../ui/avatar-picker';
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

describe('OnboardingSchema', () => {
  it('fournit des valeurs par défaut sûres', () => {
    const s = OnboardingSchema.parse({});
    expect(s.completed).toBe(false);
    expect(s.interests).toEqual([]);
  });

  it('démarre au rôle consommateur — CDC §2.1', () => {
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

  it('relit un profil qui contient les champs RETIRÉS le 03/10/2026, sans rien perdre', () => {
    // `holderType` (particulier / pro), `medium` (carte / pastille) et
    // `showEcoImpact` ne sont plus déclarés : ni la V1.0 ni la V1.1 ne les
    // décrivent. Zod ignore les clés inconnues — un profil enregistré avant le
    // retrait se relit donc intact, au lieu de renvoyer l'utilisateur à
    // l'onboarding.
    const s = OnboardingSchema.parse({
      completed: true,
      firstName: 'Sofiane',
      role: 'commercant',
      siret: '44306184100047',
      interests: ['mode'],
      holderType: 'pro',
      medium: 'pastille',
      showEcoImpact: false,
    });
    expect(s.completed).toBe(true);
    expect(s.firstName).toBe('Sofiane');
    expect(s.role).toBe('commercant');
    expect(s.siret).toBe('44306184100047');
    expect(s).not.toHaveProperty('holderType');
    expect(s).not.toHaveProperty('medium');
    expect(s).not.toHaveProperty('showEcoImpact');
  });
});

describe('<OnboardingScreen /> — étapes 3 à 6 du parcours du client', () => {
  it('traverse les centres d’intérêt, la localisation, la sécurisation, puis entre dans l’app', async () => {
    const onDone = jest.fn();
    const onRequestLocation = jest.fn().mockResolvedValue(undefined);
    const onEnableBiometrics = jest.fn().mockResolvedValue(undefined);
    render(
      <OnboardingScreen
        onDone={onDone}
        onRequestLocation={onRequestLocation}
        onEnableBiometrics={onEnableBiometrics}
      />,
    );

    // 3 — centres d’intérêt : le CDC laisse choisir une, plusieurs ou toutes
    fireEvent.press(screen.getByTestId('interest-restauration'));
    expect(useOnboardingStore.getState().interests).toEqual(['restauration']);
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 4 — localisation
    fireEvent.press(screen.getByTestId('onboarding-location'));
    await waitFor(() => expect(onRequestLocation).toHaveBeenCalledTimes(1));

    // 5 — sécurisation
    await waitFor(() => expect(screen.getByTestId('onboarding-secure')).toBeTruthy());
    fireEvent.press(screen.getByTestId('onboarding-secure'));
    await waitFor(() => expect(onEnableBiometrics).toHaveBeenCalledTimes(1));

    // 6 — compte validé
    await waitFor(() => expect(screen.getByTestId('onboarding-next')).toBeTruthy());
    expect(useOnboardingStore.getState().completed).toBe(false);
    fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(onDone).toHaveBeenCalledWith('app');
    expect(useOnboardingStore.getState().completed).toBe(true);
  });

  it('ne bloque jamais : on peut passer les intérêts sans rien choisir', () => {
    // CDC §2.3 : les catégories « servent à prioriser le feed, mais ne bloquent
    // jamais la découverte des autres ». Exiger un choix serait un faux obstacle.
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('onboarding-location')).toBeTruthy();
  });

  it('propose les huit catégories du CDC, et « tout choisir »', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    for (const key of [
      'restauration',
      'high-tech',
      'maison',
      'mode',
      'beaute',
      'sport',
      'auto',
      'services',
    ]) {
      expect(screen.getByTestId(`interest-${key}`)).toBeTruthy();
    }

    fireEvent.press(screen.getByTestId('interest-all'));
    expect(useOnboardingStore.getState().interests).toHaveLength(INTERESTS.length);
    fireEvent.press(screen.getByTestId('interest-all'));
    expect(useOnboardingStore.getState().interests).toEqual([]);
  });

  it('la localisation et la sécurisation se passent d’un geste', () => {
    const onRequestLocation = jest.fn();
    render(<OnboardingScreen onDone={jest.fn()} onRequestLocation={onRequestLocation} />);
    fireEvent.press(screen.getByTestId('onboarding-next')); // intérêts
    fireEvent.press(screen.getByTestId('onboarding-skip')); // « Plus tard »
    expect(screen.getByTestId('onboarding-secure')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-skip'));

    expect(onRequestLocation).not.toHaveBeenCalled();
    expect(screen.getByTestId('onboarding-next')).toBeTruthy();
  });

  it('ne demande ni rôle, ni avatar, ni nom d’utilisateur, ni « particulier ou professionnel »', () => {
    // Le CDC V1.0 §2 ne décrit aucune de ces questions : l’inscription donne le
    // prénom, l’avatar se choisit sur le formulaire, et l’espace commerçant a sa
    // propre porte.
    render(<OnboardingScreen onDone={jest.fn()} />);
    expect(screen.queryByTestId('role-consommateur')).toBeNull();
    expect(screen.queryByTestId('onboarding-firstname')).toBeNull();
    expect(screen.queryByTestId('holder-pro')).toBeNull();
    expect(screen.queryByTestId('avatar-random')).toBeNull();
  });

  it('permet de revenir en arrière', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.queryByTestId('interest-restauration')).toBeNull();
    fireEvent.press(screen.getByTestId('onboarding-back'));
    expect(screen.getByTestId('interest-restauration')).toBeTruthy();
  });

  it('salue la personne par son prénom une fois le compte validé', () => {
    useOnboardingStore.setState({ firstName: 'Sofiane' });
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    fireEvent.press(screen.getByTestId('onboarding-skip'));
    fireEvent.press(screen.getByTestId('onboarding-skip'));

    expect(screen.getByText('C’est prêt, Sofiane')).toBeTruthy();
  });
});

describe('<AvatarPicker /> — le « + » de la maquette d’inscription', () => {
  it('ouvre la galerie et enregistre le choix', () => {
    render(<AvatarPicker />);
    expect(screen.queryByTestId('avatar-sheet')).toBeNull();

    fireEvent.press(screen.getByTestId('avatar-picker'));
    fireEvent.press(screen.getByTestId(`avatar-${AVATARS[2]!.id}`));

    expect(useOnboardingStore.getState().avatar).toEqual({ preset: 2 });
  });
});
