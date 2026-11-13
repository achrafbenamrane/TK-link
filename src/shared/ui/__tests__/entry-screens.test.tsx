import { fireEvent, render, screen } from '@/shared/testing/render';
import { useThemeStore } from '@/shared/theme/theme-store';
import { BrandBar, Button, HeaderBackButton, ScreenIntro, ThemeToggle } from '@/shared/ui';

/**
 * Les briques des écrans d'entrée (profil, connexion, inscription, mot de passe oublié) : un seul
 * en-tête, un seul titre, pour que rien ne se décale d'un écran à l'autre (retour du 13/11/2026).
 */
describe('<BrandBar />', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'night' });
  });

  it('logo, retour et bascule Nuit/Jour', () => {
    const onBack = jest.fn();
    render(<BrandBar onBack={onBack} backTestID="x-back" backLabel="Retour au choix du profil" />);
    expect(screen.getByLabelText('TKlink')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retour au choix du profil'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sans retour : pas de bouton, le logo reste au centre', () => {
    render(<BrandBar />);
    expect(screen.queryByTestId('brand-bar-back')).toBeNull();
    expect(screen.getByLabelText('TKlink')).toBeTruthy();
  });

  it('`right={null}` retire la bascule', () => {
    render(<BrandBar right={null} />);
    expect(screen.queryByTestId('theme-toggle')).toBeNull();
  });
});

describe('<ThemeToggle compact />', () => {
  it('garde les deux modes, sans leurs libellés', () => {
    useThemeStore.setState({ mode: 'night' });
    render(<ThemeToggle compact />);
    expect(screen.queryByText('Nuit')).toBeNull();
    expect(screen.queryByText('Jour')).toBeNull();
    // Le lecteur d'écran, lui, dit toujours de quel mode il s'agit.
    expect(screen.getByLabelText('Mode nuit').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByLabelText('Mode jour'));
    expect(useThemeStore.getState().mode).toBe('day');
  });
});

describe('<ScreenIntro />', () => {
  it('un titre, une phrase, et ce qui vient dessous', () => {
    render(
      <ScreenIntro title="Créer mon compte" subtitle="Inscris-toi.">
        <Button label="Avatar" testID="intro-child" />
      </ScreenIntro>,
    );
    expect(screen.getByText('Créer mon compte')).toBeTruthy();
    expect(screen.getByText('Inscris-toi.')).toBeTruthy();
    expect(screen.getByTestId('intro-child')).toBeTruthy();
  });
});

describe('<Button variant="outline" />', () => {
  it('le « J’ai déjà un compte » des maquettes reste un bouton', () => {
    const onPress = jest.fn();
    render(<Button label="J’ai déjà un compte" variant="outline" onPress={onPress} testID="b" />);
    fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('J’ai déjà un compte')).toBeTruthy();
  });
});

describe('<HeaderBackButton />', () => {
  it('un seul bouton retour pour toute l’app : « Retour » par défaut, la navigation à l’appelant', () => {
    const onPress = jest.fn();
    render(<HeaderBackButton testID="x-back" onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
