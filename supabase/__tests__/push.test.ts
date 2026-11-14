import {
  deadTokens,
  expoBatches,
  followMessage,
  isExpoToken,
  orderMessage,
  shopNotice,
  supportMessage,
} from '../functions/_shared/push';

describe('followMessage — un commerce suivi publie une vente flash (0026)', () => {
  const NOW = Date.parse('2026-11-14T16:00:00Z'); // 17:00 à Paris
  const offer = {
    id: '11111111-1111-4111-8111-111111111111',
    shop_id: '22222222-2222-4222-8222-222222222222',
    title: 'Panier viennoiseries',
  };

  it('une Flash en ligne : le nom du commerce, l’offre, et le toucher ouvre la vitrine, l’offre épinglée', () => {
    expect(
      followMessage(
        { ...offer, audience: 'clients', starts_at: '2026-11-14T16:00:00Z' },
        'Boulangerie Saint-Cyprien',
        NOW,
      ),
    ).toEqual({
      to: 'shop_followers',
      title: 'Boulangerie Saint-Cyprien',
      body: 'Nouvelle vente flash : Panier viennoiseries',
      data: { kind: 'shop', id: offer.shop_id, offer: offer.id },
    });
  });

  it('une Flash programmée : l’heure de Paris, et le toucher ouvre la vitrine', () => {
    expect(
      followMessage(
        { ...offer, starts_at: '2026-11-14T17:30:00Z' },
        'Boulangerie Saint-Cyprien',
        NOW,
      ),
    ).toMatchObject({
      body: 'Vente flash dès 18:30 : Panier viennoiseries',
    });
    // Pas encore visible : rien à épingler.
    expect(
      followMessage({ ...offer, starts_at: '2026-11-14T17:30:00Z' }, 'Boulangerie', NOW)?.data,
    ).toEqual({ kind: 'shop', id: offer.shop_id });
  });

  it('une offre pro de grossiste ne prévient personne', () => {
    expect(followMessage({ ...offer, audience: 'commercants' }, 'Grossiste', NOW)).toBeNull();
  });

  it('sans nom de commerce, un titre neutre', () => {
    expect(followMessage(offer, '', NOW)?.title).toBe('Nouvelle vente flash');
  });
});

/**
 * Les notifications du rapport d’avancement (13/11/2026). Ce qui compte : la bonne personne est
 * prévenue au bon moment, et personne n’est réveillé pour rien.
 */
describe('qui prévenir quand une commande avance', () => {
  const order = (status: string, fulfilment = 'touch-collect') => ({
    id: 'o-1',
    status,
    fulfilment,
  });

  it('payée → le commerçant, c’est sa nouvelle commande', () => {
    expect(orderMessage(order('payee'), { status: 'paiement_attente' })).toMatchObject({
      to: 'shop_owner',
      title: 'Nouvelle commande',
      data: { kind: 'merchant_order', id: 'o-1' },
    });
  });

  it('la suite → l’acheteur, avec un message propre au mode de remise', () => {
    expect(orderMessage(order('prete'), { status: 'preparation' })?.body).toMatch(/QR code/);
    expect(orderMessage(order('prete', 'livraison'), { status: 'preparation' })?.body).toMatch(
      /Uber Direct/,
    );
    expect(orderMessage(order('livree', 'livraison'), { status: 'en_livraison' })).toMatchObject({
      to: 'customer',
      data: { kind: 'order', id: 'o-1' },
    });
  });

  it('rien quand le statut ne change pas, ou pour une étape que personne n’attend', () => {
    expect(orderMessage(order('preparation'), { status: 'preparation' })).toBeNull();
    expect(orderMessage(order('paiement_attente'), null)).toBeNull();
    expect(orderMessage(order('annulee'), { status: 'paiement_attente' })).toBeNull();
  });

  it('un litige prévient l’acheteur que TK LINK s’en occupe', () => {
    expect(orderMessage(order('litige'), { status: 'prete' })?.to).toBe('customer');
  });
});

