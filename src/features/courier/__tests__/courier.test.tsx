import { pickImage } from '@/shared/lib/image-picker';
import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';
import { isImportantParcel, isValidPickupPin, pickupPin } from '@/shared/lib/handover';

import {
  canReceiveMissions,
  courierGain,
  missingProfileFields,
  nextStep,
  type ProfileDraft,
} from '../lib/courier';
import { useCourierStore, type Mission } from '../model/store';
import { CourierEarningsScreen } from '../ui/courier-earnings-screen';
import { CourierHomeScreen } from '../ui/courier-home-screen';
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

    // Un mauvais code ne suffit pas.
    const wrong = pickupPin(mission.orderId) === '0000' ? '0001' : '0000';
    expect(state().confirmPickup(wrong, true)).toEqual({ ok: false, reason: 'code' });
    expect(state().confirmPickup(pickupPin(mission.orderId), true)).toEqual({ ok: true });

    state().startDelivery();
    expect(state().active?.step).toBe('en_livraison');

    // Pas de remise sans preuve.
    expect(state().confirmDelivery('')).toEqual({ ok: false, reason: 'preuve' });
    expect(state().confirmDelivery('file:///preuve.jpg')).toEqual({ ok: true });

    expect(state().active).toBeNull();
    expect(state().history).toHaveLength(1);
    expect(state().history[0]).toMatchObject({
      orderId: mission.orderId,
      gainEur: 3,
      gainComplet: false,
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

describe('<CourierHomeScreen />', () => {
  const props = {
    missions: [mission],
    authenticate: jest.fn().mockResolvedValue(true),
    onPickedUp: jest.fn(),
    onDelivered: jest.fn(),
    onOpenSetup: jest.fn(),
  };

  it('avant la validation du compte : pas de mission, une invitation à finir l’inscription', () => {
    render(<CourierHomeScreen {...props} />);
    expect(screen.getByTestId('courier-open-setup')).toBeTruthy();
    expect(screen.queryByTestId(`courier-offer-${mission.orderId}`)).toBeNull();
  });

  it('hors ligne : aucune offre ; en ligne : l’offre apparaît avec le gain « dès 3,00 € »', () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    render(<CourierHomeScreen {...props} />);
    expect(screen.queryByTestId(`courier-offer-${mission.orderId}`)).toBeNull();

    fireEvent(screen.getByTestId('courier-online-toggle'), 'valueChange', true);
    expect(screen.getByTestId(`courier-offer-${mission.orderId}`)).toHaveTextContent(/dès 3,00 €/);
  });

  it('refuser une offre la retire de la liste', () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    state().setOnline(true);
    render(<CourierHomeScreen {...props} />);
    fireEvent.press(screen.getByTestId(`courier-decline-${mission.orderId}`));
    expect(screen.queryByTestId(`courier-offer-${mission.orderId}`)).toBeNull();
    expect(screen.getByTestId('courier-no-missions')).toBeTruthy();
  });

  it('déroule la mission : code de remise, départ, preuve — et prévient la commande', async () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    state().setOnline(true);
    pick.mockResolvedValue('file:///preuve.jpg');
    const onPickedUp = jest.fn();
    const onDelivered = jest.fn();
    render(<CourierHomeScreen {...props} onPickedUp={onPickedUp} onDelivered={onDelivered} />);

    fireEvent.press(screen.getByTestId(`courier-accept-${mission.orderId}`));
    fireEvent.press(screen.getByTestId('courier-start-route'));

    // Mauvais code d'abord.
    const good = pickupPin(mission.orderId);
    const bad = good === '1234' ? '4321' : '1234';
    fireEvent.changeText(screen.getByTestId('courier-pin'), bad);
    fireEvent.press(screen.getByTestId('courier-confirm-pickup'));
    await waitFor(() => expect(screen.getByTestId('courier-message')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('courier-pin'), good);
    fireEvent.press(screen.getByTestId('courier-confirm-pickup'));
    await waitFor(() => expect(screen.getByTestId('courier-start-delivery')).toBeTruthy());

    fireEvent.press(screen.getByTestId('courier-start-delivery'));
    expect(onPickedUp).toHaveBeenCalledWith(mission.orderId);

    fireEvent.press(screen.getByTestId('courier-confirm-delivery'));
    await waitFor(() => expect(onDelivered).toHaveBeenCalledWith(mission.orderId));
    expect(state().history).toHaveLength(1);
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

describe('missions d’exemple — démonstration au client', () => {
  const props = {
    missions: [] as Mission[],
    authenticate: jest.fn().mockResolvedValue(true),
    onPickedUp: jest.fn(),
    onDelivered: jest.fn(),
    onOpenSetup: jest.fn(),
  };

  it('affichées seulement si on le demande, et signalées « exemples »', () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    state().setOnline(true);

    const { unmount } = render(<CourierHomeScreen {...props} />);
    expect(screen.getByTestId('courier-no-missions')).toBeTruthy();
    unmount();

    render(<CourierHomeScreen {...props} showExamples />);
    expect(screen.getByTestId('courier-examples-badge')).toBeTruthy();
    expect(screen.getByTestId('courier-offer-demo_8892')).toBeTruthy();
  });

  it('un geste active un compte d’exemple et passe en ligne', () => {
    render(<CourierHomeScreen {...props} showExamples />);
    fireEvent.press(screen.getByTestId('courier-demo-activate'));
    expect(state().status).toBe('valide');
    expect(state().online).toBe(true);
  });

  it('une mission d’exemple montre son code de remise de démonstration', () => {
    state().submitProfile({ vehicle: 'velo', zone: 'Toulouse', idUri: 'a', selfieUri: 'b' });
    state().validateAccount();
    state().setOnline(true);
    render(<CourierHomeScreen {...props} showExamples />);
    fireEvent.press(screen.getByTestId('courier-accept-demo_8892'));
    fireEvent.press(screen.getByTestId('courier-start-route'));
    expect(screen.getByTestId('courier-demo-pin')).toHaveTextContent(
      new RegExp(pickupPin('demo_8892')),
    );
  });
});
