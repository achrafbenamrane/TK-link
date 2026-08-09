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
  /** Prix unitaire TTC, en centimes. */
  unitCents: z.number().int().nonnegative(),
});
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

/**
 * Où l'achat a eu lieu. La vidéo montre les deux : passage en caisse avec la
 * carte, et commande en ligne rattachée au même compte.
 */
export const ReceiptChannelSchema = z.enum(['store', 'online']);
export type ReceiptChannel = z.infer<typeof ReceiptChannelSchema>;

/**
 * Un ticket devient une facture automatiquement. On garde l'état parce que
 * l'utilisateur voit les deux : le ticket qu'il vient de recevoir, puis la
 * facture certifiée qui part au comptable.
 */
export const ReceiptKindSchema = z.enum(['ticket', 'facture']);
export type ReceiptKind = z.infer<typeof ReceiptKindSchema>;

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
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const PersistedReceiptsSchema = z.object({
  receipts: z.array(ReceiptSchema).default([]),
});
export type PersistedReceipts = z.infer<typeof PersistedReceiptsSchema>;
