import { deliveryCode } from '@/shared/lib/handover';
import { currentSettings, usePlatformOverrides } from '@/shared/lib/platform-overrides';
import { fireEvent, render, screen } from '@/shared/testing/render';

import { DemoSettingsScreen } from '../ui/demo-settings-screen';

beforeEach(() => usePlatformOverrides.getState().reset());

describe('réglages de démonstration — le magasin', () => {
  it('sans ajustement, ce sont les valeurs arrêtées le 24/10/2026', () => {
    const s = currentSettings();
    expect(s.deliveryFeeEur).toBe(3);
    expect(s.courierBaseZoneKm).toBe(3);
    expect(s.importantParcelMinEur).toBe(100);
  });

  it('un ajustement se pose par-dessus, et `null` le retire', () => {
    const { setOverride } = usePlatformOverrides.getState();
    setOverride('deliveryFeeEur', 2.5);
    setOverride('courierBaseZoneKm', 4);
    expect(currentSettings().deliveryFeeEur).toBe(2.5);
    expect(currentSettings().courierBaseZoneKm).toBe(4);

    setOverride('courierBaseZoneKm', null);
    expect(currentSettings().courierBaseZoneKm).toBe(3);
  });

  it('ne touche pas aux valeurs que le CDC a tranchées', () => {
    usePlatformOverrides.getState().setOverride('deliveryFeeEur', 9);
    expect(currentSettings().courierBaseFeeEur).toBe(3);
    expect(currentSettings().courierPerKmEur).toBe(0.8);
    expect(currentSettings().freeOperations).toBe(5);
  });

  it('ignore une valeur illisible', () => {
    usePlatformOverrides.getState().setOverride('deliveryFeeEur', Number.NaN);
    expect(currentSettings().deliveryFeeEur).toBe(3);
  });
});

describe('<DemoSettingsScreen />', () => {
  it('dit ce que chaque valeur change, et le met à jour en direct', () => {
    render(<DemoSettingsScreen />);
    expect(screen.getByTestId('demo-effect-deliveryFeeEur')).toHaveTextContent(/3,00/);
    // 3,8 km avec une zone de base de 3 km : 3 € + 0,8 km × 0,80 € = 3,64 €.
    expect(screen.getByTestId('demo-effect-courierBaseZoneKm')).toHaveTextContent(/3,64/);
    // Un colis de 38,50 € sous le seuil de 100 € : l'empreinte n'est pas exigée.
    expect(screen.getByTestId('demo-effect-importantParcelMinEur')).toHaveTextContent(/non exigée/);

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

  it('vider un champ rend la valeur arrêtée, et « revenir » efface tout', () => {
    render(<DemoSettingsScreen />);
    fireEvent.changeText(screen.getByTestId('demo-input-courierBaseZoneKm'), '5');
    expect(currentSettings().courierBaseZoneKm).toBe(5);
    fireEvent.changeText(screen.getByTestId('demo-input-courierBaseZoneKm'), '');
    expect(currentSettings().courierBaseZoneKm).toBe(3);

    fireEvent.changeText(screen.getByTestId('demo-input-deliveryFeeEur'), '4');
    fireEvent.press(screen.getByTestId('demo-reset'));
    expect(currentSettings().deliveryFeeEur).toBe(3);
    expect(screen.getByTestId('demo-input-deliveryFeeEur').props.value).toBe('');
  });
});

// Un garde-fou : l'import du code de remise reste valide (les réglages ne le touchent pas).
it('le code de remise du client ne dépend d’aucun réglage', () => {
  usePlatformOverrides.getState().setOverride('importantParcelMinEur', 10);
  expect(deliveryCode('o1')).toMatch(/^\d{6}$/);
});
