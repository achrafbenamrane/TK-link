import { deliveryCode } from '@/shared/lib/handover';
import { fireEvent, render, screen } from '@/shared/testing/render';

import type { Mission } from '../model/store';
import { FinalValidation } from '../ui/final-validation';

// Le vrai scanner exige une caméra : ce double « scanne » ce que le test lui donne.
let mockScanned = '';
jest.mock('@/shared/ui/qr-scanner', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- la fabrique ne voit pas les imports
  const { Pressable } = require('react-native');
  return {
    QrScanner: ({ onScan }: { onScan: (v: string) => void }) => (
      <Pressable testID="mock-qr" onPress={() => onScan(mockScanned)} />
    ),
  };
});

const mission: Mission = {
  orderId: 'ord_abc123',
  merchantName: 'Sushi Tokyo',
  merchantArea: '12 rue des Arts',
  dropoff: '24 rue des Lilas',
  itemCount: 2,
  totalEur: 20,
  distanceKm: 2.4,
  clientName: 'Emma Bernard',
};

const ok = { ok: true } as const;
const refused = { ok: false, reason: 'code' } as const;

describe('<FinalValidation /> — QR et code du client', () => {
  beforeEach(() => {
    mockScanned = '';
  });

  it('le QR du client valide la remise avec son code, sans saisie', () => {
    const onValidate = jest.fn().mockReturnValue(ok);
    render(
      <FinalValidation
        mission={mission}
        doneAt={null}
        onValidate={onValidate}
        onClose={jest.fn()}
      />,
    );

    mockScanned = JSON.stringify({ v: 1, id: mission.orderId, d: deliveryCode(mission.orderId) });
    fireEvent.press(screen.getByTestId('courier-scan-delivery'));
    fireEvent.press(screen.getByTestId('mock-qr'));

    expect(onValidate).toHaveBeenCalledWith(deliveryCode(mission.orderId));
  });

  it('refuse le QR d’une autre commande, ou qui n’est pas un QR TK LINK', () => {
    const onValidate = jest.fn().mockReturnValue(ok);
    render(
      <FinalValidation
        mission={mission}
        doneAt={null}
        onValidate={onValidate}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('courier-scan-delivery'));
    mockScanned = JSON.stringify({ v: 1, id: 'autre', d: '123456' });
    fireEvent.press(screen.getByTestId('mock-qr'));
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/pas celui de cette commande/);

    fireEvent.press(screen.getByTestId('courier-scan-delivery'));
    mockScanned = 'https://exemple.fr';
    fireEvent.press(screen.getByTestId('mock-qr'));
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/pas celui de cette commande/);
    expect(onValidate).not.toHaveBeenCalled();
  });

  it('un code refusé par la mission affiche le message, sans valider', () => {
    const onValidate = jest.fn().mockReturnValue(refused);
    render(
      <FinalValidation
        mission={mission}
        doneAt={null}
        onValidate={onValidate}
        onClose={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByTestId('courier-delivery-code'), '000000');
    fireEvent.press(screen.getByTestId('courier-confirm-delivery'));
    expect(screen.getByTestId('courier-message')).toHaveTextContent(/pas celui du client/);
  });

  it('après la remise : confirmation, plus de saisie, retour aux missions', () => {
    const onClose = jest.fn();
    render(
      <FinalValidation
        mission={mission}
        doneAt={Date.now()}
        onValidate={jest.fn()}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId('courier-delivered')).toHaveTextContent(/Livraison confirmée/);
    expect(screen.queryByTestId('courier-delivery-code')).toBeNull();
    fireEvent.press(screen.getByTestId('courier-delivered-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
