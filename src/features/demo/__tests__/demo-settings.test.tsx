import { deliveryCode } from '@/shared/lib/handover';
import { currentSettings, usePlatformOverrides } from '@/shared/lib/platform-overrides';
import { fireEvent, render, screen } from '@/shared/testing/render';

import { DemoSettingsScreen } from '../ui/demo-settings-screen';

beforeEach(() => usePlatformOverrides.getState().reset());

describe('réglages de démonstration — le magasin', () => {
  it('sans ajustement, ce sont les valeurs du CDC (et « à définir » reste null)', () => {
    const s = currentSettings();
    expect(s.deliveryFeeEur).toBe(0);
    expect(s.courierBaseZoneKm).toBeNull();
    expect(s.importantParcelMinEur).toBeNull();
  });

  it('un ajustement se pose par-dessus, et `null` le retire', () => {
    const { setOverride } = usePlatformOverrides.getState();
    setOverride('deliveryFeeEur', 2.5);
    setOverride('courierBaseZoneKm', 4);
    expect(currentSettings().deliveryFeeEur).toBe(2.5);
    expect(currentSettings().courierBaseZoneKm).toBe(4);

    setOverride('courierBaseZoneKm', null);
    expect(currentSettings().courierBaseZoneKm).toBeNull();
  });

  it('ne touche pas aux valeurs que le CDC a tranchées', () => {
    usePlatformOverrides.getState().setOverride('deliveryFeeEur', 9);
    expect(currentSettings().courierBaseFeeEur).toBe(3);
    expect(currentSettings().courierPerKmEur).toBe(0.8);
    expect(currentSettings().freeOperations).toBe(5);
  });

  it('ignore une valeur illisible', () => {
    usePlatformOverrides.getState().setOverride('deliveryFeeEur', Number.NaN);
    expect(currentSettings().deliveryFeeEur).toBe(0);
  });
});

describe('<DemoSettingsScreen />', () => {
  it('dit ce que chaque valeur change, et le met à jour en direct', () => {
    render(<DemoSettingsScreen />);
    expect(screen.getByTestId('demo-effect-deliveryFeeEur')).toHaveTextContent(/livraison offerte/);
    expect(screen.getByTestId('demo-effect-courierBaseZoneKm')).toHaveTextContent(/dès 3,00/);
    expect(screen.getByTestId('demo-effect-importantParcelMinEur')).toHaveTextContent(
      /exigée pour tous les colis/,
    );

    fireEvent.changeText(screen.getByTestId('demo-input-deliveryFeeEur'), '2,5');
    expect(screen.getByTestId('demo-effect-deliveryFeeEur')).toHaveTextContent(/2,50/);
    expect(currentSettings().deliveryFeeEur).toBe(2.5);

    // Une zone de 2 km : une course de 3,8 km rapporte 3 € + 1,8 km × 0,80 € = 4,44 €.
    fireEvent.changeText(screen.getByTestId('demo-input-courierBaseZoneKm'), '2');
    expect(screen.getByTestId('demo-effect-courierBaseZoneKm')).toHaveTextContent(/4,44/);

    // Un colis de 38,50 € sous un seuil de 50 € : l'empreinte n'est plus exigée.
    fireEvent.changeText(screen.getByTestId('demo-input-importantParcelMinEur'), '50');
    expect(screen.getByTestId('demo-effect-importantParcelMinEur')).toHaveTextContent(/non exigée/);
    fireEvent.changeText(screen.getByTestId('demo-input-importantParcelMinEur'), '30');
    expect(screen.getByTestId('demo-effect-importantParcelMinEur')).toHaveTextContent(/exigée \(/);
  });

  it('vider un champ remet « à définir », et « tout remettre à zéro » efface tout', () => {
    render(<DemoSettingsScreen />);
    fireEvent.changeText(screen.getByTestId('demo-input-courierBaseZoneKm'), '3');
    expect(currentSettings().courierBaseZoneKm).toBe(3);
    fireEvent.changeText(screen.getByTestId('demo-input-courierBaseZoneKm'), '');
    expect(currentSettings().courierBaseZoneKm).toBeNull();

    fireEvent.changeText(screen.getByTestId('demo-input-deliveryFeeEur'), '4');
    fireEvent.press(screen.getByTestId('demo-reset'));
    expect(currentSettings().deliveryFeeEur).toBe(0);
    expect(screen.getByTestId('demo-input-deliveryFeeEur').props.value).toBe('');
  });
});

// Un garde-fou : l'import du code de remise reste valide (les réglages ne le touchent pas).
it('le code de remise du client ne dépend d’aucun réglage', () => {
  usePlatformOverrides.getState().setOverride('importantParcelMinEur', 10);
  expect(deliveryCode('o1')).toMatch(/^\d{6}$/);
});
