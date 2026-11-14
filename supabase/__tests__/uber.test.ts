import { createHmac } from 'crypto';

import {
  isCourierCancellable,
  needsCourier,
  orderStatusFor,
  parseDelivery,
  parseQuote,
  parseWebhook,
  uberAddress,
  uberPhone,
  verifyUberSignature,
} from '../functions/_shared/uber';

/**
 * Uber Direct remplace les livreurs TK LINK (décision du 13/11/2026). Ces fonctions pures sont tout
 * ce qui se teste sans compte Uber : le reste (jeton, appels) attend les clés du client.
 */
describe('adresses et téléphones au format Uber', () => {
  it('découpe une adresse française en rue, code postal et ville', () => {
    expect(JSON.parse(uberAddress('8 rue des Carmes, 31000 Toulouse'))).toEqual({
      street_address: ['8 rue des Carmes'],
      city: 'Toulouse',
      state: '',
      zip_code: '31000',
      country: 'FR',
    });
    expect(JSON.parse(uberAddress('14 avenue des Pyrénées 31600 Muret'))).toMatchObject({
      street_address: ['14 avenue des Pyrénées'],
      zip_code: '31600',
      city: 'Muret',
    });
  });

  it('sans code postal reconnaissable, garde la ligne entière (les coordonnées font foi)', () => {
    expect(JSON.parse(uberAddress('  Place du Capitole  '))).toMatchObject({
      street_address: ['Place du Capitole'],
      zip_code: '',
    });
  });

  it('met les numéros au format international, refuse le reste', () => {
    expect(uberPhone('06 12 34 56 78')).toBe('+33612345678');
    expect(uberPhone('+33612345678')).toBe('+33612345678');
    expect(uberPhone('33612345678')).toBe('+33612345678');
    expect(uberPhone('12')).toBeNull();
    expect(uberPhone(null)).toBeNull();
  });
});

describe('statuts : la course Uber fait avancer la commande', () => {
  it('colis parti → en livraison ; remis → livrée', () => {
    expect(orderStatusFor('pickup_complete')).toBe('en_livraison');
    expect(orderStatusFor('dropoff')).toBe('en_livraison');
    expect(orderStatusFor('delivered')).toBe('livree');
  });

  it('coursier cherché ou en route vers le commerce : rien ne change', () => {
    expect(orderStatusFor('pending')).toBeNull();
    expect(orderStatusFor('pickup')).toBeNull();
    expect(orderStatusFor('inconnu')).toBeNull();
  });

  it('course annulée ou retournée après paiement : litige, jamais une annulation muette', () => {
    expect(orderStatusFor('canceled')).toBe('litige');
    expect(orderStatusFor('returned')).toBe('litige');
  });
});

describe('réponses de l’API', () => {
  const now = Date.parse('2026-11-13T17:00:00Z');

  it('lit un devis en euros', () => {
    expect(
      parseQuote(
        {
          kind: 'delivery_quote',
          id: 'dqt_123',
          fee: 599,
          currency: 'eur',
          dropoff_eta: '2026-11-13T17:35:00Z',
          expires: '2026-11-13T17:15:00Z',
        },
        now,
      ),
    ).toEqual({ id: 'dqt_123', feeCents: 599, etaMinutes: 35, expires: '2026-11-13T17:15:00Z' });
  });

  it('refuse un devis inattendu : on ne facture rien d’inventé', () => {
    expect(parseQuote({ id: 'dqt', fee: 5.99, currency: 'eur' }, now)).toBeNull();
    expect(parseQuote({ id: 'dqt', fee: 599, currency: 'usd' }, now)).toBeNull();
    expect(parseQuote({ fee: 599 }, now)).toBeNull();
    expect(parseQuote(null, now)).toBeNull();
  });

  it('lit une course créée, et n’accepte qu’un lien de suivi https', () => {
    expect(
      parseDelivery({ id: 'del_1', status: 'pending', tracking_url: 'https://www.ubr.to/x' }),
    ).toEqual({ id: 'del_1', status: 'pending', trackingUrl: 'https://www.ubr.to/x' });
    expect(parseDelivery({ id: 'del_1', status: 'pending', tracking_url: 'javascript:x' })).toEqual(
      { id: 'del_1', status: 'pending', trackingUrl: null },
    );
  });

  it('lit un webhook de statut, ignore les autres événements', () => {
    expect(
      parseWebhook({
        kind: 'event.delivery_status',
        status: 'delivered',
        delivery_id: 'del_1',
        data: { external_id: 'order-uuid', tracking_url: 'https://www.ubr.to/x' },
      }),
    ).toEqual({
      deliveryId: 'del_1',
      status: 'delivered',
      orderId: 'order-uuid',
      trackingUrl: 'https://www.ubr.to/x',
    });
    expect(parseWebhook({ kind: 'event.courier_update', delivery_id: 'del_1' })).toBeNull();
  });
});

describe('signature des webhooks', () => {
  const body = '{"kind":"event.delivery_status","status":"delivered"}';
  const key = 'cle-de-signature';
  const good = createHmac('sha256', key).update(body).digest('hex');

  it('accepte la bonne signature', async () => {
    expect(await verifyUberSignature(body, good, key)).toBe(true);
    expect(await verifyUberSignature(body, good.toUpperCase(), key)).toBe(true);
  });

  it('refuse un corps modifié, une autre clé, ou pas de signature', async () => {
    expect(await verifyUberSignature(body.replace('delivered', 'canceled'), good, key)).toBe(false);
    expect(await verifyUberSignature(body, good, 'autre')).toBe(false);
    expect(await verifyUberSignature(body, null, key)).toBe(false);
    expect(await verifyUberSignature(body, good, '')).toBe(false);
  });
});

describe('annuler une course (fonction uber-cancel)', () => {
  const order = (o: Partial<Parameters<typeof isCourierCancellable>[0]>) => ({
    status: 'prete',
    uber_delivery_id: 'del_1',
    uber_status: 'pending',
    ...o,
  });

  it('tant que le coursier n’a pas pris le colis', () => {
    expect(isCourierCancellable(order({}))).toBe(true);
    expect(isCourierCancellable(order({ uber_status: 'pickup' }))).toBe(true);
  });

  it('plus après la prise en charge, ni sans course, ni hors « prête »', () => {
    expect(isCourierCancellable(order({ uber_status: 'pickup_complete' }))).toBe(false);
    expect(isCourierCancellable(order({ uber_status: 'delivered' }))).toBe(false);
    expect(isCourierCancellable(order({ uber_delivery_id: null }))).toBe(false);
    expect(isCourierCancellable(order({ uber_status: null }))).toBe(false);
    expect(isCourierCancellable(order({ status: 'en_livraison' }))).toBe(false);
  });
});

describe('needsCourier', () => {
  it('envoie un coursier pour une livraison de client final', () => {
    expect(needsCourier({ fulfilment: 'livraison', audience: 'clients' })).toBe(true);
  });

  it('jamais pour un retrait, ni pour une offre pro livrée par le grossiste (0023)', () => {
    expect(needsCourier({ fulfilment: 'touch-collect', audience: 'clients' })).toBe(false);
    expect(needsCourier({ fulfilment: 'livraison', audience: 'commercants' })).toBe(false);
  });
});
