import { z } from 'zod';

/**
 * Contrat du ticket dématérialisé — le cœur de TK LINK.
 *
 * Le client passe sa carte (ou sa pastille) sur le lecteur du commerçant : le
 * ticket de caisse n'est plus imprimé, il arrive ici. Il est ensuite converti
 * en FACTURE, avec un « certificat de facture unique », et ses données servent
 * à la comptabilité.
 *
 * Les champs extraits reprennent exactement ceux montrés dans la vidéo de
 * présentation : nom de l'organisation, référence du document, date, devise,
 * montants TTC / TVA / HT, date d'échéance.
 *
 * ⚠️ Le matériel (lecteur en caisse) et l'extraction IA ne sont pas branchés :
 * en démo les tickets viennent de `seed.ts`. Ce schéma EST le contrat que le
 * back-end devra respecter — c'est pourquoi il est complet dès maintenant.
 */

/** Une ligne d'achat telle qu'elle figure sur le ticket. */
export const ReceiptLineSchema = z.object({
  label: z.string().min(1),
  qty: z.number().int().positive().default(1),
  /**
   * Prix unitaire TTC, en centimes. Peut être NÉGATIF : une remise s'inscrit
   * comme une ligne à part entière plutôt que d'être retranchée des prix.
   * Le client doit retrouver le prix qu'il a vu ET la remise qu'il a obtenue,
   * et le total d'un ticket doit toujours être la somme de ses lignes — un
   * ticket qui ne se recalcule pas est un ticket que le comptable refuse.
   */
  unitCents: z.number().int(),
});
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

/**
 * Où l'achat a eu lieu : retiré en boutique (Touch & Collect) ou livré.
 *
 * `store` et `online` sont les identifiants historiques ; ils décrivent
 * aujourd'hui le mode de remise, plus un canal de vente.
 */
export const ReceiptChannelSchema = z.enum(['store', 'online']);
export type ReceiptChannel = z.infer<typeof ReceiptChannelSchema>;

/**
 * LES QUATRE DOCUMENTS DU CDC V1.0 §9.1 — et ils ne se confondent pas.
 *
 * Le cahier des charges est formel : « ces objets ne doivent pas être confondus
 * dans la base de données ni dans les workflows ». Ils n'ont ni le même
 * destinataire, ni la même valeur, ni la même durée de vie :
 *
 *  • `preparation` — le ticket de préparation. Document OPÉRATIONNEL, pour la
 *    cuisine, le comptoir ou l'atelier. Il ne sort jamais du commerce, ne prouve
 *    rien et n'a aucune valeur comptable (§6.3).
 *  • `ticket` — le justificatif de transaction remis au client (§9.1).
 *  • `facture` — le document FISCAL, quand il est requis. C'est lui, et lui
 *    seul, que le §9.6 fait conserver dix ans.
 *  • `garantie` — la preuve d'achat rattachée à un produit, dont la durée de
 *    vie suit celle de la garantie, pas celle de l'exercice comptable.
 *
 * Le code n'en connaissait que deux, et traitait tout comme un justificatif.
 * Conséquence concrète : un ticket de cuisine aurait été conservé dix ans et
 * compté dans les documents du client.
 */
export const ReceiptKindSchema = z.enum(['preparation', 'ticket', 'facture', 'garantie']);
export type ReceiptKind = z.infer<typeof ReceiptKindSchema>;

/** Ce que chaque type est, en une ligne — pour les écrans et les filtres. */
export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  preparation: 'Ticket de préparation',
  ticket: 'Ticket',
  facture: 'Facture',
  garantie: 'Garantie',
};

/**
 * Ce document engage-t-il la comptabilité ?
 *
 * Seules les pièces justificatives comptables relèvent des dix ans du §9.6. Un
 * ticket de cuisine et une preuve de garantie n'ont rien à y faire — les
 * conserver aussi longtemps gonfle l'archive sans rien prouver.
 */
export function isAccounting(kind: ReceiptKind): boolean {
  return kind === 'facture' || kind === 'ticket';
}

/**
 * Ce document est-il destiné au CLIENT ?
 *
 * Le ticket de préparation est un document d'atelier : le faire apparaître dans
 * l'espace Documents du client afficherait la cuisine du commerçant.
 */
export function isCustomerFacing(kind: ReceiptKind): boolean {
  return kind !== 'preparation';
}

/**
 * Famille de dépense — sert au classement « par code fournisseur » côté
 * comptabilité, et aux filtres côté app.
 */
export const ReceiptCategorySchema = z.enum([
  'alimentation',
  'restauration',
  'carburant',
  'transport',
  'fournitures',
  'sante',
  'loisirs',
  'autre',
]);
export type ReceiptCategory = z.infer<typeof ReceiptCategorySchema>;

export const ReceiptSchema = z.object({
  id: z.string().min(1),

  /* ---- identité du document (ce que l'IA extrait) ---- */
  /** Nom de l'organisation — l'enseigne qui a émis le ticket. */
  merchant: z.string().min(1),
  /** Référence du document, telle qu'imprimée par la caisse. */
  reference: z.string().min(1),
  /** Date du document (émission), en ms epoch. */
  issuedAt: z.number().int().positive(),
  /** Devise ISO — la vidéo montre le champ, on ne présume pas l'euro partout. */
  currency: z.string().length(3).default('EUR'),

  /* ---- montants, en centimes (jamais de flottant sur de l'argent) ---- */
  /** Montant TTC. */
  totalCents: z.number().int().nonnegative(),
  /** Montant de TVA. */
  vatCents: z.number().int().nonnegative(),
  /** Montant HT. */
  netCents: z.number().int().nonnegative(),
  /** Date d'échéance (factures pro) ; `null` pour un ticket payé comptant. */
  dueAt: z.number().int().positive().nullable().default(null),

  /* ---- classement ---- */
  category: ReceiptCategorySchema.default('autre'),
  /** Code fournisseur utilisé par la compta ; vide tant qu'il n'est pas affecté. */
  supplierCode: z.string().default(''),

  /* ---- contenu & contexte ---- */
  lines: z.array(ReceiptLineSchema).default([]),
  channel: ReceiptChannelSchema.default('store'),
  kind: ReceiptKindSchema.default('ticket'),
  /**
   * Certificat de facture unique — l'empreinte qui rend la facture opposable.
   * Vide tant que le ticket n'a pas été converti.
   */
  certificateId: z.string().default(''),
  /** Points de fidélité gagnés sur cet achat. */
  pointsEarned: z.number().int().nonnegative().default(0),
  /** L'utilisateur peut épingler un ticket (garantie, note de frais…). */
  pinned: z.boolean().default(false),
  /**
   * La commande dont ce ticket est né — CDC §14. Vide pour un passage en
   * caisse, où il n'y a pas de commande dans l'app.
   *
   * C'est ce champ qui garantit qu'une commande ne produit qu'UN ticket : sans
   * lui, chaque ouverture de l'app en émettrait un de plus.
   *
   * `.default('')` obligatoire : les tickets déjà stockés ne l'ont pas, et un
   * champ requis effacerait tout l'historique à la réhydratation.
   */
  orderId: z.string().default(''),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const PersistedReceiptsSchema = z.object({
  receipts: z.array(ReceiptSchema).default([]),
});
export type PersistedReceipts = z.infer<typeof PersistedReceiptsSchema>;
