import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { fetchMyShop, fileMyShop } from '../lib/shop-api';
import { useMerchantStore } from '../model/store';
import { ProSetupScreen, stepAfterSync } from '../ui/pro-setup-screen';

/**
 * L'écran du dossier AVEC un serveur : c'est TK LINK qui valide. Pas de bouton de démonstration ;
 * on peut entrer dans l'app en attendant, voir un refus et son motif, et lire ce que le serveur
 * reproche à un dépôt.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('../lib/shop-api', () => ({
  ...jest.requireActual('../lib/shop-api'),
  fetchMyShop: jest.fn(),
  fileMyShop: jest.fn(),
}));
jest.mock('@/shared/lib/image-picker', () => ({
  pickImage: jest.fn().mockResolvedValue('file://id.jpg'),
}));

const fetchShop = fetchMyShop as jest.Mock;
const fileShop = fileMyShop as jest.Mock;

const SHOP = {
  name: 'Le Petit Toulousain',
  category: 'restauration' as const,
  area: 'Toulouse',
  modes: [],
};
const served = (status: string, reviewNote = '') => ({
  ok: true,
  value: {
    ...SHOP,
    kind: 'commercant',
    id: 'shop-1',
    siret: '44306184100047',
    address: '8 rue des Carmes, 31000 Toulouse',
    status,
    reviewNote,
  },
});

const initial = useMerchantStore.getState();
beforeEach(() => {
  useMerchantStore.setState(initial, true);
  jest.clearAllMocks();
  fetchShop.mockResolvedValue({ ok: true, value: null });
});

function renderScreen(onDone = jest.fn()) {
  render(
    <ProSetupScreen
      role="commercant"
      siret="44306184100047"
      address="8 rue des Carmes, 31000 Toulouse"
      shop={SHOP}
      authenticate={jest.fn().mockResolvedValue(true)}
      onDone={onDone}
    />,
  );
  return onDone;
}

async function fillAndSend() {
  fireEvent.changeText(screen.getByTestId('supplier-iban'), 'FR76 3000 6000 0112 3456 7890 189');
  fireEvent.press(screen.getByTestId('supplier-id-add'));
  await screen.findByTestId('supplier-id-preview');
  fireEvent.press(screen.getByTestId('supplier-submit'));
}

it('dossier envoyé : pas de validation simulée, on peut entrer dans l’app en attendant', async () => {
  fileShop.mockResolvedValueOnce(served('en_verification'));
  const onDone = renderScreen();
  await fillAndSend();
  expect(await screen.findByTestId('supplier-verification-status')).toHaveTextContent(/en cours/);
  expect(screen.queryByTestId('supplier-demo-validate')).toBeNull();
  fireEvent.press(screen.getByTestId('supplier-wait-in-app'));
  expect(onDone).toHaveBeenCalled();
});

it('un refus du serveur au dépôt est dit à côté du champ en cause', async () => {
  fileShop.mockResolvedValueOnce({ ok: false, code: 'siret_taken' });
  renderScreen();
  await fillAndSend();
  expect(await screen.findByText(/déjà enregistré par un autre compte/)).toBeTruthy();
  expect(screen.queryByTestId('supplier-verification-status')).toBeNull();
});

it('dossier refusé par TK LINK : le motif, puis la correction', async () => {
  fetchShop.mockResolvedValue(served('refuse', 'Le SIRET ne correspond pas à l’adresse.'));
  renderScreen();
  expect(await screen.findByTestId('supplier-review-note')).toHaveTextContent(
    'Le SIRET ne correspond pas à l’adresse.',
  );
  fireEvent.press(screen.getByTestId('supplier-fix'));
  expect(screen.getByTestId('supplier-submit')).toBeTruthy();
});

it('validé entre-temps (autre téléphone) : l’écran le montre dès l’ouverture', async () => {
  fetchShop.mockResolvedValue(served('valide'));
  renderScreen();
  await waitFor(() =>
    expect(screen.getByTestId('supplier-verification-status')).toHaveTextContent(/vérifié/),
  );
});

describe('stepAfterSync', () => {
  it('ne déplace que les étapes que le serveur contredit', () => {
    expect(stepAfterSync('infos', 'en_verification')).toBe('verification');
    expect(stepAfterSync('infos', 'brouillon')).toBe('infos');
    expect(stepAfterSync('verification', 'brouillon')).toBe('infos');
    expect(stepAfterSync('securite', 'brouillon')).toBe('securite');
  });
});
