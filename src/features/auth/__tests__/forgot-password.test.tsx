import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { DEMO_CODE } from '../model/demo-session';
import { useAuthStore } from '../model/store';
import { ForgotPasswordScreen } from '../ui/forgot-password-screen';

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const original = useAuthStore.getState();

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    status: 'unauthenticated',
    error: null,
    demoMode: original.demoMode,
    requestPasswordReset: original.requestPasswordReset,
    verifyResetCode: original.verifyResetCode,
    setNewPassword: original.setNewPassword,
  });
});

describe('<ForgotPasswordScreen /> — l’identifiant', () => {
  it('commence par demander l’e-mail ou le numéro', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByTestId('forgot-request')).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail ou numéro de téléphone')).toBeOnTheScreen();
  });

  it('dit ce qui cloche avant d’appeler le serveur', async () => {
    const requestPasswordReset = jest.fn();
    useAuthStore.setState({ requestPasswordReset });
    render(<ForgotPasswordScreen />);

    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
      /e-mail ou votre numéro/,
    );

    fill('forgot-identifier', '06 12');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
      /Numéro invalide/,
    );
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('n’affirme jamais qu’un compte existe : « Si un compte existe… »', async () => {
    useAuthStore.setState({
      requestPasswordReset: jest
        .fn()
        .mockResolvedValue({ ok: true, identifier: { kind: 'phone', value: '+33612345678' } }),
    });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', '06 12 34 56 78');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    const step = await screen.findByTestId('forgot-code-step');
    expect(step).toHaveTextContent(/Si un compte existe pour \+33 ••• •• •• 78/);
    expect(step).not.toHaveTextContent(/Nous avons envoyé/);
    expect(useAuthStore.getState().requestPasswordReset).toHaveBeenCalledWith('+33612345678');
  });

  it('montre une limite d’envoi atteinte, et reste sur l’étape', async () => {
    useAuthStore.setState({
      requestPasswordReset: jest.fn().mockResolvedValue({ ok: false, error: 'rate_limited' }),
    });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    expect(await screen.findByTestId('forgot-error')).toHaveTextContent(/Trop de tentatives/);
    expect(screen.getByTestId('forgot-request')).toBeOnTheScreen();
  });

  it('le bouton retour ramène à la connexion', () => {
    const onBack = jest.fn();
    render(<ForgotPasswordScreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('forgot-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('<ForgotPasswordScreen /> — le parcours complet (démonstration)', () => {
  it('identifiant → code → nouveau mot de passe → connecté', async () => {
    const onDone = jest.fn();
    render(<ForgotPasswordScreen onDone={onDone} />);

    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('forgot-code-step');
    expect(screen.getByTestId('forgot-code-demo')).toHaveTextContent(new RegExp(DEMO_CODE));

    // Un code faux : message, et on reste sur l'étape.
    fill('forgot-code-input', '000000');
    expect(await screen.findByTestId('forgot-code-error')).toHaveTextContent(/code incorrect/i);

    fill('forgot-code-input', DEMO_CODE);
    await screen.findByTestId('forgot-password-step');

    // Trop court, puis différents.
    fill('forgot-password', 'court');
    fill('forgot-confirm', 'court');
    fireEvent.press(screen.getByTestId('forgot-save'));
    expect(await screen.findByTestId('forgot-password-error')).toHaveTextContent(/au moins 8/);

    fill('forgot-password', 'nouveau-mdp-1');
    fill('forgot-confirm', 'nouveau-mdp-2');
    fireEvent.press(screen.getByTestId('forgot-save'));
    expect(await screen.findByTestId('forgot-password-error')).toHaveTextContent(
      /ne correspondent pas/,
    );

    fill('forgot-confirm', 'nouveau-mdp-1');
    fireEvent.press(screen.getByTestId('forgot-save'));
    await screen.findByTestId('forgot-done');
    expect(useAuthStore.getState().status).toBe('authenticated');

    fireEvent.press(screen.getByTestId('forgot-continue'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('« Changer d’identifiant » revient à la première étape', async () => {
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('forgot-code-step');

    fireEvent.press(screen.getByTestId('forgot-code-back'));
    expect(await screen.findByTestId('forgot-request')).toBeOnTheScreen();
  });

  it('un mot de passe refusé par le serveur s’affiche, sans quitter l’étape', async () => {
    useAuthStore.setState({
      verifyResetCode: jest.fn().mockResolvedValue({ ok: true }),
      setNewPassword: jest.fn().mockResolvedValue({ ok: false, error: 'same_password' }),
    });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('forgot-code-step');
    fill('forgot-code-input', '123456');
    await screen.findByTestId('forgot-password-step');

    fill('forgot-password', 'ancien-mdp-1');
    fill('forgot-confirm', 'ancien-mdp-1');
    fireEvent.press(screen.getByTestId('forgot-save'));
    expect(await screen.findByTestId('forgot-password-error')).toHaveTextContent(
      /différent de l’ancien/,
    );
    await waitFor(() => expect(screen.getByTestId('forgot-password-step')).toBeOnTheScreen());
  });
});
