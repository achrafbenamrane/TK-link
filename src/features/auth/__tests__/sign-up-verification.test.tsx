import { useState } from 'react';
import { Pressable } from 'react-native';

import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import * as apple from '../model/social/apple';
import { useAuthStore, type AuthResult } from '../model/store';
import { SignUpScreen } from '../ui/sign-up-screen';
import { needsFollowUp, SignUpVerification } from '../ui/sign-up-verification';

/**
 * Ce qui suit l'inscription quand un VRAI serveur est branché : le code reçu par e-mail, puis
 * l'association du numéro au compte — automatique, SANS code SMS (décision du 24/10/2026). Le store
 * est simulé action par action ; on vérifie l'enchaînement des écrans et ce que chaque étape envoie,
 * pas Supabase.
 */

/** Le store range la session de démonstration dans le stockage sécurisé : rien de natif sous Jest. */
jest.mock('@/shared/lib/storage', () => ({
  ...jest.requireActual('@/shared/lib/storage'),
  secureStorage: {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    remove: () => Promise.resolve(),
  },
}));

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

const fillValidForm = () => {
  fill('signup-firstname', 'Neo');
  fill('signup-lastname', 'Démo');
  fill('signup-email', 'Neo@Exemple.fr');
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-password', 'motdepasse1');
  fill('signup-confirm', 'motdepasse1');
  fireEvent.press(screen.getByTestId('signup-terms'));
};

