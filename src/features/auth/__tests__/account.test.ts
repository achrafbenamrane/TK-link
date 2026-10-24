import type { Session } from '@supabase/supabase-js';

import { describeAccount } from '../model/account';
import { makeDemoSession } from '../model/demo-session';

const session = (user: Record<string, unknown>): Session =>
  ({
    access_token: 'x',
    user: { id: 'u1', app_metadata: {}, user_metadata: {}, ...user },
  }) as unknown as Session;

describe('describeAccount', () => {
  it('ne dit rien sans session', () => {
    expect(describeAccount(null)).toBeNull();
  });

  it('un compte e-mail : pas de numéro, provider « email »', () => {
    expect(
      describeAccount(session({ email: 'neo@exemple.fr', app_metadata: { provider: 'email' } })),
    ).toEqual({
      email: 'neo@exemple.fr',
      phone: null,
      phoneVerified: false,
      provider: 'email',
      firstName: '',
    });
  });

  it('le numéro saisi à l’inscription est un contact : affiché, mais pas vérifié', () => {
    const info = describeAccount(
      session({
        email: 'a@b.fr',
        user_metadata: { contact_phone: '+33612345678', first_name: 'Neo' },
      }),
    );
    expect(info).toMatchObject({ phone: '+33612345678', phoneVerified: false, firstName: 'Neo' });
  });

  it('un numéro confirmé par SMS est vérifié ; Supabase le range sans « + », on le rétablit', () => {
    const info = describeAccount(
      session({
        email: 'a@b.fr',
        phone: '33612345678',
        phone_confirmed_at: '2026-10-24T10:00:00Z',
      }),
    );
    expect(info).toMatchObject({ phone: '+33612345678', phoneVerified: true });
  });

  it('un numéro présent mais non confirmé n’est pas vérifié', () => {
    expect(describeAccount(session({ phone: '33612345678' }))).toMatchObject({
      phoneVerified: false,
    });
  });

  it('reconnaît Google et Apple, et retombe sur « email » pour un fournisseur inconnu', () => {
    expect(describeAccount(session({ app_metadata: { provider: 'google' } }))?.provider).toBe(
      'google',
    );
    expect(describeAccount(session({ app_metadata: { provider: 'apple' } }))?.provider).toBe(
      'apple',
    );
    expect(describeAccount(session({ app_metadata: { provider: 'azure' } }))?.provider).toBe(
      'email',
    );
  });

  it('prend le prénom de Google quand l’inscription n’en a pas donné', () => {
    expect(describeAccount(session({ user_metadata: { given_name: 'Sofia' } }))?.firstName).toBe(
      'Sofia',
    );
  });

  it('une session de démonstration est lue comme telle', () => {
    expect(describeAccount(makeDemoSession('neo@exemple.fr'))).toMatchObject({
      email: 'neo@exemple.fr',
      provider: 'demo',
    });
    // Un identifiant téléphonique de démonstration est « vérifié » : il a servi à se connecter.
    expect(describeAccount(makeDemoSession('+33612345678'))).toMatchObject({
      email: null,
      phone: '+33612345678',
      phoneVerified: true,
    });
  });
});
