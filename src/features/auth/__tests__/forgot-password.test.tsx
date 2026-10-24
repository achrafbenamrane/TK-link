import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { DEMO_CODE } from '../model/demo-session';
import { useAuthStore } from '../model/store';
import { ForgotPasswordScreen } from '../ui/forgot-password-screen';

/**
 * MOT DE PASSE OUBLIÉ — par e-mail SEULEMENT : la récupération par SMS attend la vérification des
 * numéros (Prelude). Le bon code de la démonstration ouvre une session, que le store garde dans le
 * stockage sécurisé : sous Jest, un double en mémoire, pour ne pas dépendre du module natif.
 */
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
}));

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState;

/** Les icônes chargent leur police après le rendu : on laisse finir ce chargement sous `act`. */
const settle = () => act(async () => {});

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

describe('<ForgotPasswordScreen /> — l’adresse e-mail', () => {
  it('ne demande que l’adresse e-mail du compte', async () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByTestId('forgot-request')).toHaveTextContent(
      /Entrez l’adresse e-mail de votre compte/,
    );
    const field = screen.getByLabelText('Adresse e-mail');
    expect(field.props.keyboardType).toBe('email-address');
    expect(field.props.placeholder).toBe('vous@exemple.fr');
    // Plus de champ « e-mail ou téléphone » : un numéro ne permet pas (encore) de récupérer un compte.
    expect(screen.queryByLabelText('E-mail ou numéro de téléphone')).toBeNull();
    await settle();
  });

  it('dit ce qui cloche avant d’appeler le serveur', async () => {
    const requestPasswordReset = jest.fn();
    useAuthStore.setState({ requestPasswordReset });
    render(<ForgotPasswordScreen />);

    fireEvent.press(screen.getByTestId('forgot-submit'));
    // Champ vide : la phrase de cet écran, pas celle de la connexion (« … ou votre numéro … »).
    const empty = await screen.findByTestId('forgot-identifier-error');
    expect(empty).toHaveTextContent('Entrez votre adresse e-mail.');
    expect(empty).not.toHaveTextContent(/téléphone|numéro/i);

    // Des espaces seulement, c'est encore un champ vide.
    fill('forgot-identifier', '   ');
    expect(screen.queryByTestId('forgot-identifier-error')).toBeNull();
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
      'Entrez votre adresse e-mail.',
    );

    // Un numéro incomplet n'appelle pas « Numéro invalide » : c'est une adresse qu'on attend ici.
    fill('forgot-identifier', '06 12');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
      'Entrez une adresse e-mail valide.',
    );

    fill('forgot-identifier', 'neo@');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
      'Entrez une adresse e-mail valide.',
    );
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('un numéro de téléphone : la récupération par SMS arrive bientôt, et rien ne part', async () => {
    const requestPasswordReset = jest.fn();
    useAuthStore.setState({ requestPasswordReset });
    render(<ForgotPasswordScreen />);

    for (const phone of ['06 12 34 56 78', '+33 6 12 34 56 78']) {
      fill('forgot-identifier', phone);
      fireEvent.press(screen.getByTestId('forgot-submit'));
      expect(await screen.findByTestId('forgot-identifier-error')).toHaveTextContent(
        'La récupération par SMS arrive bientôt. Entrez l’adresse e-mail de votre compte.',
      );
    }
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByTestId('forgot-request')).toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-code-step')).toBeNull();
  });

  it('n’affirme jamais qu’un compte existe, et masque l’adresse : « Si un compte existe… »', async () => {
    const requestPasswordReset = jest.fn().mockResolvedValue({ ok: true, email: 'neo@exemple.fr' });
    useAuthStore.setState({ requestPasswordReset });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', '  Neo@Exemple.fr ');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    const step = await screen.findByTestId('forgot-code-step');
    expect(step).toHaveTextContent(/Si un compte existe pour n•••@exemple\.fr/);
    expect(step).not.toHaveTextContent(/Nous avons envoyé/);
    expect(screen.queryByText(/neo@exemple\.fr/i)).toBeNull();
    // L'adresse part nettoyée : sans espaces, en minuscules.
    expect(requestPasswordReset).toHaveBeenCalledWith('neo@exemple.fr');
  });

  it.each<[string, string | RegExp]>([
    ['rate_limited', /Trop de tentatives/],
    ['email_unavailable', 'L’e-mail n’a pas pu partir. Réessayez dans quelques minutes.'],
  ])('un refus du serveur (%s) s’affiche, et l’écran reste sur l’étape', async (error, message) => {
    useAuthStore.setState({
      requestPasswordReset: jest.fn().mockResolvedValue({ ok: false, error }),
    });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));

    expect(await screen.findByTestId('forgot-error')).toHaveTextContent(message);
    expect(screen.getByTestId('forgot-request')).toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-code-step')).toBeNull();
    expect(stateOf('forgot-submit')).toMatchObject({ busy: false, disabled: false });
  });

  it('le bouton retour ramène à la connexion', async () => {
    const onBack = jest.fn();
    render(<ForgotPasswordScreen onBack={onBack} />);
    fireEvent.press(screen.getByTestId('forgot-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    await settle();
  });
});