/** Une réponse qu'on donne à la main : pour voir l'écran PENDANT l'appel. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const original = useAuthStore.getState();
const ok = { ok: true } as const;

beforeEach(() => {
  // Un vrai serveur est branché (le test tourne sans variables Supabase, donc on bascule à la main).
  useAuthStore.setState({
    demoMode: false,
    session: null,
    status: 'unauthenticated',
    error: null,
    signUp: jest.fn().mockResolvedValue({ ok: true, needsCode: false }),
    confirmSignUp: jest.fn().mockResolvedValue(ok),
    resendSignUpCode: jest.fn().mockResolvedValue(ok),
    linkPhone: jest.fn().mockResolvedValue(ok),
    signInWithGoogle: original.signInWithGoogle,
    signInWithApple: original.signInWithApple,
  });
});

afterEach(() => jest.restoreAllMocks());

afterAll(() => useAuthStore.setState({ demoMode: original.demoMode }));

describe('inscription → e-mail à confirmer', () => {
  beforeEach(() => {
    useAuthStore.setState({ signUp: jest.fn().mockResolvedValue({ ok: true, needsCode: true }) });
  });

  it('envoie le profil avec le compte : prénom, nom, numéro en E.164, type de compte', async () => {
    render(<SignUpScreen role="commercant" onSignedUp={jest.fn()} />);
    // Un commerçant remplit aussi sa fiche.
    fillValidForm();
    fill('signup-shopname', 'Le Comptoir');
    fireEvent.press(screen.getByTestId('signup-category-open'));
    fireEvent.press(screen.getByTestId('signup-category-restauration'));
    fill('signup-address', '12 rue des Arts');
    fireEvent.press(screen.getByTestId('signup-submit'));

    await screen.findByTestId('verify-email-step');
    expect(useAuthStore.getState().signUp).toHaveBeenCalledWith('neo@exemple.fr', 'motdepasse1', {
      firstName: 'Neo',
      lastName: 'Démo',
      phone: '+33612345678',
      accountType: 'commercant',
    });
  });

  it('montre la saisie du code, avec l’adresse MASQUÉE, à la place du formulaire', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('verify-email-step')).toHaveTextContent(/n•••@exemple.fr/);
    expect(screen.queryByTestId('sign-up-screen')).toBeNull();
    expect(screen.queryByText(/neo@exemple\.fr/)).toBeNull();
  });

  it('un code faux affiche l’erreur et vide le champ ; on peut réessayer', async () => {
    useAuthStore.setState({
      confirmSignUp: jest
        .fn()
        .mockImplementationOnce(async () => ({ ok: false, error: 'otp_invalid' }))
        .mockResolvedValueOnce(ok),
    });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    fill('verify-email-input', '000000');
    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(
      /code incorrect ou expiré/i,
    );
    expect(screen.getByTestId('verify-email-input').props.value).toBe('');
    // Un code refusé n'ouvre pas de session : rien à associer.
    expect(useAuthStore.getState().linkPhone).not.toHaveBeenCalled();

    // Saisir à nouveau efface l'erreur.
    fill('verify-email-input', '123');
    expect(screen.queryByTestId('verify-email-error')).toBeNull();
  });

  it('le sixième chiffre envoie le code tout seul, une seule fois', async () => {
    const pending = deferred<AuthResult>();
    const confirmSignUp = jest.fn(() => pending.promise);
    useAuthStore.setState({ confirmSignUp });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    // Cinq chiffres : rien ne part. Le bouton reste inactif.
    fill('verify-email-input', '12345');
    expect(confirmSignUp).not.toHaveBeenCalled();
    expect(screen.getByTestId('verify-email-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // Le sixième : le code part tout seul, AVANT tout appui sur le bouton…
    fill('verify-email-input', '123456');
    expect(confirmSignUp).toHaveBeenCalledTimes(1);
    expect(confirmSignUp).toHaveBeenCalledWith('neo@exemple.fr', '123456');
    // … et un appui pendant l'envoi ne le renvoie pas.
    expect(screen.getByTestId('verify-email-submit')).toBeBusy();
    fireEvent.press(screen.getByTestId('verify-email-submit'));
    await act(async () => pending.resolve(ok));
    expect(confirmSignUp).toHaveBeenCalledTimes(1);
  });

  it('code valide : le numéro s’associe ensuite tout seul, puis on entre', async () => {
    const confirmSignUp = jest.fn().mockResolvedValue(ok);
    const pending = deferred<AuthResult>();
    const linkPhone = jest.fn(() => pending.promise);
    useAuthStore.setState({ confirmSignUp, linkPhone });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');
    // Pas de session tant que l'adresse n'est pas confirmée : le numéro attend.
    expect(linkPhone).not.toHaveBeenCalled();

    fill('verify-email-input', '123456');
    expect(await screen.findByTestId('verify-phone-linking')).toHaveTextContent(
      /[+]33 ••• •• •• 78/,
    );
    expect(confirmSignUp).toHaveBeenCalledWith('neo@exemple.fr', '123456');
    expect(linkPhone).toHaveBeenCalledTimes(1);
    expect(linkPhone).toHaveBeenCalledWith('+33612345678');
    expect(onSignedUp).not.toHaveBeenCalled();

    await act(async () => pending.resolve(ok));
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
  });

  it('« Modifier mon adresse e-mail » ramène au formulaire', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    fireEvent.press(screen.getByTestId('verify-email-back'));
    expect(await screen.findByTestId('sign-up-screen')).toBeOnTheScreen();
  });

  it('renvoyer le code est bloqué pendant le délai du serveur', async () => {
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('verify-email-step');

    expect(screen.getByTestId('verify-email-resend').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('verify-email-resend')).toHaveTextContent(/dans \d+ s/);
  });
});

describe('inscription → numéro à associer', () => {
  it('session ouverte d’emblée : le numéro s’associe tout seul, sans code, puis on entre', async () => {
    const pending = deferred<AuthResult>();
    const linkPhone = jest.fn(() => pending.promise);
    useAuthStore.setState({ linkPhone });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    // Un indicateur avec le numéro masqué — et aucun code à saisir.
    expect(await screen.findByTestId('verify-phone-linking')).toHaveTextContent(
      /[+]33 ••• •• •• 78/,
    );
    expect(screen.queryByTestId('verify-email-step')).toBeNull();
    expect(linkPhone).toHaveBeenCalledWith('+33612345678');
    expect(onSignedUp).not.toHaveBeenCalled();

    await act(async () => pending.resolve(ok));
    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(linkPhone).toHaveBeenCalledTimes(1);
  });

  it('un numéro déjà pris ne bloque jamais : message clair, « Continuer » laisse entrer', async () => {
    const linkPhone = jest.fn().mockResolvedValue({ ok: false, error: 'phone_taken' });
    useAuthStore.setState({ linkPhone });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('verify-phone-failed')).toHaveTextContent(
      /Votre compte est créé/,
    );
    expect(screen.getByTestId('verify-phone-error')).toHaveTextContent(
      'Ce numéro est déjà associé à un autre compte. Connectez-vous avec votre e-mail.',
    );
    expect(screen.queryByTestId('verify-phone-linking')).toBeNull();
    expect(onSignedUp).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('verify-phone-continue'));
    expect(onSignedUp).toHaveBeenCalledTimes(1);
    // « Continuer » ne retente pas : le numéro se règle depuis « Mon compte ».
    expect(linkPhone).toHaveBeenCalledTimes(1);
    // La suite terminée, le bouton cesse de tourner.
    await waitFor(() => expect(screen.getByTestId('verify-phone-continue')).not.toBeBusy());
    expect(onSignedUp).toHaveBeenCalledTimes(1);
  });

  it('« Réessayer » relance l’association, et entre quand elle aboutit', async () => {
    const linkPhone = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce(ok);
    useAuthStore.setState({ linkPhone });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByTestId('verify-phone-error')).toHaveTextContent(/réseau/);
    expect(onSignedUp).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('verify-phone-retry'));
    // L'indicateur revient pendant le nouvel essai.
    expect(screen.getByTestId('verify-phone-linking')).toBeOnTheScreen();
    expect(screen.queryByTestId('verify-phone-failed')).toBeNull();

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(linkPhone).toHaveBeenCalledTimes(2);
    expect(linkPhone).toHaveBeenLastCalledWith('+33612345678');
  });
});

/**
 * Un parent qui se redessine — et recrée donc `onDone` — à la demande, comme `SignUpScreen` à chaque
 * changement du store. `onDone` reçoit le numéro du rendu qui l'a créé.
 */
