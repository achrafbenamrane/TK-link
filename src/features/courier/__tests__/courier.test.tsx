import { pickImage } from '@/shared/lib/image-picker';
import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';
import {
  deliveryCode,
  isImportantParcel,
  isValidDeliveryCode,
  isValidPickupPin,
  pickupPin,
} from '@/shared/lib/handover';

import {
  canReceiveMissions,
  courierGain,
  missingProfileFields,
  nextStep,
  type ProfileDraft,
} from '../lib/courier';
import { availableMissions } from '../lib/available';
import { daySummary, deltaLabel } from '../lib/summary';
import { timelineState } from '../lib/courier';
import { useCourierStore, type Mission } from '../model/store';
import { CourierEarningsScreen } from '../ui/courier-earnings-screen';
import { CourierHomeScreen } from '../ui/courier-home-screen';
import { CourierMissionsScreen } from '../ui/courier-missions-screen';
import { CourierSetupScreen } from '../ui/courier-setup-screen';

jest.mock('@/shared/lib/image-picker', () => ({ pickImage: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));

const pick = pickImage as jest.MockedFunction<typeof pickImage>;

const mission: Mission = {
  orderId: 'ord_abc123',
  merchantName: 'Pizzeria Napoli',
  merchantArea: 'Capitole',
  dropoff: '12 rue des Fleurs, 31000 Toulouse',
  itemCount: 2,
  totalEur: 18,
  distanceKm: null,
};

const state = () => useCourierStore.getState();

beforeEach(() => {
  state().reset();
  pick.mockReset();
});

describe('règles du livreur — CDC V1.1', () => {
  it('exige véhicule, zone, pièce d’identité et selfie pour partir en vérification', () => {
    const draft: ProfileDraft = { vehicle: null, zone: '', idUri: '', selfieUri: '' };
    expect(Object.keys(missingProfileFields(draft)).sort()).toEqual([
      'idUri',
      'selfieUri',
      'vehicle',
      'zone',
    ]);
    expect(
      missingProfileFields({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' }),
    ).toEqual({});
  });

  it('ne reçoit de missions que compte validé ET en ligne', () => {
    expect(canReceiveMissions('valide', true)).toBe(true);
    expect(canReceiveMissions('valide', false)).toBe(false);
    expect(canReceiveMissions('en_verification', true)).toBe(false);
  });

  it('suit les étapes de mission du schéma du client, dans l’ordre', () => {
    expect(nextStep('acceptee')).toBe('en_route_commercant');
    expect(nextStep('en_route_commercant')).toBe('prise_en_charge');
    expect(nextStep('prise_en_charge')).toBe('en_livraison');
    expect(nextStep('en_livraison')).toBe('livree');
    expect(nextStep('livree')).toBeNull();
  });

  it('3 € par commande, et 0,80 €/km seulement quand la zone de base est connue', () => {
    // Zone de base absente du CDC : jamais de majoration inventée.
    expect(courierGain(12)).toEqual({ eur: 3, complet: false });
    expect(courierGain(null)).toEqual({ eur: 3, complet: false });

    const settings = { courierBaseFeeEur: 3, courierPerKmEur: 0.8, courierBaseZoneKm: 5 };
    expect(courierGain(4, settings)).toEqual({ eur: 3, complet: true });
    expect(courierGain(10, settings)).toEqual({ eur: 7, complet: true });
  });

  it('le code de remise est le même des deux côtés, et il se vérifie', () => {
    const pin = pickupPin('ord_abc123');
    expect(pin).toMatch(/^\d{4}$/);
    expect(pickupPin('ord_abc123')).toBe(pin);
    expect(isValidPickupPin('ord_abc123', ` ${pin} `)).toBe(true);
    expect(isValidPickupPin('ord_abc123', '0000' === pin ? '0001' : '0000')).toBe(false);
  });

  it('le code du client a six chiffres, identique des deux côtés, et se vérifie', () => {
    const code = deliveryCode('ord_abc123');
    expect(code).toMatch(/^\d{6}$/);
    expect(deliveryCode('ord_abc123')).toBe(code);
    expect(isValidDeliveryCode('ord_abc123', ` ${code} `)).toBe(true);
    expect(isValidDeliveryCode('ord_abc123', code === '000000' ? '000001' : '000000')).toBe(false);
  });

  it('la frise de la mission place chaque ligne : faite, en cours, à venir', () => {
    expect(timelineState('acceptee', 'en_route_commercant')).toBe('fait');
    expect(timelineState('en_route_commercant', 'en_route_commercant')).toBe('en_cours');
    expect(timelineState('en_livraison', 'en_route_commercant')).toBe('a_venir');
  });

  it('aucun colis n’est « important » tant que le seuil n’est pas arrêté', () => {
    expect(isImportantParcel(5000, null)).toBe(false);
    expect(isImportantParcel(150, 100)).toBe(true);
    expect(isImportantParcel(50, 100)).toBe(false);
  });
});

describe('store livreur', () => {
  const validated = () => {
    state().submitProfile({ vehicle: 'scooter', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    state().setOnline(true);
  };

  it('un dossier incomplet ne part pas en vérification', () => {
    const res = state().submitProfile({ vehicle: null, zone: '', idUri: '', selfieUri: '' });
    expect(res.ok).toBe(false);
    expect(state().status).toBe('brouillon');
  });

  it('on ne se met pas en ligne, ni n’accepte de mission, sans compte validé', () => {
    expect(state().setOnline(true)).toBe(false);
    expect(state().acceptMission(mission)).toBe(false);
  });

  it('déroule une mission jusqu’à la remise avec preuve, et l’inscrit au portefeuille', () => {
    validated();
    expect(state().acceptMission(mission)).toBe(true);
    // Une seule mission à la fois.
    expect(state().acceptMission({ ...mission, orderId: 'autre' })).toBe(false);

    state().startRoute();
    expect(state().active?.step).toBe('en_route_commercant');

    // Sans empreinte, même le bon code ne suffit pas : l'identité d'abord.
    expect(state().confirmPickup(pickupPin(mission.orderId))).toEqual({
      ok: false,
      reason: 'biometrie',
    });
    expect(state().confirmIdentity()).toBe(true);
    expect(state().active?.identityAt).toBeGreaterThan(0);

    // Un mauvais code ne suffit pas non plus.
    const wrong = pickupPin(mission.orderId) === '0000' ? '0001' : '0000';
    expect(state().confirmPickup(wrong)).toEqual({ ok: false, reason: 'code' });
    expect(state().confirmPickup(pickupPin(mission.orderId))).toEqual({ ok: true });

    state().startDelivery();
    expect(state().active?.step).toBe('en_livraison');
    // Chaque étape franchie est horodatée : la frise affiche les heures.
    expect(Object.keys(state().active?.at ?? {}).sort()).toEqual([
      'acceptee',
      'en_livraison',
      'en_route_commercant',
      'prise_en_charge',
    ]);

    // Pas de remise sans le code du client.
    const badCode = deliveryCode(mission.orderId) === '000000' ? '000001' : '000000';
    expect(state().confirmDelivery(badCode)).toEqual({ ok: false, reason: 'code' });
    expect(state().confirmDelivery(deliveryCode(mission.orderId))).toEqual({ ok: true });

    expect(state().active).toBeNull();
    expect(state().history).toHaveLength(1);
    expect(state().history[0]).toMatchObject({
      orderId: mission.orderId,
      gainEur: 3,
      gainComplet: false,
      proofUri: `code:${deliveryCode(mission.orderId)}`,
    });
  });

  it('on ne se met pas hors ligne au milieu d’une mission', () => {
    validated();
    state().acceptMission(mission);
    expect(state().setOnline(false)).toBe(false);
    expect(state().online).toBe(true);
  });
});

describe('<CourierSetupScreen />', () => {
  it('refuse un dossier vide, puis l’envoie quand tout est là', async () => {
    pick.mockResolvedValue('file:///x.jpg');
    render(<CourierSetupScreen authenticate={jest.fn()} onDone={jest.fn()} />);

    fireEvent.press(screen.getByTestId('courier-submit'));
    expect(state().status).toBe('brouillon');

    fireEvent.press(screen.getByTestId('courier-vehicle-velo'));
    fireEvent.changeText(screen.getByTestId('courier-zone'), 'Toulouse centre');
    fireEvent.press(screen.getByTestId('courier-idUri-add'));
    await waitFor(() => expect(screen.getByTestId('courier-idUri-preview')).toBeTruthy());
    fireEvent.press(screen.getByTestId('courier-selfieUri-add'));
    await waitFor(() => expect(screen.getByTestId('courier-selfieUri-preview')).toBeTruthy());
    fireEvent.press(screen.getByTestId('courier-submit'));

    expect(state().status).toBe('en_verification');
    expect(screen.getByTestId('courier-verification-status')).toHaveTextContent(
      /en cours de contrôle/,
    );
  });

  it('la démo simule la validation, puis la biométrie ouvre l’accès', async () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    const authenticate = jest.fn().mockResolvedValue(true);
    const onDone = jest.fn();
    render(<CourierSetupScreen authenticate={authenticate} onDone={onDone} />);

    fireEvent.press(screen.getByTestId('courier-demo-validate'));
    fireEvent.press(screen.getByTestId('courier-to-security'));
    fireEvent.press(screen.getByTestId('courier-enrol'));

    await waitFor(() => expect(screen.getByTestId('courier-done')).toBeTruthy());
    expect(authenticate).toHaveBeenCalled();
    expect(state().deviceEnrolled).toBe(true);
    fireEvent.press(screen.getByTestId('courier-done'));
    expect(onDone).toHaveBeenCalled();
  });
});

const ready = () => {
  state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
  state().validateAccount();
};

describe('résumé du jour', () => {
  const NOW = new Date(2026, 9, 5, 15).getTime();
  const DAY = 24 * 3600 * 1000;

  it('cumule les gains et les livraisons du jour, et les compare à hier', () => {
    const s = daySummary(
      [
        { at: NOW - 3600_000, gainEur: 4 },
        { at: NOW - 7200_000, gainEur: 4 },
        { at: NOW - DAY, gainEur: 4 },
        { at: NOW - 3 * DAY, gainEur: 99 },
      ],
      NOW,
    );
    expect(s.gainsEur).toBe(8);
    expect(s.deliveries).toBe(2);
    expect(s.gainsDeltaPct).toBe(100);
    expect(s.deliveriesDeltaPct).toBe(100);
  });

  it('ne compare rien quand hier est vide, et écrit le signe', () => {
    expect(daySummary([{ at: NOW - 1000, gainEur: 3 }], NOW).gainsDeltaPct).toBeNull();
    expect(deltaLabel(null)).toBeNull();
    expect(deltaLabel(12.5)).toBe('+12,5 % vs hier');
    expect(deltaLabel(-4)).toBe('-4 % vs hier');
  });
});

describe('<CourierHomeScreen /> — la première maquette', () => {
  const props = { name: 'Alex Martin', pendingCount: 3, onOpen: jest.fn() };
  beforeEach(() => props.onOpen.mockReset());

  it('avant la validation du compte : une invitation à finir l’inscription', () => {
    render(<CourierHomeScreen {...props} />);
    fireEvent.press(screen.getByTestId('courier-open-setup'));
    expect(props.onOpen).toHaveBeenCalledWith('setup');
  });

  it('montre le nom, la disponibilité et le résumé du jour tiré de l’historique', () => {
    ready();
    useCourierStore.setState({
      history: [
        {
          orderId: 'a',
          merchantName: 'A',
          at: Date.now() - 1000,
          distanceKm: null,
          gainEur: 3,
          gainComplet: false,
          proofUri: 'p',
        },
        {
          orderId: 'b',
          merchantName: 'B',
          at: Date.now() - 2000,
          distanceKm: null,
          gainEur: 4.4,
          gainComplet: false,
          proofUri: 'p',
        },
      ],
    });
    render(<CourierHomeScreen {...props} />);

    expect(screen.getByTestId('courier-name')).toHaveTextContent('Alex Martin');
    expect(screen.getByTestId('courier-availability')).toHaveTextContent('Hors ligne');
    expect(screen.getByTestId('courier-tile-gains-value')).toHaveTextContent('7,40 €');
    expect(screen.getByTestId('courier-tile-pending-value')).toHaveTextContent('3');
    expect(screen.getByTestId('courier-tile-done-value')).toHaveTextContent('2');
  });

  it('« Passer disponible » met en ligne, « Passer hors ligne » remet hors ligne', () => {
    ready();
    render(<CourierHomeScreen {...props} />);
    const toggle = screen.getByTestId('courier-online-toggle');
    expect(toggle).toHaveTextContent('Passer disponible');
    fireEvent.press(toggle);
    expect(state().online).toBe(true);
    expect(screen.getByTestId('courier-availability')).toHaveTextContent('Disponible');
    expect(screen.getByTestId('courier-online-toggle')).toHaveTextContent('Passer hors ligne');
    fireEvent.press(screen.getByTestId('courier-online-toggle'));
    expect(state().online).toBe(false);
  });

  it('ouvre chaque raccourci : missions, historique, support, compte, sécurité', () => {
    render(<CourierHomeScreen {...props} />);
    for (const key of ['missions', 'history', 'support', 'account', 'security'] as const) {
      fireEvent.press(screen.getByTestId(`courier-shortcut-${key}`));
      expect(props.onOpen).toHaveBeenLastCalledWith(key);
    }
  });

  it('un geste active un compte d’exemple et passe en ligne (démonstration)', () => {
    render(<CourierHomeScreen {...props} showExamples />);
    fireEvent.press(screen.getByTestId('courier-demo-activate'));
    expect(state().status).toBe('valide');
    expect(state().online).toBe(true);
  });
});

describe('<CourierMissionsScreen /> — de la proposition à la remise', () => {
  const base = () => ({
    missions: [mission],
    authenticate: jest.fn().mockResolvedValue({ ok: true }),
    onPickedUp: jest.fn(),
    onDelivered: jest.fn(),
    onMessage: jest.fn(),
  });

  it('hors ligne : aucune offre ; en ligne : l’offre apparaît avec le gain « dès 3,00 € »', () => {
    ready();
    const { unmount } = render(<CourierMissionsScreen {...base()} />);
    expect(screen.getByTestId('courier-offline')).toBeTruthy();
    expect(screen.queryByTestId(`courier-offer-${mission.orderId}`)).toBeNull();
    unmount();

    state().setOnline(true);
    render(<CourierMissionsScreen {...base()} />);
    expect(screen.getByTestId(`courier-offer-${mission.orderId}`)).toHaveTextContent(/dès 3,00 €/);
  });

  it('refuser une offre la retire de la liste', () => {
    ready();
    state().setOnline(true);
    render(<CourierMissionsScreen {...base()} />);
    fireEvent.press(screen.getByTestId(`courier-decline-${mission.orderId}`));
    expect(screen.queryByTestId(`courier-offer-${mission.orderId}`)).toBeNull();
    expect(screen.getByTestId('courier-no-missions')).toBeTruthy();
  });

  it('les missions d’exemple s’ajoutent aux vraies en démonstration, signalées « Exemple »', () => {
    ready();
    state().setOnline(true);
    const { unmount } = render(<CourierMissionsScreen {...base()} />);
    expect(screen.queryByTestId('courier-offer-demo_8892')).toBeNull();
    unmount();

    render(<CourierMissionsScreen {...base()} showExamples />);
    expect(screen.getByTestId(`courier-offer-${mission.orderId}`)).toBeTruthy();
    expect(screen.getByTestId('courier-offer-demo_8892')).toBeTruthy();
    expect(screen.getByTestId('courier-example-demo_8892')).toBeTruthy();
    expect(screen.queryByTestId(`courier-example-${mission.orderId}`)).toBeNull();
  });

  it('la mission active montre le commerce, le client, les détails et la frise', () => {
    ready();
    state().setOnline(true);
    const demoMission: Mission = {
      ...mission,
      ref: 'CMD-8892',
      clientName: 'Emma Bernard',
      clientPhone: '01 99 00 24 24',
      instructions: 'Sonner à l’interphone.',
      bags: 1,
      targetTime: '12:45',
      distanceKm: 2.4,
    };
    state().acceptMission(demoMission);
    render(<CourierMissionsScreen {...base()} />);

    const active = screen.getByTestId('courier-active');
    expect(active).toHaveTextContent(/Pizzeria\s+Napoli/);
    expect(active).toHaveTextContent(/Emma\s+Bernard/);
    expect(active).toHaveTextContent(/12:45/);
    expect(active).toHaveTextContent(/2,4 km/);
    expect(screen.getByTestId('courier-order-ref')).toHaveTextContent('#CMD-8892');
    expect(screen.getByTestId('courier-instructions')).toHaveTextContent('Sonner à l’interphone.');
    expect(screen.getByTestId('courier-timeline-acceptee')).toBeTruthy();
    expect(screen.getByTestId('courier-timeline-livree')).toHaveTextContent('Validation finale');
  });

  it('déroule la mission : empreinte, code de retrait, navigation, validation par le code du client', async () => {
    ready();
    state().setOnline(true);
    const props = base();
    render(<CourierMissionsScreen {...props} />);

    fireEvent.press(screen.getByTestId(`courier-accept-${mission.orderId}`));
    fireEvent.press(screen.getByTestId('courier-start-route'));
    fireEvent.press(screen.getByTestId('courier-open-pickup'));

    // Rien ne part sans l'empreinte, même avec le bon code.
    fireEvent.changeText(screen.getByTestId('courier-pin'), pickupPin(mission.orderId));
    fireEvent.press(screen.getByTestId('courier-confirm-pickup'));
    expect(state().active?.step).toBe('en_route_commercant');

    fireEvent.press(screen.getByTestId('courier-fingerprint'));
    await waitFor(() => expect(screen.getByTestId('courier-identity-ok')).toBeTruthy());
    expect(props.authenticate).toHaveBeenCalled();
    expect(state().active?.identityAt).toBeGreaterThan(0);

    // Un mauvais code, puis le bon.
    const good = pickupPin(mission.orderId);
    fireEvent.changeText(screen.getByTestId('courier-pin'), good === '1234' ? '4321' : '1234');
    fireEvent.press(screen.getByTestId('courier-confirm-pickup'));
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/pas celui de la commande/);
    fireEvent.changeText(screen.getByTestId('courier-pin'), good);
    fireEvent.press(screen.getByTestId('courier-confirm-pickup'));
    await waitFor(() => expect(screen.getByTestId('courier-start-delivery')).toBeTruthy());

    fireEvent.press(screen.getByTestId('courier-start-delivery'));
    expect(props.onPickedUp).toHaveBeenCalledWith(mission.orderId);

    // La navigation, puis « J'arrive chez le client »
    expect(screen.getByTestId('courier-navigation')).toBeTruthy();
    fireEvent.press(screen.getByTestId('courier-nav-message'));
    expect(props.onMessage).toHaveBeenCalledWith(
      'client',
      expect.objectContaining({ orderId: mission.orderId }),
    );
    fireEvent.press(screen.getByTestId('courier-nav-incident'));
    expect(props.onMessage).toHaveBeenLastCalledWith('support', expect.anything());
    fireEvent.press(screen.getByTestId('courier-arrive'));

    // La validation finale : un mauvais code ne valide rien.
    const code = deliveryCode(mission.orderId);
    expect(screen.getByTestId('courier-confirm-delivery')).toBeTruthy();
    fireEvent.changeText(
      screen.getByTestId('courier-delivery-code'),
      code === '111111' ? '222222' : '111111',
    );
    fireEvent.press(screen.getByTestId('courier-confirm-delivery'));
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/pas celui du client/);
    expect(props.onDelivered).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('courier-delivery-code'), code);
    fireEvent.press(screen.getByTestId('courier-confirm-delivery'));
    await waitFor(() => expect(props.onDelivered).toHaveBeenCalledWith(mission.orderId));
    expect(screen.getByTestId('courier-delivered')).toHaveTextContent(/Livraison confirmée/);
    expect(state().history).toHaveLength(1);

    fireEvent.press(screen.getByTestId('courier-delivered-close'));
    expect(screen.queryByTestId('courier-delivered')).toBeNull();
  });

  it('une empreinte non reconnue ne valide pas l’identité', async () => {
    ready();
    state().setOnline(true);
    const props = {
      ...base(),
      authenticate: jest.fn().mockResolvedValue({ ok: false, reason: 'echec' }),
    };
    render(<CourierMissionsScreen {...props} />);
    fireEvent.press(screen.getByTestId(`courier-accept-${mission.orderId}`));
    fireEvent.press(screen.getByTestId('courier-start-route'));
    fireEvent.press(screen.getByTestId('courier-open-pickup'));

    fireEvent.press(screen.getByTestId('courier-fingerprint'));
    await waitFor(() =>
      expect(screen.getByTestId('courier-message')).toHaveTextContent(/non reconnue/i),
    );
    expect(state().active?.identityAt).toBeUndefined();
    expect(screen.queryByTestId('courier-identity-ok')).toBeNull();
  });

  it('sans empreinte enregistrée : le dit, et ne propose la simulation qu’en démonstration', async () => {
    ready();
    state().setOnline(true);
    const props = {
      ...base(),
      missions: [] as Mission[],
      authenticate: jest.fn().mockResolvedValue({ ok: false, reason: 'indisponible' }),
    };
    render(<CourierMissionsScreen {...props} showExamples />);
    fireEvent.press(screen.getByTestId('courier-accept-demo_8892'));
    fireEvent.press(screen.getByTestId('courier-start-route'));
    fireEvent.press(screen.getByTestId('courier-open-pickup'));
    expect(screen.getByTestId('courier-demo-pin')).toHaveTextContent(
      new RegExp(pickupPin('demo_8892')),
    );

    fireEvent.press(screen.getByTestId('courier-fingerprint'));
    await waitFor(() => expect(screen.getByTestId('courier-identity-demo')).toBeTruthy());
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/Aucune empreinte/);

    fireEvent.press(screen.getByTestId('courier-identity-demo'));
    expect(screen.getByTestId('courier-identity-ok')).toBeTruthy();
  });

  it('une vraie course, sans empreinte enregistrée, n’offre aucun contournement', async () => {
    ready();
    state().setOnline(true);
    const props = {
      ...base(),
      authenticate: jest.fn().mockResolvedValue({ ok: false, reason: 'indisponible' }),
    };
    render(<CourierMissionsScreen {...props} />);
    fireEvent.press(screen.getByTestId(`courier-accept-${mission.orderId}`));
    fireEvent.press(screen.getByTestId('courier-start-route'));
    fireEvent.press(screen.getByTestId('courier-open-pickup'));
    fireEvent.press(screen.getByTestId('courier-fingerprint'));
    await waitFor(() => expect(screen.getByTestId('courier-message')).toBeTruthy());
    expect(screen.queryByTestId('courier-identity-demo')).toBeNull();
  });
});

