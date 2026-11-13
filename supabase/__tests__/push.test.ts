import {
  deadTokens,
  expoBatches,
  isExpoToken,
  orderMessage,
  supportMessage,
} from '../functions/_shared/push';

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