function Rerendering({ onDone }: { onDone: (render: number) => void }) {
  const [renders, setRenders] = useState(0);
  return (
    <>
      <Pressable
        testID="verify-parent-rerender"
        accessibilityRole="button"
        onPress={() => setRenders((n) => n + 1)}
      />
      <SignUpVerification
        email="neo@exemple.fr"
        phone="+33612345678"
        needsEmailCode={false}
        phoneEnabled
        onDone={() => onDone(renders)}
        onBack={() => undefined}
      />
    </>
  );
}

describe('<SignUpVerification /> — seul', () => {
  it.each([
    { cas: 'connexion par numéro désactivée', phone: '+33612345678', phoneEnabled: false },
    { cas: 'aucun numéro saisi', phone: '', phoneEnabled: true },
  ])('$cas : le code e-mail confirmé suffit, rien à associer', async ({ phone, phoneEnabled }) => {
    const onDone = jest.fn();
    render(
      <SignUpVerification
        email="neo@exemple.fr"
        phone={phone}
        needsEmailCode
        phoneEnabled={phoneEnabled}
        onDone={onDone}
        onBack={jest.fn()}
      />,
    );

    fill('verify-email-input', '123456');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().linkPhone).not.toHaveBeenCalled();
    expect(screen.queryByTestId('verify-phone-linking')).toBeNull();
  });

  it('le parent se redessine pendant l’association : un seul appel, et sa dernière version répond', async () => {
    const pending = deferred<AuthResult>();
    const linkPhone = jest.fn(() => pending.promise);
    useAuthStore.setState({ linkPhone });
    const onDone = jest.fn();
    render(<Rerendering onDone={onDone} />);

    expect(screen.getByTestId('verify-phone-linking')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('verify-parent-rerender'));
    fireEvent.press(screen.getByTestId('verify-parent-rerender'));
    await act(async () => pending.resolve(ok));

    expect(linkPhone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(2);
  });

  it('« Continuer » attend la suite : il patiente, et deux appuis ne la lancent qu’une fois', async () => {
    useAuthStore.setState({
      linkPhone: jest.fn().mockResolvedValue({ ok: false, error: 'phone_taken' }),
    });
    const leaving = deferred<void>();
    const onDone = jest.fn(() => leaving.promise);
    render(
      <SignUpVerification
        email="neo@exemple.fr"
        phone="+33612345678"
        needsEmailCode={false}
        phoneEnabled
        onDone={onDone}
        onBack={jest.fn()}
      />,
    );
    await screen.findByTestId('verify-phone-failed');
    expect(screen.getByTestId('verify-phone-continue')).not.toBeBusy();

    fireEvent.press(screen.getByTestId('verify-phone-continue'));
    expect(onDone).toHaveBeenCalledTimes(1);
    // La route relit le profil : le bouton tourne, et un second appui ne relance rien.
    expect(screen.getByTestId('verify-phone-continue')).toBeBusy();
    expect(screen.getByTestId('verify-phone-continue')).toBeDisabled();
    fireEvent.press(screen.getByTestId('verify-phone-continue'));
    expect(onDone).toHaveBeenCalledTimes(1);

    await act(async () => leaving.resolve());
    // La suite a abouti : le bouton ne tourne plus (la route a normalement déjà quitté l'écran).
    expect(screen.getByTestId('verify-phone-continue')).not.toBeBusy();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('« Continuer » en cours, puis une association réussie : la suite ne part qu’une fois', async () => {
    const retried = deferred<AuthResult>();
    const linkPhone = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockImplementationOnce(() => retried.promise);
    useAuthStore.setState({ linkPhone });
    const leaving = deferred<void>();
    const onDone = jest.fn(() => leaving.promise);
    render(
      <SignUpVerification
        email="neo@exemple.fr"
        phone="+33612345678"
        needsEmailCode={false}
        phoneEnabled
        onDone={onDone}
        onBack={jest.fn()}
      />,
    );
    await screen.findByTestId('verify-phone-failed');

    // « Continuer » part (la route n'a pas fini), puis « Réessayer » : le second chemin vers la suite.
    fireEvent.press(screen.getByTestId('verify-phone-continue'));
    fireEvent.press(screen.getByTestId('verify-phone-retry'));
    await act(async () => retried.resolve(ok));

    expect(linkPhone).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    await act(async () => leaving.resolve());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('code e-mail sans numéro : le code reste « en cours » jusqu’au bout de la suite, envoyé une fois', async () => {
    const confirmSignUp = jest.fn().mockResolvedValue(ok);
    useAuthStore.setState({ confirmSignUp });
    const leaving = deferred<void>();
    const onDone = jest.fn(() => leaving.promise);
    render(
      <SignUpVerification
        email="neo@exemple.fr"
        phone=""
        needsEmailCode
        phoneEnabled
        onDone={onDone}
        onBack={jest.fn()}
      />,
    );

    fill('verify-email-input', '123456');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    // Le code est consommé, la route poursuit : l'étape reste occupée, rien ne peut repartir.
    expect(screen.getByTestId('verify-email-submit')).toBeBusy();
    expect(screen.getByTestId('verify-email-submit')).toBeDisabled();
    expect(screen.getByTestId('verify-email-input')).toHaveProp('editable', false);
    fireEvent.press(screen.getByTestId('verify-email-submit'));
    await act(async () => undefined);
    expect(confirmSignUp).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);

    await act(async () => leaving.resolve());
    expect(screen.getByTestId('verify-email-submit')).not.toBeBusy();
    expect(confirmSignUp).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().linkPhone).not.toHaveBeenCalled();
  });

  it('écran quitté pendant l’association : la réponse tardive ne fait plus entrer', async () => {
    const pending = deferred<AuthResult>();
    const linkPhone = jest.fn(() => pending.promise);
    useAuthStore.setState({ linkPhone });
    const onDone = jest.fn();
    const { unmount } = render(
      <SignUpVerification
        email="neo@exemple.fr"
        phone="+33612345678"
        needsEmailCode={false}
        phoneEnabled
        onDone={onDone}
        onBack={jest.fn()}
      />,
    );
    expect(linkPhone).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => pending.resolve(ok));
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('needsFollowUp — y a-t-il une suite à l’inscription ?', () => {
  it.each([
    { needsEmailCode: true, phone: '+33612345678', phoneEnabled: true, expected: true },
    { needsEmailCode: true, phone: '+33612345678', phoneEnabled: false, expected: true },
    { needsEmailCode: true, phone: '', phoneEnabled: true, expected: true },
    { needsEmailCode: true, phone: '', phoneEnabled: false, expected: true },
    { needsEmailCode: false, phone: '+33612345678', phoneEnabled: true, expected: true },
    { needsEmailCode: false, phone: '+33612345678', phoneEnabled: false, expected: false },
    { needsEmailCode: false, phone: '', phoneEnabled: true, expected: false },
    { needsEmailCode: false, phone: '', phoneEnabled: false, expected: false },
  ])(
    'code e-mail : $needsEmailCode, numéro : « $phone », connexion par numéro : $phoneEnabled → $expected',
    ({ needsEmailCode, phone, phoneEnabled, expected }) => {
      expect(needsFollowUp({ needsEmailCode, phone, phoneEnabled })).toBe(expected);
    },
  );
});

describe('inscription en démonstration', () => {
  it('n’impose ni code ni association : le numéro est déjà dans la session, on entre directement', async () => {
    useAuthStore.setState({ demoMode: true, signUp: original.signUp });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    // La démonstration range le numéro dans la session, déjà associé : rien à faire ensuite.
    expect(useAuthStore.getState().session?.user.phone).toBe('33612345678');
    expect(useAuthStore.getState().linkPhone).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sign-up-verification')).toBeNull();
  });
});

describe('inscription avec Google ou Apple', () => {
  it('exige d’accepter les CGU, comme pour le formulaire', async () => {
    const signInWithGoogle = jest.fn();
    useAuthStore.setState({ demoMode: true, signInWithGoogle });
    render(<SignUpScreen role="consommateur" onSignedUp={jest.fn()} />);

    // Le mode de la démonstration affiche les deux ; les tests tournent sur iOS.
    fireEvent.press(screen.getByTestId('auth-google'));
    expect(await screen.findByTestId('signup-terms-error')).toBeTruthy();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('une fois les CGU acceptées : ouvre la session et range le prénom', async () => {
    useAuthStore.setState({
      demoMode: true,
      signInWithGoogle: jest.fn().mockResolvedValue({
        ok: true,
        isNewUser: true,
        firstName: 'Sofia',
        lastName: 'Rey',
        email: 'sofia.rey@gmail.com',
      }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(onProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Sofia',
        lastName: 'Rey',
        email: 'sofia.rey@gmail.com',
        category: '',
      }),
    );
  });

  it('Apple sans nom, formulaire vierge : le nom reste vide, mais l’inscription aboutit', async () => {
    useAuthStore.setState({
      demoMode: true,
      signInWithApple: jest.fn().mockResolvedValue({
        ok: true,
        isNewUser: true,
        firstName: '',
        lastName: '',
        email: 'x7k2@privaterelay.appleid.com',
      }),
    });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-apple'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    // Ni Apple ni le formulaire ne donnent de nom : il reste vide, sans bloquer l'entrée.
    expect(onProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: '',
        lastName: '',
        email: 'x7k2@privaterelay.appleid.com',
      }),
    );
  });

  it('Apple sans nom, vrai serveur : le numéro saisi s’associe, puis l’inscription aboutit', async () => {
    // Hors démonstration, le bouton Apple n'apparaît que si le système l'offre (iPhone).
    jest.spyOn(apple, 'isAppleAvailable').mockResolvedValue(true);
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: true,
      isNewUser: true,
      firstName: '',
      lastName: '',
      email: 'x7k2@privaterelay.appleid.com',
    });
    useAuthStore.setState({ signInWithApple });
    const onProfile = jest.fn();
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={onSignedUp} />);
    await screen.findByTestId('auth-apple');

    fill('signup-phone', '06 12 34 56 78');
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-apple'));

    await waitFor(() => expect(onSignedUp).toHaveBeenCalledTimes(1));
    expect(signInWithApple).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().linkPhone).toHaveBeenCalledWith('+33612345678');
    expect(onProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: '',
        lastName: '',
        email: 'x7k2@privaterelay.appleid.com',
        phone: '06 12 34 56 78',
      }),
    );
  });

  it('fenêtre fermée : on reste sur le formulaire', async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue({ ok: false, error: 'cancelled' });
    useAuthStore.setState({ demoMode: true, signInWithGoogle });
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);

    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('auth-google'));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
    expect(onSignedUp).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-up-screen')).toBeOnTheScreen();
  });

  it('un commerçant n’a pas Google ni Apple : sa fiche professionnelle exige un e-mail pro', () => {
    // La démonstration offre les deux partout : s'ils manquent ici, c'est le rôle qui les retire.
    useAuthStore.setState({ demoMode: true });
    render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('auth-google')).toBeNull();
    expect(screen.queryByTestId('auth-apple')).toBeNull();
  });
});
