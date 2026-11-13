import { Platform, View as MockView } from 'react-native';

import { fireEvent, render, screen } from '@/shared/testing/render';
import { QrScanner } from '@/shared/ui';

type ScanHandler = (event: { data: string }) => void;

let mockPermission: { granted: boolean; status?: string } | null = { granted: true };
const mockRequestPermission = jest.fn();
let mockOnScan: ScanHandler | undefined;
let mockSettings: unknown;

jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
  CameraView: (props: {
    testID?: string;
    onBarcodeScanned?: ScanHandler;
    barcodeScannerSettings?: unknown;
  }) => {
    mockOnScan = props.onBarcodeScanned;
    mockSettings = props.barcodeScannerSettings;
    return <MockView testID={props.testID} />;
  },
}));

describe('<QrScanner />', () => {
  beforeEach(() => {
    mockPermission = { granted: true };
    mockOnScan = undefined;
    mockSettings = undefined;
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a French fallback on web and still lets the user close', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onClose = jest.fn();
    render(<QrScanner onScan={jest.fn()} onClose={onClose} />);

    expect(
      screen.getByText(
        'Le scan n’est pas disponible dans le navigateur. Saisissez le code à la main.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('qr-scanner-camera')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('qr-scanner-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for the camera again when permission is denied', () => {
    mockPermission = { granted: false };
    render(<QrScanner onScan={jest.fn()} onClose={jest.fn()} />);

    expect(
      screen.getByText(
        'L’accès à la caméra est refusé. Autorisez-le dans les réglages ou saisissez le code à la main.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('qr-scanner-camera')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('qr-scanner-allow'));
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('renders nothing heavy while the permission is unknown', () => {
    mockPermission = null;
    render(<QrScanner onScan={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByTestId('qr-scanner')).toBeOnTheScreen();
    expect(screen.queryByTestId('qr-scanner-camera')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('qr-scanner-denied')).not.toBeOnTheScreen();
  });

  it('scans QR codes only, and reports a value once within the debounce window', () => {
    const onScan = jest.fn();
    render(<QrScanner onScan={onScan} onClose={jest.fn()} title="Scanner le colis" />);

    expect(screen.getByText('Scanner le colis')).toBeOnTheScreen();
    expect(mockSettings).toEqual({ barcodeTypes: ['qr'] });

    mockOnScan?.({ data: 'ORDER-1' });
    mockOnScan?.({ data: 'ORDER-1' });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenLastCalledWith('ORDER-1');

    // Une autre valeur passe tout de suite.
    mockOnScan?.({ data: 'ORDER-2' });
    expect(onScan).toHaveBeenCalledTimes(2);
    expect(onScan).toHaveBeenLastCalledWith('ORDER-2');
  });

  it('reports the same value again once the window has elapsed', () => {
    const onScan = jest.fn();
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(2_000_000);
    render(<QrScanner onScan={onScan} onClose={jest.fn()} />);

    mockOnScan?.({ data: 'ORDER-9' });
    now.mockReturnValue(2_001_000);
    mockOnScan?.({ data: 'ORDER-9' });
    expect(onScan).toHaveBeenCalledTimes(1);

    now.mockReturnValue(2_001_600);
    mockOnScan?.({ data: 'ORDER-9' });
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it('calls onClose from the close button', () => {
    const onClose = jest.fn();
    render(<QrScanner onScan={jest.fn()} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('qr-scanner-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('<QrScanner /> — première ouverture', () => {
  it('demande la caméra au lieu d’annoncer un refus qui n’a pas eu lieu', () => {
    mockPermission = { granted: false, status: 'undetermined' };
    mockRequestPermission.mockClear();
    render(<QrScanner onScan={jest.fn()} onClose={jest.fn()} />);
    expect(mockRequestPermission).toHaveBeenCalled();
    expect(screen.queryByTestId('qr-scanner-denied')).not.toBeOnTheScreen();
  });

  it('un vrai refus montre le message', () => {
    mockPermission = { granted: false, status: 'denied' };
    render(<QrScanner onScan={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('qr-scanner-denied')).toBeOnTheScreen();
  });
});
