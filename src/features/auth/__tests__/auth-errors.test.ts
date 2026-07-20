import { friendlyAuthError } from '../model/auth-errors';

describe('friendlyAuthError', () => {
  it('ne dit rien quand il n’y a pas d’erreur', () => {
    expect(friendlyAuthError(null)).toBeNull();
    expect(friendlyAuthError(undefined)).toBeNull();
    expect(friendlyAuthError('')).toBeNull();
  });

  // Sécurité : ne jamais laisser deviner si l'adresse existe. Un message
  // distinct pour « compte inconnu » et « mot de passe faux » permettrait de
  // tester une liste d'adresses (énumération de comptes).
  it('reste vague sur un échec de connexion', () => {
    const msg = friendlyAuthError('Invalid login credentials');
    expect(msg).toBe('Adresse e-mail ou mot de passe incorrect.');
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
