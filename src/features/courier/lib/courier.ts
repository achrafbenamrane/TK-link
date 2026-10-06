import { isImportantParcel } from '@/shared/lib/handover';
import { currentSettings } from '@/shared/lib/platform-overrides';
import type { PlatformSettings } from '@/shared/lib/platform-settings';

/**
 * TK DELIVER — le livreur. CDC V1.1 §4 et schéma « Process livreur » du client.
 *
 * Tout ce qui est règle (statuts, gains, véhicule) est ici, pur, sans écran :
 * c'est ce que les tests exercent.
 */

/** Type de véhicule déclaré à l'inscription — filtre d'attribution des missions (V1.1). */
export const VEHICLES = ['velo', 'scooter', 'voiture'] as const;
export type Vehicle = (typeof VEHICLES)[number];

export const VEHICLE_LABEL: Record<Vehicle, string> = {
  velo: 'Vélo',
  scooter: 'Scooter',
  voiture: 'Voiture',
};

/**
 * Les étapes d'une mission, telles que le client les dessine (« Statuts mission ») :
 * Disponible → Mission reçue → Acceptée → En route commerçant → Prise en charge →
 * En livraison → Livrée. « Disponible » et « Mission reçue » sont des états du
 * livreur et de l'offre ; une mission acceptée commence à `acceptee`.
 */
export const MISSION_STEPS = [
  'acceptee',
  'en_route_commercant',
  'prise_en_charge',
  'en_livraison',
  'livree',
] as const;
export type MissionStep = (typeof MISSION_STEPS)[number];

export const STEP_LABEL: Record<MissionStep, string> = {
  acceptee: 'Acceptée',
  en_route_commercant: 'En route vers le commerçant',
  prise_en_charge: 'Prise en charge',
  en_livraison: 'En livraison',
  livree: 'Livrée',
};

/**
 * La frise « Progression de la mission » de l'écran Mission active : cinq lignes. « Récupérée »
 * est la prise en charge, « Validation finale » la remise au client.
 */
export const TIMELINE: { step: MissionStep; label: string }[] = [
  { step: 'acceptee', label: 'Acceptée' },
  { step: 'en_route_commercant', label: 'En route vers le commerce' },
  { step: 'prise_en_charge', label: 'Récupérée' },
  { step: 'en_livraison', label: 'En route vers le client' },
  { step: 'livree', label: 'Validation finale' },
];

export type TimelineState = 'fait' | 'en_cours' | 'a_venir';

/** Où en est chaque ligne de la frise quand la mission est à l'étape `current`. */
export function timelineState(line: MissionStep, current: MissionStep): TimelineState {
  const l = MISSION_STEPS.indexOf(line);
  const c = MISSION_STEPS.indexOf(current);
  // « Validation finale » n'est jamais « faite » tant que la mission est active : elle finit la mission.
  if (l < c) return 'fait';
  return l === c ? 'en_cours' : 'a_venir';
}

export function nextStep(step: MissionStep): MissionStep | null {
  const i = MISSION_STEPS.indexOf(step);
  return MISSION_STEPS[i + 1] ?? null;
}

/**
 * Le livreur peut-il recevoir des missions ? Compte validé par TK LINK (identité
 * vérifiée — V1.1 « Livreur > Règle ») ET disponibilité activée.
 */
export type AccountStatus = 'brouillon' | 'en_verification' | 'valide';

export function canReceiveMissions(status: AccountStatus, online: boolean): boolean {
  return status === 'valide' && online;
}

/** Ce qui manque à un dossier pour partir en vérification (étape 3 du parcours). */
export type ProfileDraft = {
  vehicle: Vehicle | null;
  zone: string;
  idUri: string;
  selfieUri: string;
};

export function missingProfileFields(p: ProfileDraft): Record<string, string> {
  const out: Record<string, string> = {};
  if (!p.vehicle) out.vehicle = 'Choisissez votre véhicule.';
  if (p.zone.trim().length < 2) out.zone = 'Indiquez votre zone d’activité.';
  if (!p.idUri) out.idUri = 'Ajoutez une photo de votre pièce d’identité.';
  if (!p.selfieUri) out.selfieUri = 'Ajoutez un selfie.';
  return out;
}

/**
 * Le gain d'une course — CDC V1.1 : « 3,00 € par commande, puis 0,80 €/km au-delà
 * de la zone de base ».
 *
 * ⚠️ La zone de base n'est PAS chiffrée par le CDC (`courierBaseZoneKm` est
 * `null`). Tant qu'on ne la connaît pas, ou qu'on ne connaît pas la distance, on
 * ne calcule pas la majoration : le montant rendu est le forfait seul, et
 * `complet` vaut `false` pour que l'écran le dise au lieu d'afficher un faux total.
 */
export type Gain = { eur: number; complet: boolean };

export function courierGain(
  distanceKm: number | null,
  settings: Pick<
    PlatformSettings,
    'courierBaseFeeEur' | 'courierPerKmEur' | 'courierBaseZoneKm'
  > = currentSettings(),
): Gain {
  const base = settings.courierBaseFeeEur;
  if (settings.courierBaseZoneKm === null || distanceKm === null) {
    return { eur: base, complet: false };
  }
  const extraKm = Math.max(0, distanceKm - settings.courierBaseZoneKm);
  return {
    eur: Math.round((base + extraKm * settings.courierPerKmEur) * 100) / 100,
    complet: true,
  };
}

/**
 * L'empreinte du livreur est-elle exigée au retrait de ce colis ?
 *
 * Tant que le seuil du « colis important » n'est pas arrêté (`null`), oui pour TOUS : on prend la
 * règle la plus stricte plutôt que d'en inventer une plus souple. Une fois le seuil posé, seuls les
 * colis qui l'atteignent l'exigent.
 */
export function identityRequired(
  totalEur: number,
  minEur: number | null = currentSettings().importantParcelMinEur,
): boolean {
  return minEur === null || isImportantParcel(totalEur, minEur);
}

export function formatEur(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`;
}