describe('<CourierEarningsScreen />', () => {
  it('annonce un historique vide', () => {
    render(<CourierEarningsScreen />);
    expect(screen.getByTestId('courier-history-empty')).toBeTruthy();
    expect(screen.getByTestId('courier-total')).toHaveTextContent('0,00 €');
  });

  it('cumule les gains et dit que la majoration kilométrique n’est pas comptée', () => {
    state().submitProfile({ vehicle: 'velo', zone: 'T', idUri: 'a', selfieUri: 'b' });
    useCourierStore.setState({
      history: [
        {
          orderId: 'a',
          merchantName: 'A',
          at: 1_700_000_000_000,
          distanceKm: null,
          gainEur: 3,
          gainComplet: false,
          proofUri: 'p',
        },
        {
          orderId: 'b',
          merchantName: 'B',
          at: 1_700_000_100_000,
          distanceKm: null,
          gainEur: 3,
          gainComplet: false,
          proofUri: 'p',
        },
      ],
    });
    render(<CourierEarningsScreen />);
    expect(screen.getByTestId('courier-total')).toHaveTextContent('6,00 €');
    expect(screen.getByTestId('courier-partial-note')).toBeTruthy();
  });
});

describe('missions disponibles — une seule définition', () => {
  const other: Mission = { ...mission, orderId: 'autre' };

  it('retire les refusées et la mission déjà acceptée', () => {
    const list = availableMissions({
      missions: [mission, other],
      showExamples: false,
      declined: ['autre'],
      activeOrderId: undefined,
    });
    expect(list.map((m) => m.orderId)).toEqual([mission.orderId]);

    const withActive = availableMissions({
      missions: [mission, other],
      showExamples: false,
      declined: [],
      activeOrderId: mission.orderId,
    });
    expect(withActive.map((m) => m.orderId)).toEqual(['autre']);
  });

  it('ajoute les missions d’exemple seulement en démonstration', () => {
    const base = { missions: [mission], declined: [] as string[] };
    expect(availableMissions({ ...base, showExamples: false })).toHaveLength(1);
    const withExamples = availableMissions({ ...base, showExamples: true });
    expect(withExamples.some((m) => m.orderId === 'demo_8892')).toBe(true);
  });

  it('l’accueil compte la mission acceptée une seule fois', () => {
    ready();
    state().setOnline(true);
    state().acceptMission(mission);
    // La route a déjà retiré la mission acceptée des missions en attente.
    render(<CourierHomeScreen name="Alex" pendingCount={2} onOpen={jest.fn()} />);
    expect(screen.getByTestId('courier-shortcut-missions')).toHaveTextContent(/3 en cours/);
  });
});

describe('<CourierSetupScreen /> — reprise du dossier', () => {
  it('compte validé mais appareil non enrôlé : on reprend à la sécurisation', () => {
    ready();
    render(<CourierSetupScreen authenticate={jest.fn()} onDone={jest.fn()} />);
    expect(screen.getByTestId('courier-enrol')).toBeTruthy();
  });

  it('compte validé et appareil enrôlé : « Compte validé »', () => {
    ready();
    state().setDeviceEnrolled(true);
    render(<CourierSetupScreen authenticate={jest.fn()} onDone={jest.fn()} />);
    expect(screen.getByTestId('courier-done')).toBeTruthy();
  });
});
