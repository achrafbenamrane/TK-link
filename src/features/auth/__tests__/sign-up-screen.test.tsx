import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { EMPTY_REGISTRATION, validateRegistration } from '../model/registration';
import { useAuthStore } from '../model/store';
import { SignUpScreen } from '../ui/sign-up-screen';

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

beforeEach(() => {
  useAuthStore.setState({ error: null });
});

describe('validateRegistration — le professionnel', () => {
  const base = {
    ...EMPTY_REGISTRATION,
    firstName: 'Neo',
    lastName: 'Test',
    email: 'neo@exemple.fr',
    phone: '06 12 34 56 78',
    password: 'motdepasse1',
    confirm: 'motdepasse1',
  };

  it('exige le nom du commerce, sa catégorie et son adresse', () => {
    const errors = validateRegistration(base, 'commercant');
    expect(errors.shopName).toBeDefined();
    expect(errors.category).toBeDefined();
    expect(errors.address).toBeDefined();
  });

  it('n’exige rien de tout cela d’un consommateur', () => {
    expect(validateRegistration(base, 'consommateur')).toEqual({});
  });

  it('laisse le SIRET facultatif : le CDC ne l’exige qu’au moment de publier ou commander en B2B', () => {
    const pro = {
      ...base,
      shopName: 'O’Tokyo',
      category: 'restauration',
      address: '12 rue des Arts',
    };
    expect(validateRegistration(pro, 'commercant')).toEqual({});
  });

  it('refuse une catégorie qui n’est pas l’une des huit du CDC', () => {
    const pro = {
      ...base,
      shopName: 'O’Tokyo',
      category: 'alimentation',
      address: '12 rue des Arts',
    };
    expect(validateRegistration(pro, 'commercant').category).toBeDefined();
  });
});

describe('<SignUpScreen /> — consommateur', () => {
  it('exige d’accepter les CGU avant de créer le compte', async () => {
    const onSignedUp = jest.fn();
    render(<SignUpScreen role="consommateur" onSignedUp={onSignedUp} />);
    fill('signup-firstname', 'Neo');
    fill('signup-lastname', 'Test');
    fill('signup-email', 'neo@exemple.fr');
    fill('signup-phone', '06 12 34 56 78');
    fill('signup-password', 'motdepasse1');
    fill('signup-confirm', 'motdepasse1');

    fireEvent.press(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(screen.getByTestId('signup-terms-error')).toBeTruthy());
    expect(onSignedUp).not.toHaveBeenCalled();
  });

  it('ne montre ni commerce, ni catégorie, ni onglets Commerçant / Grossiste', () => {
    render(<SignUpScreen role="consommateur" />);
    expect(screen.queryByTestId('signup-shopname')).toBeNull();
    expect(screen.queryByTestId('signup-role-commercant')).toBeNull();
    expect(screen.queryByTestId('signup-free-ops')).toBeNull();
  });

  it('laisse la ville facultative', async () => {
    const onProfile = jest.fn();
    render(<SignUpScreen role="consommateur" onProfile={onProfile} onSignedUp={jest.fn()} />);
    fill('signup-firstname', 'Neo');
    fill('signup-lastname', 'Test');
    fill('signup-email', 'neo@exemple.fr');
    fill('signup-phone', '06 12 34 56 78');
    fill('signup-password', 'motdepasse1');
    fill('signup-confirm', 'motdepasse1');
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onProfile).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('signup-location-error')).toBeNull();
  });
});

/** Les coordonnées et le mot de passe d'un professionnel — tout est sur la même page. */
function proStepOne() {
  fill('signup-firstname', 'Neo');
  fill('signup-lastname', 'Test');
  fill('signup-email', 'pro@exemple.fr');
  fill('signup-phone', '06 12 34 56 78');
  fill('signup-password', 'motdepasse1');
  fill('signup-confirm', 'motdepasse1');
}

