import {
  EMPTY_REGISTRATION,
  needsSiret,
  toProfile,
  validateRegistration,
  type RegistrationDraft,
} from '../model/registration';

const VALID_SIRET = '44306184100047';

const draft = (over: Partial<RegistrationDraft> = {}): RegistrationDraft => ({
  ...EMPTY_REGISTRATION,
  firstName: 'Sofiane',
  lastName: 'Terki',
  email: 'sofiane@example.com',
  phone: '06 12 34 56 78',
  password: 'motdepasse1',
  confirm: 'motdepasse1',
  location: 'Toulouse',
  ...over,
});

describe('validateRegistration — CDC §5', () => {
  it('accepte un formulaire complet', () => {
    expect(validateRegistration(draft())).toEqual({});
  });

  it('exige les sept champs du CDC', () => {
    const errors = validateRegistration(EMPTY_REGISTRATION);
    for (const field of ['firstName', 'lastName', 'email', 'phone', 'password', 'location']) {
      expect(errors[field]).toBeDefined();
    }
  });

  it('refuse deux mots de passe différents, et le dit sur le bon champ', () => {
    const errors = validateRegistration(draft({ confirm: 'autre chose' }));
    // L’erreur doit tomber sur la confirmation, pas sur le mot de passe :
    // c’est la confirmation que l’utilisateur doit corriger.
    expect(errors.confirm).toBeDefined();
    expect(errors.password).toBeUndefined();
  });

  it('refuse un mot de passe trop court', () => {
    expect(validateRegistration(draft({ password: 'court', confirm: 'court' })).password).toContain(
      '8',
    );
  });

  it('accepte les formats de téléphone français courants', () => {
    for (const phone of ['0612345678', '06 12 34 56 78', '+33 6 12 34 56 78', '06.12.34.56.78']) {
      expect(validateRegistration(draft({ phone })).phone).toBeUndefined();
    }
  });

  it('refuse un téléphone qui n’en est pas un', () => {
    expect(validateRegistration(draft({ phone: '12345' })).phone).toBeDefined();
    expect(validateRegistration(draft({ phone: '0012345678' })).phone).toBeDefined();
  });

  it('n’affiche qu’une erreur par champ', () => {
    const errors = validateRegistration(draft({ email: 'pas-un-email' }));
    expect(Object.keys(errors)).toEqual(['email']);
  });
});

describe('SIRET à l’inscription — CDC §5', () => {
  it('n’est PAS obligatoire : on s’inscrit et on consulte sans lui', () => {
    // Le CDC réserve l’exigence à la commande, pas à l’inscription.
    expect(validateRegistration(draft({ siret: '' })).siret).toBeUndefined();
  });

  it('mais s’il est saisi, il doit être vrai', () => {
    expect(validateRegistration(draft({ siret: '12345678901234' })).siret).toBeDefined();
    expect(validateRegistration(draft({ siret: VALID_SIRET })).siret).toBeUndefined();
  });

  it('tolère la mise en forme à la saisie', () => {
    expect(validateRegistration(draft({ siret: '443 061 841 00047' })).siret).toBeUndefined();
  });

  it('ne se montre qu’aux professionnels', () => {
    expect(needsSiret('consommateur')).toBe(false);
    expect(needsSiret('commercant')).toBe(true);
    expect(needsSiret('grossiste')).toBe(true);
  });
});

describe('toProfile', () => {
  it('normalise ce qui sera stocké', () => {
    const p = toProfile(
      draft({
        email: '  Sofiane@Example.COM ',
        firstName: ' Sofiane ',
        siret: '443 061 841 00047',
      }),
    );
    expect(p.email).toBe('sofiane@example.com');
    expect(p.firstName).toBe('Sofiane');
    expect(p.siret).toBe(VALID_SIRET);
  });

  it('n’emporte JAMAIS le mot de passe', () => {
    // Un mot de passe dans un store persisté, c’est un mot de passe en clair
    // sur le disque. Il part au fournisseur d’auth et nulle part ailleurs.
    expect(toProfile(draft())).not.toHaveProperty('password');
    expect(toProfile(draft())).not.toHaveProperty('confirm');
  });

  it('représente l’absence de SIRET par null, pas par une chaîne vide', () => {
    expect(toProfile(draft({ siret: '' })).siret).toBeNull();
  });
});
