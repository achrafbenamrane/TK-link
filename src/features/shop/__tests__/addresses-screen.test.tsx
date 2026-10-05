import { Alert } from 'react-native';

import { act, fireEvent, render, screen } from '@/shared/testing/render';

import { useShopStore } from '../model/store';
import { AddressesScreen } from '../ui/addresses-screen';

const maison = {
  id: 'a1',
  label: 'Maison',
  street: '12 rue des Filatiers',
  zip: '31000',
  city: 'Toulouse',
  notes: 'Digicode 1234',
  isDefault: true,
};
const bureau = {
  id: 'a2',
  label: 'Bureau',
  street: '4 place du Capitole',
  zip: '31000',
  city: 'Toulouse',
  isDefault: false,
};

const fill = (testID: string, value: string) =>
  fireEvent.changeText(screen.getByTestId(testID), value);

beforeEach(() => {
  useShopStore.setState({ addresses: [] });
  jest.restoreAllMocks();
});

describe('<AddressesScreen />', () => {
  it('invite à ajouter une adresse quand la liste est vide', () => {
    render(<AddressesScreen />);
    expect(screen.getByTestId('addresses-empty')).toBeOnTheScreen();
    expect(screen.getByText('Aucune adresse')).toBeOnTheScreen();
    expect(screen.getByTestId('address-add')).toBeOnTheScreen();
  });

  it('refuse une adresse incomplète en indiquant chaque champ à corriger', () => {
    render(<AddressesScreen />);
    fireEvent.press(screen.getByTestId('address-add'));
    fireEvent.press(screen.getByTestId('address-save'));

    expect(screen.getByText('Donnez un nom à cette adresse')).toBeOnTheScreen();
    expect(screen.getByText('Indiquez la rue et le numéro')).toBeOnTheScreen();
    expect(screen.getByText('Le code postal doit contenir 5 chiffres')).toBeOnTheScreen();
    expect(useShopStore.getState().addresses).toHaveLength(0);

    // L’erreur disparaît dès que le champ est corrigé.
    fill('address-label', 'Maison');
    expect(screen.queryByText('Donnez un nom à cette adresse')).toBeNull();
  });

  it('ajoute une adresse valide : elle devient celle par défaut', () => {
    render(<AddressesScreen />);
    fireEvent.press(screen.getByTestId('address-add'));
    fill('address-label', 'Maison');
    fill('address-street', '12 rue des Filatiers');
    fill('address-zip', '31000');
    fireEvent.press(screen.getByTestId('address-save'));

    const { addresses } = useShopStore.getState();
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      label: 'Maison',
      street: '12 rue des Filatiers',
      zip: '31000',
      city: 'Toulouse',
      isDefault: true,
    });
    // Retour à la liste, avec la carte de la nouvelle adresse.
    expect(screen.getByTestId(`address-${addresses[0]!.id}`)).toBeOnTheScreen();
    expect(screen.getByText('PAR DÉFAUT')).toBeOnTheScreen();
  });

  it('annule la saisie sans rien enregistrer', () => {
    render(<AddressesScreen />);
    fireEvent.press(screen.getByTestId('address-add'));
    fill('address-label', 'Maison');
    fireEvent.press(screen.getByText('Annuler'));

    expect(screen.getByTestId('addresses-empty')).toBeOnTheScreen();
    expect(useShopStore.getState().addresses).toHaveLength(0);
  });

  it('modifie une adresse existante, formulaire prérempli', () => {
    useShopStore.setState({ addresses: [maison, bureau] });
    render(<AddressesScreen />);

    fireEvent.press(screen.getByTestId('address-edit-a1'));
    expect(screen.getByTestId('address-label').props.value).toBe('Maison');
    expect(screen.getByTestId('address-notes').props.value).toBe('Digicode 1234');

    fill('address-label', 'Domicile');
    fireEvent.press(screen.getByTestId('address-save'));

    const updated = useShopStore.getState().addresses.find((a) => a.id === 'a1');
    expect(updated?.label).toBe('Domicile');
    expect(screen.getByText('Domicile')).toBeOnTheScreen();
  });

  it('définit une autre adresse par défaut', () => {
    useShopStore.setState({ addresses: [maison, bureau] });
    render(<AddressesScreen />);

    fireEvent.press(screen.getByText('Définir par défaut'));

    const { addresses } = useShopStore.getState();
    expect(addresses.find((a) => a.id === 'a2')?.isDefault).toBe(true);
    expect(addresses.find((a) => a.id === 'a1')?.isDefault).toBe(false);
  });

  it('demande confirmation avant de supprimer, puis retire l’adresse', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useShopStore.setState({ addresses: [maison, bureau] });
    render(<AddressesScreen />);

    fireEvent.press(screen.getByTestId('address-delete-a2'));
    expect(alert).toHaveBeenCalledTimes(1);
    // Rien n’est supprimé tant que l’utilisateur n’a pas confirmé.
    expect(useShopStore.getState().addresses).toHaveLength(2);

    const buttons = alert.mock.calls[0]![2]!;
    act(() => {
      buttons.find((b) => b.style === 'destructive')!.onPress!();
    });

    expect(useShopStore.getState().addresses.map((a) => a.id)).toEqual(['a1']);
  });
});