describe('<SignUpScreen /> — commerçant et grossiste', () => {
  it('ne propose plus de bascule de rôle : le profil est choisi avant, et les 5 opérations gratuites sont celles du commerçant', () => {
    const { unmount } = render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('signup-role-grossiste')).toBeNull();
    expect(screen.getAllByText('Créer mon compte commerçant').length).toBeGreaterThan(0);
    // « 5 » vient du paramètre administrable, pas d'une constante du code (CDC §6.2).
    expect(screen.getByTestId('signup-free-ops')).toHaveTextContent(/5 opérations Flash/);
    unmount();

    render(<SignUpScreen role="grossiste" />);
    expect(screen.getAllByText('Créer mon compte grossiste').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('signup-free-ops')).toBeNull();
  });

  it('propose Touch & Collect et Livraison — « Sur place » n’existe pas dans le CDC', () => {
    render(<SignUpScreen role="commercant" />);
    proStepOne();
    expect(screen.getByTestId('signup-mode-touch-collect')).toBeTruthy();
    expect(screen.getByTestId('signup-mode-livraison')).toBeTruthy();
    expect(screen.queryByText('Sur place')).toBeNull();
  });

  it('transmet la fiche du commerce à la route', async () => {
    const onProfile = jest.fn();
    render(<SignUpScreen role="commercant" onProfile={onProfile} onSignedUp={jest.fn()} />);
    proStepOne();
    fill('signup-shopname', 'O’Tokyo');
    fireEvent.press(screen.getByTestId('signup-category-open'));
    fireEvent.press(screen.getByTestId('signup-category-restauration'));
    fill('signup-address', '12 rue des Arts, Toulouse');
    fireEvent.press(screen.getByTestId('signup-mode-livraison'));
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(onProfile).toHaveBeenCalledTimes(1));
    expect(onProfile.mock.calls[0]![0]).toMatchObject({
      shopName: 'O’Tokyo',
      category: 'restauration',
      address: '12 rue des Arts, Toulouse',
      modes: ['touch-collect', 'livraison'],
    });
  });

  it('exige au moins un mode de remise', async () => {
    render(<SignUpScreen role="commercant" />);
    proStepOne();
    fireEvent.press(screen.getByTestId('signup-mode-touch-collect')); // décoche le défaut
    fireEvent.press(screen.getByTestId('signup-terms'));
    fireEvent.press(screen.getByTestId('signup-submit'));

    await waitFor(() => expect(screen.getByTestId('signup-modes-error')).toBeTruthy());
  });
});

describe('<SignUpScreen /> — une seule page', () => {
  it('un professionnel a TOUS ses champs sur la même page, sans étape', () => {
    render(<SignUpScreen role="commercant" />);
    for (const id of [
      'firstname',
      'lastname',
      'email',
      'phone',
      'shopname',
      'siret',
      'address',
      'location',
      'password',
      'confirm',
    ]) {
      expect(screen.getByTestId(`signup-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('signup-category-open')).toBeTruthy();
    expect(screen.queryByTestId('signup-next')).toBeNull();
  });

  it('la catégorie est une liste déroulante', () => {
    render(<SignUpScreen role="commercant" />);
    expect(screen.queryByTestId('signup-category-list')).toBeNull();
    fireEvent.press(screen.getByTestId('signup-category-open'));
    expect(screen.getByTestId('signup-category-list')).toBeTruthy();
    fireEvent.press(screen.getByTestId('signup-category-mode'));
    expect(screen.queryByTestId('signup-category-list')).toBeNull();
  });

  it('un consommateur a tous ses champs sur la même page, sans étape', () => {
    render(<SignUpScreen role="consommateur" />);
    for (const id of [
      'firstname',
      'lastname',
      'email',
      'phone',
      'password',
      'confirm',
      'location',
    ]) {
      expect(screen.getByTestId(`signup-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('signup-next')).toBeNull();
  });
});

describe('<SignUpScreen /> — le grossiste parle de retrait et d’expédition', () => {
  it('ne propose pas « Touch & Collect », mot du commerce', () => {
    render(<SignUpScreen role="grossiste" />);
    expect(screen.getByLabelText('Retrait')).toBeTruthy();
    expect(screen.getByLabelText('Expédition')).toBeTruthy();
    expect(screen.queryByLabelText('Touch & Collect')).toBeNull();
  });

  it('garde « Touch & Collect » et « Livraison » pour le commerçant', () => {
    render(<SignUpScreen role="commercant" />);
    expect(screen.getByLabelText('Touch & Collect')).toBeTruthy();
    expect(screen.getByLabelText('Livraison')).toBeTruthy();
  });
});