describe('<ForgotPasswordScreen /> — le code', () => {
  it('vérifie le code pour l’adresse de l’étape, nettoyée', async () => {
    const verifyResetCode = jest.fn().mockResolvedValue({ ok: true });
    useAuthStore.setState({ verifyResetCode });
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', ' Neo@Exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-code-step')).toHaveTextContent(/n•••@exemple\.fr/);

    fill('forgot-code-input', '654321');
    await screen.findByTestId('forgot-password-step');
    expect(verifyResetCode).toHaveBeenCalledWith('neo@exemple.fr', '654321');
  });

  it('« Changer d’adresse e-mail » revient à la première étape', async () => {
    render(<ForgotPasswordScreen />);
    fill('forgot-identifier', 'neo@exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    await screen.findByTestId('forgot-code-step');

    const back = screen.getByTestId('forgot-code-back');
    expect(back).toHaveTextContent('Changer d’adresse e-mail');
    expect(back.props.accessibilityLabel).toBe('Changer d’adresse e-mail');
    fireEvent.press(back);
    expect(await screen.findByTestId('forgot-request')).toBeOnTheScreen();
  });

  it('« Renvoyer le code », une fois le délai écoulé, redemande un code pour la même adresse', async () => {
    jest.useFakeTimers();
    try {
      const requestPasswordReset = jest
        .fn()
        .mockResolvedValue({ ok: true, email: 'neo@exemple.fr' });
      useAuthStore.setState({ requestPasswordReset });
      render(<ForgotPasswordScreen />);
      fill('forgot-identifier', 'Neo@Exemple.fr');
      fireEvent.press(screen.getByTestId('forgot-submit'));
      await screen.findByTestId('forgot-code-step');

      // Le délai imposé par le serveur (60 s), seconde par seconde, comme le décompte de l'écran.
      for (let s = 0; s < 60; s += 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }
      fireEvent.press(screen.getByTestId('forgot-code-resend'));

      expect(await screen.findByTestId('forgot-code-resent')).toBeOnTheScreen();
      expect(requestPasswordReset).toHaveBeenCalledTimes(2);
      expect(requestPasswordReset).toHaveBeenLastCalledWith('neo@exemple.fr');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('<ForgotPasswordScreen /> — le parcours complet (démonstration)', () => {
  it('e-mail → code → nouveau mot de passe → connecté', async () => {
    const onDone = jest.fn();
    render(<ForgotPasswordScreen onDone={onDone} />);

    fill('forgot-identifier', 'Neo@Exemple.fr');
    fireEvent.press(screen.getByTestId('forgot-submit'));
    expect(await screen.findByTestId('forgot-code-step')).toHaveTextContent(
      /Si un compte existe pour n•••@exemple\.fr/,
    );
    expect(screen.getByTestId('forgot-code-demo')).toHaveTextContent(new RegExp(DEMO_CODE));

    // Un code faux : message, et on reste sur l'étape.
    fill('forgot-code-input', '000000');
    expect(await screen.findByTestId('forgot-code-error')).toHaveTextContent(/code incorrect/i);
    expect(useAuthStore.getState().session).toBeNull();

    fill('forgot-code-input', DEMO_CODE);
    await screen.findByTestId('forgot-password-step');
    // Le bon code ouvre une session pour CETTE adresse : c'est elle qui autorise le changement.
    expect(useAuthStore.getState().session?.user.email).toBe('neo@exemple.fr');

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
