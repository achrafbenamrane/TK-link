import { fireEvent, render, screen } from '@/shared/testing/render';

import {
  AVATAR_LIMITS,
  avatarColors,
  canFinish,
  cycle,
  randomAvatar,
  toggleInterest,
} from '../lib/avatar';
import { OnboardingSchema } from '../model/schema';
import { useOnboardingStore } from '../model/store';
import { OnboardingScreen } from '../ui/onboarding-screen';

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('cycle', () => {
  it('boucle dans les deux sens', () => {
    expect(cycle(0, 1, 4)).toBe(1);
    expect(cycle(3, 1, 4)).toBe(0); // dépasse → revient au début
    expect(cycle(0, -1, 4)).toBe(3); // recule depuis le début → fin
  });
});

describe('randomAvatar', () => {
  it('reste dans les bornes des options', () => {
    for (let i = 0; i < 50; i++) {
      const a = randomAvatar();
      expect(a.hue).toBeGreaterThanOrEqual(0);
      expect(a.hue).toBeLessThan(AVATAR_LIMITS.hue);
      expect(a.face).toBeLessThan(AVATAR_LIMITS.face);
      expect(a.accessory).toBeLessThan(AVATAR_LIMITS.accessory);
    }
  });

  it('est déterministe avec un générateur fourni', () => {
    expect(randomAvatar(() => 0)).toEqual({ hue: 0, face: 0, accessory: 0 });
  });
});

describe('avatarColors', () => {
  it('donne toujours une paire de couleurs, même hors bornes', () => {
    expect(avatarColors({ hue: 0, face: 0, accessory: 0 }).bg).toMatch(/^#/);
    expect(avatarColors({ hue: 99, face: 0, accessory: 0 }).bg).toMatch(/^#/);
  });
});

describe('toggleInterest', () => {
  it('ajoute puis retire', () => {
    expect(toggleInterest([], 'sante')).toEqual(['sante']);
    expect(toggleInterest(['sante'], 'sante')).toEqual([]);
    expect(toggleInterest(['sante'], 'loisirs')).toEqual(['sante', 'loisirs']);
  });
});

describe('canFinish', () => {
  it('exige un prénom non vide et un intérêt', () => {
    expect(canFinish('', [])).toBe(false);
    expect(canFinish('  ', ['sante'])).toBe(false);
    expect(canFinish('Sofiane', [])).toBe(false);
    expect(canFinish('Sofiane', ['sante'])).toBe(true);
  });
});

describe('OnboardingSchema', () => {
  it('fournit des valeurs par défaut sûres', () => {
    const s = OnboardingSchema.parse({});
    expect(s.completed).toBe(false);
    expect(s.interests).toEqual([]);
    expect(s.holderType).toBe('particulier');
  });
});

describe('<OnboardingScreen />', () => {
  it('déroule les quatre étapes et ne termine qu’une fois rempli', () => {
    const onDone = jest.fn();
    render(<OnboardingScreen onDone={onDone} />);

    // 1 — impact
    expect(screen.getByTestId('onboarding-screen')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 2 — avatar
    expect(screen.getByTestId('avatar-random')).toBeTruthy();
    fireEvent.press(screen.getByTestId('avatar-hue-next'));
    expect(useOnboardingStore.getState().avatar.hue).toBe(1);
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 3 — profil
    fireEvent.press(screen.getByTestId('holder-pro'));
    fireEvent.press(screen.getByTestId('medium-pastille'));
    expect(useOnboardingStore.getState().holderType).toBe('pro');
    expect(useOnboardingStore.getState().medium).toBe('pastille');
    fireEvent.press(screen.getByTestId('onboarding-next'));

    // 4 — intérêts : incomplet, donc on ne termine pas
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(onDone).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().completed).toBe(false);

    // On remplit, et là ça passe.
    fireEvent.changeText(screen.getByTestId('onboarding-firstname'), 'Sofiane');
    fireEvent.press(screen.getByTestId('interest-alimentation'));
    fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(onDone).toHaveBeenCalled();
    expect(useOnboardingStore.getState().completed).toBe(true);
    expect(useOnboardingStore.getState().firstName).toBe('Sofiane');
    expect(useOnboardingStore.getState().interests).toEqual(['alimentation']);
  });

  it('permet de revenir en arrière', () => {
    render(<OnboardingScreen onDone={jest.fn()} />);
    fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(screen.getByTestId('avatar-random')).toBeTruthy();
    fireEvent.press(screen.getByTestId('onboarding-back'));
    // Retour à l'accroche : plus d'avatar à l'écran.
    expect(screen.queryByTestId('avatar-random')).toBeNull();
  });
});
