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

  it('porte les valeurs arrêtées le 24/10/2026, quand Farid a laissé le développeur trancher', () => {
    // Le CDC (V1.0 §14) interdit d'INVENTER ce qu'il laisse ouvert ; ici ce n'est pas une invention :
    // le client a délégué la décision. Les valeurs restent des défauts, réglables par le Super Admin.
    expect(PLATFORM_SETTINGS.deliveryBaseZoneKm).toBe(3);
    expect(PLATFORM_SETTINGS.deliveryPerKmEur).toBe(0.8);
    expect(PLATFORM_SETTINGS.cartHoldSeconds).toBe(600);
    expect(PLATFORM_SETTINGS.deliveryFeeEur).toBe(3);
  });

  it('plus aucun réglage de livreur : les livraisons sont confiées à Uber Direct (13/11/2026)', () => {
    for (const key of Object.keys(PLATFORM_SETTINGS)) expect(key).not.toMatch(/courier|parcel/i);
  });

  it('tout est arbitré aujourd’hui ; un paramètre vidé redeviendrait « ouvert »', () => {
    expect(isSettled('freeOperations')).toBe(true);
    expect(isSettled('cartHoldSeconds')).toBe(true);
    expect(isSettled('deliveryBaseZoneKm')).toBe(true);
  });
});
