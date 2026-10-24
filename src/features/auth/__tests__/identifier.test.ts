import {
  displayPhone,
  IDENTIFIER_MESSAGE,
  maskEmail,
  maskIdentifier,
  maskPhone,
  normalizePhone,
  parseIdentifier,
} from '../model/identifier';

describe('normalizePhone', () => {
  it.each([
    ['06 12 34 56 78', '+33612345678'],
    ['0612345678', '+33612345678'],
    ['06.12.34.56.78', '+33612345678'],
    ['06-12-34-56-78', '+33612345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033 6 12 34 56 78', '+33612345678'],
    // Le « 0 » de tête saisi après l'indicatif n'existe pas en E.164.
    ['+33 (0)6 12 34 56 78', '+33612345678'],
    ['01 23 45 67 89', '+33123456789'],
  ])('« %s » → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it('accepte les autres pays quand l’indicatif est donné', () => {
    expect(normalizePhone('+213 555 12 34 56')).toBe('+213555123456');
    expect(normalizePhone('0032 470 12 34 56')).toBe('+32470123456');
  });

  it.each([
    '',
    '   ',
    '12345',
    // Un numéro national sans indicatif n'est compris que pour la France.
    '555123456',
    // Trop court, trop long, ou zéro de tête après l'indicatif.
    '+1234567',
    '+1234567890123456',
    '+0612345678',
    // France : 9 chiffres après +33, jamais plus.
    '+33 6 12 34 56 78 9',
    '06 12 34 56',
    '00 12',
    'abc',
  ])('refuse « %s »', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  it('deux écritures du même numéro donnent le même compte', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe(normalizePhone('+33 6 12 34 56 78'));
  });
});

describe('parseIdentifier', () => {
  it('reconnaît un e-mail, le nettoie et le passe en minuscules', () => {
    expect(parseIdentifier('  Neo@Exemple.FR ')).toEqual({
      ok: true,
      identifier: { kind: 'email', value: 'neo@exemple.fr' },
    });
  });

  it('reconnaît un numéro de téléphone et le normalise', () => {
    expect(parseIdentifier('06 12 34 56 78')).toEqual({
      ok: true,
      identifier: { kind: 'phone', value: '+33612345678' },
    });
  });

  it('dit ce qui cloche', () => {
    expect(parseIdentifier('')).toEqual({ ok: false, hint: 'empty' });
    expect(parseIdentifier('neo@')).toEqual({ ok: false, hint: 'email' });
    expect(parseIdentifier('neo')).toEqual({ ok: false, hint: 'email' });
    expect(parseIdentifier('06 12 34')).toEqual({ ok: false, hint: 'phone' });
  });

  it('refuse un numéro quand la connexion par téléphone n’est pas proposée', () => {
    expect(parseIdentifier('06 12 34 56 78', { allowPhone: false })).toEqual({
      ok: false,
      hint: 'phone_disabled',
    });
    // L'e-mail, lui, passe toujours.
    expect(parseIdentifier('neo@exemple.fr', { allowPhone: false }).ok).toBe(true);
  });

  it('chaque motif de refus a un message en français', () => {
    for (const message of Object.values(IDENTIFIER_MESSAGE)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message).toMatch(/[a-zé]/);
    }
  });
});

describe('affichage', () => {
  it('masque un e-mail et un numéro', () => {
    expect(maskEmail('neo@exemple.fr')).toBe('n•••@exemple.fr');
    expect(maskPhone('+33612345678')).toBe('+33 ••• •• •• 78');
    expect(maskIdentifier({ kind: 'email', value: 'neo@exemple.fr' })).toBe('n•••@exemple.fr');
    expect(maskIdentifier({ kind: 'phone', value: '+33612345678' })).toBe('+33 ••• •• •• 78');
  });

  it('ne laisse jamais voir le numéro entier une fois masqué', () => {
    expect(maskPhone('+33612345678')).not.toContain('612345');
    expect(maskEmail('neo@exemple.fr')).not.toContain('neo');
  });

  it('remet un numéro français en écriture locale, et laisse les autres en E.164', () => {
    expect(displayPhone('+33612345678')).toBe('06 12 34 56 78');
    expect(displayPhone('+213555123456')).toBe('+213555123456');
  });
});
