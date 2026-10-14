import { pickImage, pickVideo } from '@/shared/lib/image-picker';
import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { defaultHours, normaliseTime, openStatus, validateHours } from '../lib/shop-profile';
import { EMPTY_PROFILE, PersistedMerchantSchema } from '../model/schema';
import { useMerchantStore } from '../model/store';
import { ShopSettingsScreen } from '../ui/shop-settings-screen';
import { MerchantStatsScreen } from '../ui/stats-screen';

jest.mock('@/shared/lib/image-picker', () => ({
  ...jest.requireActual('@/shared/lib/image-picker'),
  pickImage: jest.fn(),
  pickVideo: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const pick = pickImage as jest.MockedFunction<typeof pickImage>;
const pickV = pickVideo as jest.MockedFunction<typeof pickVideo>;

beforeEach(() => {
  useMerchantStore.getState().resetDemo();
  pick.mockReset();
  pickV.mockReset();
});

describe('horaires — étape 7 du parcours', () => {
  it('démarrent fermés : on n’invente pas d’horaires', () => {
    const hours = defaultHours();
    expect(Object.values(hours).every((h) => !h.open)).toBe(true);
    expect(openStatus(hours, new Date('2026-10-05T10:00:00'))).toBe('Horaires non renseignés');
  });

  it('refuse une fermeture avant l’ouverture, ou une heure mal formée', () => {
    const hours = defaultHours();
    hours.lundi = { open: true, from: '18:00', to: '09:00' };
    hours.mardi = { open: true, from: '9h', to: '18:00' };
    expect(Object.keys(validateHours(hours)).sort()).toEqual(['lundi', 'mardi']);
  });

  it('normalise les saisies courantes : 9h, 9:5, 18', () => {
    expect(normaliseTime('9h')).toBe('09:00');
    expect(normaliseTime('9:5')).toBe('09:05');
    expect(normaliseTime('18')).toBe('18:00');
    expect(normaliseTime('abc')).toBe('abc');
  });

  it('dit si la boutique est ouverte maintenant', () => {
    const hours = defaultHours();
    hours.lundi = { open: true, from: '09:00', to: '19:00' };
    // 5 octobre 2026 est un lundi.
    expect(openStatus(hours, new Date('2026-10-05T10:30:00'))).toBe('Ouvert jusqu’à 19:00');
    expect(openStatus(hours, new Date('2026-10-05T20:00:00'))).toBe('Fermé');
    expect(openStatus(hours, new Date('2026-10-06T10:30:00'))).toBe('Fermé');
  });
});

describe('persistance de la boutique', () => {
  it('relit des données enregistrées avant la boutique, sans rien perdre', () => {
    const parsed = PersistedMerchantSchema.safeParse({ used: 3, purchased: 0 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.used).toBe(3);
      expect(parsed.data.profile.hours.lundi.open).toBe(false);
      expect(parsed.data.profile.modes).toEqual(['touch-collect', 'livraison']);
    }
  });
});

describe('<ShopSettingsScreen />', () => {
  it('enregistre la présentation, un jour d’ouverture et la zone', () => {
    render(<ShopSettingsScreen />);
    fireEvent.changeText(screen.getByTestId('shop-presentation'), 'Pizzeria familiale');
    fireEvent(screen.getByTestId('shop-hours-lundi-open'), 'valueChange', true);
    fireEvent.changeText(screen.getByTestId('shop-hours-lundi-to'), '19:30');
    fireEvent.changeText(screen.getByTestId('shop-zone'), 'Toulouse centre');
    fireEvent.press(screen.getByTestId('shop-save'));

    const profile = useMerchantStore.getState().profile;
    expect(profile.presentation).toBe('Pizzeria familiale');
    expect(profile.hours.lundi).toMatchObject({ open: true, to: '19:30' });
    expect(profile.zone).toBe('Toulouse centre');
    expect(screen.getByTestId('shop-saved')).toBeTruthy();
  });

  it('refuse d’enregistrer des horaires incohérents', () => {
    render(<ShopSettingsScreen />);
    fireEvent(screen.getByTestId('shop-hours-lundi-open'), 'valueChange', true);
    fireEvent.changeText(screen.getByTestId('shop-hours-lundi-from'), '20:00');
    fireEvent.changeText(screen.getByTestId('shop-hours-lundi-to'), '10:00');
    fireEvent.press(screen.getByTestId('shop-save'));

    expect(screen.getByTestId('shop-hours-lundi-error')).toBeTruthy();
    expect(useMerchantStore.getState().profile).toEqual(EMPTY_PROFILE);
  });

  it('ajoute et retire une photo ; refuse de ne proposer aucun mode', async () => {
    pick.mockResolvedValue('file:///a.jpg');
    render(<ShopSettingsScreen />);

    fireEvent.press(screen.getByTestId('shop-photos-add-galerie'));
    await waitFor(() => expect(screen.getByTestId('shop-photos-item')).toBeTruthy());
    fireEvent.press(screen.getByTestId('shop-photos-remove'));
    expect(screen.queryByTestId('shop-photos-item')).toBeNull();

    fireEvent.press(screen.getByTestId('shop-mode-touch-collect'));
    fireEvent.press(screen.getByTestId('shop-mode-livraison'));
    fireEvent.press(screen.getByTestId('shop-save'));
    expect(screen.getByTestId('shop-modes-error')).toBeTruthy();
  });

  it('plafonne les vidéos à deux', async () => {
    pickV.mockResolvedValue({ ok: true, uri: 'file:///v.mp4' });
    render(<ShopSettingsScreen />);
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() => expect(screen.getAllByTestId('shop-videos-item')).toHaveLength(1));
    pickV.mockResolvedValue({ ok: true, uri: 'file:///v2.mp4' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() => expect(screen.getAllByTestId('shop-videos-item')).toHaveLength(2));
    expect(screen.queryByTestId('shop-videos-add-galerie')).toBeNull();
  });
});

describe('<MerchantStatsScreen />', () => {
  it('calcule l’encaissé, la commission de 5 % et la part du commerçant', () => {
    render(<MerchantStatsScreen honouredTotalsCents={[1000, 2000]} ordersCount={4} />);
    expect(screen.getByTestId('stats-gross')).toHaveTextContent('30,00 €');
    expect(screen.getByTestId('stats-commission')).toHaveTextContent(/1,50 €/);
    expect(screen.getByTestId('stats-net')).toHaveTextContent('28,50 €');
    expect(screen.getByTestId('stats-orders')).toHaveTextContent(/^4/);
  });

  it('n’affiche aucun chiffre qu’il ne connaît pas', () => {
    render(<MerchantStatsScreen honouredTotalsCents={[]} ordersCount={0} />);
    expect(screen.queryByText(/clients fidélisés/i)).toBeNull();
  });
});

describe('vidéo du magasin — format standard', () => {
  it('refuse une vidéo trop longue ou trop lourde, en disant pourquoi', async () => {
    render(<ShopSettingsScreen />);

    pickV.mockResolvedValue({ ok: false, reason: 'trop_longue' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() =>
      expect(screen.getByTestId('shop-video-error')).toHaveTextContent(/trop longue/),
    );
    expect(screen.queryByTestId('shop-videos-item')).toBeNull();

    pickV.mockResolvedValue({ ok: false, reason: 'trop_lourde' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() =>
      expect(screen.getByTestId('shop-video-error')).toHaveTextContent(/trop lourde/),
    );
  });

  it('une annulation ne fait pas de bruit, et une vidéo valide efface l’erreur', async () => {
    render(<ShopSettingsScreen />);
    pickV.mockResolvedValue({ ok: false, reason: 'trop_lourde' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() => expect(screen.getByTestId('shop-video-error')).toBeTruthy());

    pickV.mockResolvedValue({ ok: true, uri: 'file:///ok.mp4' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() => expect(screen.getAllByTestId('shop-videos-item')).toHaveLength(1));
    expect(screen.queryByTestId('shop-video-error')).toBeNull();

    pickV.mockResolvedValue({ ok: false, reason: 'annule' });
    fireEvent.press(screen.getByTestId('shop-videos-add-galerie'));
    await waitFor(() => expect(pickV).toHaveBeenCalledTimes(3));
    expect(screen.queryByTestId('shop-video-error')).toBeNull();
  });
});