describe('un remboursement (0027)', () => {
  const order = (status: string, audience = 'clients') => ({
    id: 'o-r',
    status,
    fulfilment: 'touch-collect',
    audience,
  });

  it('en cours → l’acheteur sait quand l’argent revient', () => {
    expect(orderMessage(order('remboursement_en_cours'), { status: 'preparation' })).toMatchObject({
      to: 'customer',
      title: 'Remboursement en cours',
      body: expect.stringMatching(/5 à 10 jours/),
      data: { kind: 'order', id: 'o-r' },
    });
    expect(
      orderMessage(order('remboursement_en_cours', 'commercants'), { status: 'payee' })?.to,
    ).toBe('customer');
  });

  it('une commande que le commerce a en main → il ne la prépare pas, ne la remet pas', () => {
    for (const from of ['payee', 'acceptee', 'preparation', 'prete', 'en_livraison']) {
      expect(shopNotice(order('remboursement_en_cours'), { status: from })).toMatchObject({
        to: 'shop_owner',
        title: 'Commande remboursée',
        data: { kind: 'merchant_order', id: 'o-r' },
      });
    }
    expect(
      shopNotice(order('remboursement_en_cours', 'commercants'), { status: 'payee' })?.body,
    ).toMatch(/L’acheteur est remboursé/);
  });

  it('refusée par le commerce → l’acheteur sait qu’il est remboursé ; le commerce, lui, le sait', () => {
    expect(orderMessage(order('refusee'), { status: 'payee' })).toMatchObject({
      to: 'customer',
      title: 'Commande refusée',
      body: expect.stringMatching(/Le commerçant.*remboursé intégralement/),
    });
    expect(orderMessage(order('refusee', 'commercants'), { status: 'payee' })?.body).toMatch(
      /Le grossiste/,
    );
    expect(shopNotice(order('refusee'), { status: 'payee' })).toBeNull();
  });

  it('rien pour le commerce quand la commande n’était pas entre ses mains', () => {
    // Décision du back-office sur un litige : le commerce n'a plus rien à faire.
    expect(shopNotice(order('remboursement_en_cours'), { status: 'litige' })).toBeNull();
    expect(shopNotice(order('remboursement_en_cours'), null)).toBeNull();
    expect(shopNotice(order('remboursee'), { status: 'preparation' })).toBeNull();
    expect(shopNotice(order('litige'), { status: 'preparation' })).toBeNull();
  });
});

describe('une commande B2B (0023)', () => {
  const b2b = (status: string, fulfilment = 'livraison') => ({
    id: 'o-b2b',
    status,
    fulfilment,
    audience: 'commercants',
  });

  it('payée → le grossiste, qui expédie lui-même (pas d’Uber Direct)', () => {
    const m = orderMessage(b2b('payee'), { status: 'paiement_attente' });
    expect(m?.to).toBe('shop_owner');
    expect(m?.body).toMatch(/expédier par vos soins/);
    expect(m?.body).not.toMatch(/Uber/);
  });

  it('expédiée, puis livrée → le commerçant acheteur, sans « Bonne dégustation »', () => {
    expect(orderMessage(b2b('en_livraison'), { status: 'preparation' })?.title).toBe('Expédiée');
    const livree = orderMessage(b2b('livree'), { status: 'en_livraison' });
    expect(livree?.to).toBe('customer');
    expect(livree?.body).not.toMatch(/dégustation/);
  });

  it('retrait chez le grossiste : prête, avec le code', () => {
    expect(orderMessage(b2b('prete', 'touch-collect'), { status: 'preparation' })?.body).toMatch(
      /code de retrait/,
    );
  });
});

describe('support', () => {
  it('une réponse de TK LINK prévient l’auteur ; ses propres messages, non', () => {
    expect(supportMessage({ ticket_id: 't-1', from_staff: true })).toMatchObject({
      to: 'ticket_author',
      data: { kind: 'support', id: 't-1' },
    });
    expect(supportMessage({ ticket_id: 't-1', from_staff: false })).toBeNull();
  });
});

describe('envoi par Expo', () => {
  const msg = orderMessage({ id: 'o', status: 'livree', fulfilment: 'livraison' }, null)!;

  it('ne garde que les vrais jetons, par paquets de 100', () => {
    const tokens = Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${i}]`);
    const batches = expoBatches([...tokens, 'pas-un-jeton'], msg);
    expect(batches.map((b) => b.length)).toEqual([100, 50]);
    expect(batches[0]![0]).toMatchObject({ to: 'ExponentPushToken[0]', title: 'Livrée' });
    expect(isExpoToken('ExpoPushToken[abc]')).toBe(true);
    expect(isExpoToken('abc')).toBe(false);
  });

  it('repère les jetons d’applications désinstallées', () => {
    expect(
      deadTokens(['A', 'B'], {
        data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    ).toEqual(['B']);
    expect(deadTokens(['A'], null)).toEqual([]);
  });
});
