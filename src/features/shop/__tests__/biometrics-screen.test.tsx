import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { authenticate, getBiometricSupport } from '../lib/biometrics';
import { useShopStore } from '../model/store';
import { BiometricsScreen } from '../ui/biometrics-screen';

jest.mock('../lib/biometrics', () => ({
  getBiometricSupport: jest.fn(),
  authenticate: jest.fn(),
}));

const mockSupport = jest.mocked(getBiometricSupport);
const mockAuthenticate = jest.mocked(authenticate);

const AVAILABLE = {
  hasHardware: true,
  isEnrolled: true,
  available: true,
  kinds: ['empreinte' as const],
};

const toggle = () => screen.getByTestId('biometric-toggle');

beforeEach(() => {
  jest.clearAllMocks();
  useShopStore.setState({ biometricEnabled: false });
  mockSupport.mockResolvedValue(AVAILABLE);
});

describe('<BiometricsScreen />', () => {
  it('explique que l’empreinte reste sur le téléphone et propose l’activation', async () => {
    render(<BiometricsScreen />);
    await waitFor(() => expect(mockSupport).toHaveBeenCalled());

    expect(screen.getByTestId('biometrics-screen')).toBeOnTheScreen();
    expect(screen.getByText('Votre empreinte reste chez vous')).toBeOnTheScreen();
    expect(screen.getByText('Touchez pour tester')).toBeOnTheScreen();
    expect(toggle().props.disabled).toBeFalsy();
  });

  it('désactive l’interrupteur quand le téléphone n’a pas de capteur', async () => {
    mockSupport.mockResolvedValue({
      hasHardware: false,
      isEnrolled: false,
      available: false,
      kinds: [],
    });
    render(<BiometricsScreen />);

    expect(await screen.findByText(/n’a pas de capteur biométrique/)).toBeOnTheScreen();
    expect(toggle().props.disabled).toBe(true);
  });

  it('dit qu’aucune empreinte n’est enregistrée quand le capteur existe sans empreinte', async () => {
    mockSupport.mockResolvedValue({
      hasHardware: true,
      isEnrolled: false,
      available: false,
      kinds: [],
    });
    render(<BiometricsScreen />);

    expect(await screen.findByText(/Aucune empreinte n’est enregistrée/)).toBeOnTheScreen();
    expect(toggle().props.disabled).toBe(true);
  });

  it('active le déverrouillage seulement après une identification réussie', async () => {
    mockAuthenticate.mockResolvedValue({ ok: true });
    render(<BiometricsScreen />);
    await waitFor(() => expect(mockSupport).toHaveBeenCalled());

    await act(async () => {
      fireEvent(toggle(), 'valueChange', true);
    });

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(useShopStore.getState().biometricEnabled).toBe(true);
    expect(screen.getByText('Identifié')).toBeOnTheScreen();
  });

  it('n’active rien quand l’identification échoue', async () => {
    mockAuthenticate.mockResolvedValue({ ok: false, reason: 'echec' });
    render(<BiometricsScreen />);
    await waitFor(() => expect(mockSupport).toHaveBeenCalled());

    await act(async () => {
      fireEvent(toggle(), 'valueChange', true);
    });

    expect(useShopStore.getState().biometricEnabled).toBe(false);
    expect(screen.getByText('Non reconnu — réessayez')).toBeOnTheScreen();
  });

  it('désactive sans redemander l’empreinte', async () => {
    useShopStore.setState({ biometricEnabled: true });
    render(<BiometricsScreen />);
    await waitFor(() => expect(mockSupport).toHaveBeenCalled());

    await act(async () => {
      fireEvent(toggle(), 'valueChange', false);
    });

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(useShopStore.getState().biometricEnabled).toBe(false);
  });

  it('permet de tester le capteur en touchant le scanner, puis revient au repos', async () => {
    jest.useFakeTimers();
    try {
      mockAuthenticate.mockResolvedValue({ ok: true });
      render(<BiometricsScreen />);

      await act(async () => {
        fireEvent.press(screen.getByTestId('fingerprint-scanner'));
      });
      expect(screen.getByText('Identifié')).toBeOnTheScreen();
      // Un simple test ne change pas le réglage.
      expect(useShopStore.getState().biometricEnabled).toBe(false);

      await act(async () => {
        jest.advanceTimersByTime(1300);
      });
      expect(screen.getByText('Touchez pour tester')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});
