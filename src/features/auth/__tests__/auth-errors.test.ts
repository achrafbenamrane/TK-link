import {
  authErrorMessage,
  classifyAuthError,
  friendlyAuthError,
  type AuthErrorCode,
} from '../model/auth-errors';

describe('friendlyAuthError', () => {
  it('ne dit rien quand il n’y a pas d’erreur', () => {
    expect(friendlyAuthError(null)).toBeNull();
    expect(friendlyAuthError(undefined)).toBeNull();
    expect(friendlyAuthError('')).toBeNull();
  });

  // Sécurité : ne jamais laisser deviner si l'identifiant existe. Un message
  // distinct pour « compte inconnu » et « mot de passe faux » permettrait de
  // tester une liste d'adresses ou de numéros (énumération de comptes).
  it('reste vague sur un échec de connexion', () => {
    const msg = friendlyAuthError('Invalid login credentials');
    expect(msg).toBe('Identifiant ou mot de passe incorrect.');
    expect(msg).not.toMatch(/introuvable|inconnu|n’existe pas/i);
  });

  it('traduit les cas courants', () => {
    expect(friendlyAuthError('Email not confirmed')).toMatch(/confirmez/i);
    expect(friendlyAuthError('User already registered')).toMatch(/existe déjà/i);
    expect(friendlyAuthError('For security purposes, rate limit exceeded')).toMatch(/tentatives/i);
    expect(friendlyAuthError('AuthRetryableFetchError: network failure')).toMatch(/réseau/i);
  });

  // Un message serveur inconnu ne doit pas atterrir tel quel dans l'interface.
  it('ne laisse jamais fuiter une erreur brute', () => {
    const raw = 'PGRST301: JWT expired at /auth/v1/token?grant_type=password';
    const msg = friendlyAuthError(raw);
    expect(msg).not.toContain('PGRST301');
    expect(msg).not.toContain('/auth/v1');
    expect(msg).toBe('Connexion impossible pour le moment. Réessayez.');
  });

  it('répond toujours en français', () => {
    for (const raw of ['Invalid login credentials', 'User already registered', 'boom']) {
      expect(friendlyAuthError(raw)).not.toMatch(/[Pp]assword|[Ee]mail address|credentials/);
    }
  });
});

describe('classifyAuthError — par code Supabase', () => {
  it.each<[string, AuthErrorCode]>([
    ['invalid_credentials', 'invalid_credentials'],
    // « Utilisateur introuvable » ne doit pas se distinguer d'un mauvais mot de passe.
    ['user_not_found', 'invalid_credentials'],
    ['email_not_confirmed', 'email_not_confirmed'],
    ['phone_not_confirmed', 'phone_not_confirmed'],
    ['user_already_exists', 'user_exists'],
    ['email_exists', 'user_exists'],
    ['phone_exists', 'user_exists'],
    ['weak_password', 'weak_password'],
    ['same_password', 'same_password'],
    ['over_sms_send_rate_limit', 'rate_limited'],
    ['over_email_send_rate_limit', 'rate_limited'],
    ['over_request_rate_limit', 'rate_limited'],
    ['otp_expired', 'otp_invalid'],
    ['sms_send_failed', 'sms_unavailable'],
    ['provider_disabled', 'provider_disabled'],
    ['signup_disabled', 'signup_disabled'],
    ['session_expired', 'session_missing'],
  ])('%s → %s', (code, expected) => {
    expect(classifyAuthError({ code, message: 'texte sans importance' })).toBe(expected);
  });

  it('le code l’emporte sur le libellé', () => {
    expect(classifyAuthError({ code: 'weak_password', message: 'Invalid login credentials' })).toBe(
      'weak_password',
    );
  });

  it('à défaut de code, retombe sur le libellé', () => {
    expect(classifyAuthError({ message: 'Token has expired or is invalid' })).toBe('otp_invalid');
    expect(classifyAuthError({ message: 'Error sending confirmation OTP to provider' })).toBe(
      'sms_unavailable',
    );
    expect(classifyAuthError({ message: 'Signups not allowed for this instance' })).toBe(
      'signup_disabled',
    );
    expect(classifyAuthError({ message: 'Unsupported phone provider' })).toBe('unknown');
  });

  it('reconnaît une coupure réseau par le nom de l’erreur', () => {
    expect(classifyAuthError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe('network');
    expect(classifyAuthError({ name: 'AuthWeakPasswordError', message: 'x' })).toBe(
      'weak_password',
    );
  });

  it('reclasse une catégorie déjà classée, ou un code Supabase passé en texte', () => {
    // Le store garde la CATÉGORIE en état ; l'écran la retraduit sans la perdre.
    expect(friendlyAuthError('invalid_credentials')).toBe('Identifiant ou mot de passe incorrect.');
    expect(friendlyAuthError('otp_invalid')).toMatch(/code incorrect/i);
    expect(classifyAuthError('over_sms_send_rate_limit')).toBe('rate_limited');
    expect(classifyAuthError('cancelled')).toBe('cancelled');
  });

  it('un code inconnu retombe sur « inconnu », jamais sur un message brut', () => {
    const code = classifyAuthError({ code: 'quelque_chose_de_nouveau', message: 'secret interne' });
    expect(code).toBe('unknown');
    expect(authErrorMessage(code)).not.toContain('secret interne');
  });
});

describe('messages', () => {
  const ALL: AuthErrorCode[] = [
    'invalid_input',
    'invalid_credentials',
    'email_not_confirmed',
    'phone_not_confirmed',
    'user_exists',
    'weak_password',
    'same_password',
    'rate_limited',
    'network',
    'otp_invalid',
    'sms_unavailable',
    'provider_disabled',
    'signup_disabled',
    'session_missing',
    'unavailable',
    'unknown',
  ];

  it('chaque catégorie a un message français, avec une apostrophe typographique', () => {
    for (const code of ALL) {
      const message = authErrorMessage(code);
      expect(message).toBeTruthy();
      // Le style de la marque : jamais d'apostrophe droite dans un texte affiché.
      expect(message).not.toContain("'");
    }
  });

  it('annuler la fenêtre Google ou Apple n’affiche rien', () => {
    expect(authErrorMessage('cancelled')).toBeNull();
  });

  it('ne dit jamais si c’est l’identifiant ou le mot de passe qui cloche', () => {
    expect(authErrorMessage('invalid_credentials')).toMatch(/identifiant ou mot de passe/i);
  });
});
