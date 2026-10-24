import type { Session } from '@supabase/supabase-js';

import { describeAccount } from '../model/account';
import { makeDemoSession } from '../model/demo-session';

const session = (user: Record<string, unknown>): Session =>
  ({
    access_token: 'x',
    user: { id: 'u1', app_metadata: {}, user_metadata: {}, ...user },
  }) as unknown as Session;

const CONFIRMED_AT = '2026-10-24T10:00:00Z';

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
      phoneLinked: false,
      provider: 'email',
      firstName: '',
    });
  });

  it('le numéro saisi à l’inscription est un contact : affiché, mais pas encore associé', () => {
    const info = describeAccount(
      session({
        email: 'a@b.fr',
        user_metadata: { contact_phone: '+33612345678', first_name: 'Neo' },
      }),
    );
    expect(info).toMatchObject({ phone: '+33612345678', phoneLinked: false, firstName: 'Neo' });
  });

  it('un numéro associé au compte sert à se connecter ; Supabase le range sans « + », on le rétablit', () => {
    const info = describeAccount(
      session({ email: 'a@b.fr', phone: '33612345678', phone_confirmed_at: CONFIRMED_AT }),
    );
    expect(info).toMatchObject({ phone: '+33612345678', phoneLinked: true });
  });

  it('un numéro qui porte déjà son « + » n’en reçoit pas un second', () => {
    const info = describeAccount(
      session({ phone: '+33612345678', phone_confirmed_at: CONFIRMED_AT }),
    );
    expect(info).toMatchObject({ phone: '+33612345678', phoneLinked: true });
  });

  it('le numéro associé l’emporte sur le contact saisi à l’inscription', () => {
    const info = describeAccount(
      session({
        phone: '33711223344',
        phone_confirmed_at: CONFIRMED_AT,
        user_metadata: { contact_phone: '+33612345678' },
      }),
    );
    expect(info).toMatchObject({ phone: '+33711223344', phoneLinked: true });
  });

  it('un numéro présent mais non confirmé n’est pas associé : Supabase refuserait la connexion', () => {
    expect(describeAccount(session({ phone: '33612345678' }))).toMatchObject({
      phone: '+33612345678',
      phoneLinked: false,
    });
  });

  it('une date de confirmation sans numéro ne suffit pas', () => {
    expect(describeAccount(session({ phone: '', phone_confirmed_at: CONFIRMED_AT }))).toMatchObject(
      { phone: null, phoneLinked: false },
    );
  });

  it('ignore un contact qui n’est pas du texte', () => {
    expect(
      describeAccount(session({ user_metadata: { contact_phone: 33612345678 } })),
    ).toMatchObject({ phone: null, phoneLinked: false });
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

  it('une session de démonstration est décrite comme les autres', () => {
    expect(describeAccount(makeDemoSession('neo@exemple.fr'))).toMatchObject({
      email: 'neo@exemple.fr',
      phone: null,
      phoneLinked: false,
      provider: 'demo',
    });
    expect(
      describeAccount(makeDemoSession('alex.demo@gmail.com', Date.now(), 'google')),
    ).toMatchObject({ provider: 'google' });

    // Plus de passe-droit : sans date de confirmation, un numéro n'est pas associé, démo ou pas.
    expect(describeAccount(makeDemoSession('+33612345678'))).toMatchObject({
      email: null,
      phone: '+33612345678',
      phoneLinked: false,
    });

    // Le store, lui, la pose quand la démonstration associe un numéro (voir `demo-flows.test.ts`).
    const linked = makeDemoSession('+33612345678');
    linked.user.phone_confirmed_at = linked.user.created_at;
    expect(describeAccount(linked)).toMatchObject({
      phone: '+33612345678',
      phoneLinked: true,
      provider: 'demo',
    });
  });
});
