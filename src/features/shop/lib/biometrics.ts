import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Déverrouillage biométrique.
 *
 * CE QUE ÇA FAIT — et surtout ce que ça NE fait PAS. L'empreinte ne quitte
 * jamais le matériel sécurisé du téléphone (Secure Enclave sur iOS, TEE sur
 * Android). Aucune application ne reçoit l'image ni les données d'une empreinte :
 * l'OS répond uniquement « oui, c'est le propriétaire du téléphone » ou « non ».
 *
 * Conséquence produit : ceci prouve la PRÉSENCE DU PROPRIÉTAIRE, pas l'IDENTITÉ
 * d'une personne. Pour vérifier qu'un livreur est bien Untel (cf. l'identification
 * biométrique des livreurs évoquée en réunion), il faut un parcours KYC
 * (pièce d'identité + selfie) ou un lecteur d'empreintes dédié — pas ceci.
 */

export type BiometricKind = 'empreinte' | 'visage' | 'iris' | 'code';

export type BiometricSupport = {
  /** Le matériel existe. */
  hasHardware: boolean;
  /** Au moins une empreinte / un visage est enregistré sur le téléphone. */
  isEnrolled: boolean;
  /** Utilisable maintenant. */
  available: boolean;
  kinds: BiometricKind[];
};

const LABELS: Record<number, BiometricKind> = {
  [LocalAuthentication.AuthenticationType.FINGERPRINT]: 'empreinte',
  [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]: 'visage',
  [LocalAuthentication.AuthenticationType.IRIS]: 'iris',
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const kinds = types.map((t) => LABELS[t]).filter((k): k is BiometricKind => Boolean(k));
    return { hasHardware, isEnrolled, available: hasHardware && isEnrolled, kinds };
  } catch {
    return { hasHardware: false, isEnrolled: false, available: false, kinds: [] };
  }
}

export type AuthOutcome = { ok: true } | { ok: false; reason: 'annule' | 'echec' | 'indisponible' };

/**
 * Lance l'invite biométrique du système. C'est l'OS qui affiche sa propre
 * fenêtre — on ne peut pas la styliser, et c'est voulu : l'utilisateur doit
 * pouvoir reconnaître un écran système qu'aucune app ne peut imiter.
 */
export async function authenticate(reason: string): Promise<AuthOutcome> {
  const support = await getBiometricSupport();
  if (!support.available) return { ok: false, reason: 'indisponible' };

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    if (result.success) return { ok: true };
    const cancelled =
      'error' in result && (result.error === 'user_cancel' || result.error === 'system_cancel');
    return { ok: false, reason: cancelled ? 'annule' : 'echec' };
  } catch {
    return { ok: false, reason: 'echec' };
  }
}
