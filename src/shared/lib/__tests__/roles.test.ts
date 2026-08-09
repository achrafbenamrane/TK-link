import {
  audienceOf,
  canPublishOffers,
  canSeeOffersFrom,
  formatSiret,
  isValidSiret,
  normalizeSiret,
  ROLES,
  ROLE_LABEL,
  sirenOf,
  wholesaleOrderBlock,
} from '../roles';

describe('rôles — CDC §3', () => {
  it('expose exactement les trois rôles de l’app', () => {
    // Le livreur est une app distincte (CDC §3.4) : il n’a rien à faire ici.
    expect([...ROLES]).toEqual(['consommateur', 'commercant', 'grossiste']);
  });

  it('libelle chaque rôle', () => {
    for (const r of ROLES) expect(ROLE_LABEL[r].length).toBeGreaterThan(0);
  });
});

describe('visibilité des offres — CDC §3.1, §3.2, §20', () => {
  it('le consommateur voit les commerçants, le commerçant voit les grossistes', () => {
    expect(audienceOf('consommateur')).toBe('commercant');
    expect(audienceOf('commercant')).toBe('grossiste');
  });

  it('le grossiste publie, il ne consulte personne', () => {
    expect(audienceOf('grossiste')).toBeNull();
  });

  it('la chaîne ne saute jamais un cran', () => {
    // Un consommateur ne doit JAMAIS voir les tarifs de gros : c’est la règle
    // qui protège la marge du commerçant, donc le modèle économique entier.
    expect(canSeeOffersFrom('consommateur', 'grossiste')).toBe(false);
    expect(canSeeOffersFrom('consommateur', 'commercant')).toBe(true);
    expect(canSeeOffersFrom('commercant', 'grossiste')).toBe(true);
    expect(canSeeOffersFrom('commercant', 'commercant')).toBe(false);
    expect(canSeeOffersFrom('grossiste', 'commercant')).toBe(false);
  });

  it('dit qui a le droit de publier', () => {
    expect(canPublishOffers('consommateur')).toBe(false);
    expect(canPublishOffers('commercant')).toBe(true);
    expect(canPublishOffers('grossiste')).toBe(true);
  });
});

describe('SIRET — CDC §5', () => {
  // SIRET réel et bien formé (Google France).
  const VALID = '44306184100047';

  it('accepte un numéro à 14 chiffres dont la clé de Luhn tombe juste', () => {
    expect(isValidSiret(VALID)).toBe(true);
  });

  it('tolère les espaces et la ponctuation de la saisie', () => {
    expect(isValidSiret('443 061 841 00047')).toBe(true);
    expect(normalizeSiret('443-061-841 00047')).toBe(VALID);
  });

  it('refuse une longueur incorrecte', () => {
    expect(isValidSiret('4430618410004')).toBe(false);
    expect(isValidSiret('443061841000470')).toBe(false);
    expect(isValidSiret('')).toBe(false);
  });

  it('attrape la faute de frappe — c’est tout l’intérêt de la clé', () => {
    expect(isValidSiret('44306184100048')).toBe(false);
    // Deux chiffres intervertis : longueur correcte, clé fausse.
    expect(isValidSiret('44306184100074')).toBe(false);
  });

  it('applique l’exception La Poste plutôt que de la refuser à tort', () => {
    // SIREN 356 000 000 : règle officielle = somme des chiffres multiple de 5.
    expect(isValidSiret('35600000000001')).toBe(true); // somme 15
    expect(isValidSiret('35600000000002')).toBe(false); // somme 16
  });

  it('extrait le SIREN et met en forme', () => {
    expect(sirenOf(VALID)).toBe('443061841');
    expect(formatSiret(VALID)).toBe('443 061 841 00047');
    expect(formatSiret('4430')).toBe('443 0');
  });
});

describe('commander chez un grossiste — CDC §5', () => {
  const VALID = '44306184100047';

  it('laisse passer un commerçant au SIRET valide', () => {
    expect(wholesaleOrderBlock('commercant', VALID)).toBeNull();
  });

  it('bloque le commerçant sans SIRET — exigence explicite du CDC', () => {
    expect(wholesaleOrderBlock('commercant', null)).toBe('siret');
    expect(wholesaleOrderBlock('commercant', '')).toBe('siret');
  });

  it('bloque aussi un SIRET mal formé — un champ rempli n’est pas une preuve', () => {
    expect(wholesaleOrderBlock('commercant', '12345678901234')).toBe('siret');
  });

  it('bloque les autres rôles, et le dit autrement', () => {
    // Le motif compte : « pas votre rôle » est définitif, « SIRET manquant »
    // se répare en trente secondes.
    expect(wholesaleOrderBlock('consommateur', VALID)).toBe('role');
    expect(wholesaleOrderBlock('grossiste', VALID)).toBe('role');
  });
});
