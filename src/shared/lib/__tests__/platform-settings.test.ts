import { isSettled, PLATFORM_SETTINGS } from '../platform-settings';

describe('paramètres de plateforme — CDC V1.0 §12.3', () => {
  it('porte les valeurs que le CDC tranche', () => {
    expect(PLATFORM_SETTINGS.freeOperations).toBe(5);
    expect(PLATFORM_SETTINGS.commissionB2cPct).toBe(5);
    expect(PLATFORM_SETTINGS.pointsPerEuro).toBe(1);
    expect(PLATFORM_SETTINGS.retentionYears).toBe(10);
  });

  it('NE tranche PAS la commission B2B', () => {
    // §10.2 et Remarque 1 : « le taux de 5 % B2C ne doit pas être copié
    // automatiquement sur le B2B […] aucun taux B2B ne doit être codé en dur ».
    // Recopier les 5 % serait la faute la plus facile à commettre ici — et
    // l'une des rares que le cahier des charges interdit noir sur blanc.
    expect(PLATFORM_SETTINGS.commissionB2bPct).toBeNull();
    expect(isSettled('commissionB2bPct')).toBe(false);
  });

  it('NE tranche PAS ce que le client a laissé ouvert', () => {
    // §4.4 et §8.4, tous deux « ANALYSE EN COURS ». Le §14 pose la règle :
    // « un paramètre non finalisé doit être prévu dans l'architecture, mais
    // pas inventé ».
    expect(PLATFORM_SETTINGS.cartHoldSeconds).toBeNull();
    expect(PLATFORM_SETTINGS.pointsTransferCap).toBeNull();
  });

  it('distingue un paramètre arbitré d’un paramètre ouvert', () => {
    expect(isSettled('freeOperations')).toBe(true);
    expect(isSettled('cartHoldSeconds')).toBe(false);
  });
});
