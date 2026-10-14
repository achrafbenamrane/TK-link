import { isDemoBuild } from './env';

/**
 * FRANCECONNECT — vérifier l'identité d'un livreur sans qu'il dépose de pièce d'identité.
 *
 * Le livreur s'identifie auprès de l'un des comptes de l'État qu'il possède déjà (impots.gouv,
 * ameli, La Poste…). TK LINK ne reçoit ni ne conserve de pièce : seulement l'identité confirmée
 * (prénom, nom), dont l'app ne garde que le strict nécessaire.
 *
 * ⚠️ CE QUI EST BRANCHÉ AUJOURD'HUI, ET CE QUI NE L'EST PAS.
 * L'app ne parle pas à FranceConnect directement. Le flux réel (OpenID Connect) a besoin :
 *   1. d'une HABILITATION de TK LINK comme fournisseur de service (demande via DataPass, à instruire
 *      par l'État : elle n'est pas automatique) ;
 *   2. d'un SERVEUR qui garde le secret client, échange le code d'autorisation et vérifie le jeton —
 *      jamais dans l'app, où un secret serait lisible de tous ;
 *   3. d'un retour dans l'app par lien profond (`tklink://franceconnect`).
 * Tant que ce n'est pas en place, on dispose de DEUX fournisseurs : un simulateur (builds de
 * démonstration, signalé comme tel à l'écran) et un fournisseur « indisponible » qui le dit.
 * Le jour où le serveur existe, on écrit le troisième fournisseur ; les écrans ne changent pas.
 */
export type FranceConnectIdentity = {
  givenName: string;
  familyName: string;
  /** Quand l'identité a été confirmée (ms). */
  verifiedAt: number;
};

export type FranceConnectResult =
  | { ok: true; identity: FranceConnectIdentity }
  | { ok: false; reason: 'annule' | 'indisponible' | 'echec' };

/** Ce que l'écran appelle : ouvre FranceConnect et rend l'identité confirmée, ou la raison du refus. */
export type FranceConnectProvider = () => Promise<FranceConnectResult>;

/** DÉMONSTRATION : une identité fictive, instantanée. Jamais proposée en production. */
export const simulatedFranceConnect: FranceConnectProvider = async () => ({
  ok: true,
  identity: { givenName: 'Alex', familyName: 'Martin', verifiedAt: Date.now() },
});

/** Pas de serveur ni d'habilitation : on le dit, au lieu de faire semblant. */
export const unavailableFranceConnect: FranceConnectProvider = async () => ({
  ok: false,
  reason: 'indisponible',
});

/** Le fournisseur de CETTE build : le simulateur en démonstration, sinon « indisponible ». */
export function franceConnectProvider(): FranceConnectProvider {
  return isDemoBuild ? simulatedFranceConnect : unavailableFranceConnect;
}

/** « Alex M. » : le prénom et l'initiale du nom, pour ne pas étaler l'identité à l'écran. */
export function displayName(identity: Pick<FranceConnectIdentity, 'givenName' | 'familyName'>) {
  const initial = identity.familyName.trim().charAt(0).toUpperCase();
  return `${identity.givenName.trim()}${initial ? ` ${initial}.` : ''}`;
}
