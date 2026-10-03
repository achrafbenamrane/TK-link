import { isSettled, PLATFORM_SETTINGS } from '../platform-settings';

describe('paramètres de plateforme — CDC V1.0 §12.3 et V1.1', () => {
  it('porte les valeurs que le CDC tranche', () => {
    expect(PLATFORM_SETTINGS.freeOperations).toBe(5);
    expect(PLATFORM_SETTINGS.commissionB2cPct).toBe(5);
    expect(PLATFORM_SETTINGS.pointsPerEuro).toBe(1);
    expect(PLATFORM_SETTINGS.retentionYears).toBe(10);
  });

  it('porte la commission B2B tranchée le 31/08/2026 : 5 %, comme le B2C', () => {
    // CDC V1.1, Grossiste > Règle (VALIDÉ) : « la commission B2B est alignée sur
    // le taux B2C (5 %) — décision du 31/08/2026 qui remplace la règle antérieure
    // excluant tout calque automatique entre B2B et B2C ». Elle reste un
    // paramètre administrable, pas une constante du code.
    expect(PLATFORM_SETTINGS.commissionB2bPct).toBe(5);
    expect(isSettled('commissionB2bPct')).toBe(true);
  });

  it('NE tranche PAS ce que le client a laissé ouvert', () => {
    // V1.1, « Points encore ouverts » : la durée de réservation du panier — la
    // réponse reçue (« 2 jours hors alimentaires ») répond à une autre question.
    // Règle de développement (V1.0 §14) : « un paramètre non finalisé doit être
    // prévu dans l'architecture, mais pas inventé ».
    expect(PLATFORM_SETTINGS.cartHoldSeconds).toBeNull();
  });

  it('distingue un paramètre arbitré d’un paramètre ouvert', () => {
    expect(isSettled('freeOperations')).toBe(true);
    expect(isSettled('cartHoldSeconds')).toBe(false);
  });
});
