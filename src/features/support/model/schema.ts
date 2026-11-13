import { z } from 'zod';

/**
 * Les demandes au support TK LINK (migration 0014_support). Lues du serveur, validées ici avant
 * d’atteindre un écran : une colonne renommée doit échouer lisiblement, pas trois écrans plus loin.
 */

export const TICKET_CATEGORIES = [
  'commande',
  'paiement',
  'livraison',
  'compte',
  'commerce',
  'autre',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  commande: 'Une commande',
  paiement: 'Un paiement',
  livraison: 'Une livraison',
  compte: 'Mon compte',
  commerce: 'Mon commerce',
  autre: 'Autre chose',
};

export const TICKET_STATUSES = ['ouvert', 'en_cours', 'resolu', 'ferme'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  ouvert: 'Envoyée',
  en_cours: 'En cours',
  resolu: 'Résolue',
  ferme: 'Fermée',
};

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const BODY_MAX = 2000;

export const TicketSchema = z
  .object({
    id: z.string(),
    category: z.enum(TICKET_CATEGORIES),
    subject: z.string(),
    status: z.enum(TICKET_STATUSES),
    order_id: z.string().nullable(),
    last_message_at: z.string(),
  })
  .transform((t) => ({
    id: t.id,
    category: t.category,
    subject: t.subject,
    status: t.status,
    orderId: t.order_id,
    lastMessageAt: Date.parse(t.last_message_at),
  }));
export type Ticket = z.output<typeof TicketSchema>;

export const SupportMessageSchema = z
  .object({
    id: z.string(),
    ticket_id: z.string(),
    body: z.string(),
    from_staff: z.boolean(),
    created_at: z.string(),
  })
  .transform((m) => ({
    id: m.id,
    ticketId: m.ticket_id,
    body: m.body,
    fromStaff: m.from_staff,
    at: Date.parse(m.created_at),
  }));
export type SupportMessage = z.output<typeof SupportMessageSchema>;

/** Ce que la personne saisit pour ouvrir une demande. */
export const NewTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z
    .string()
    .trim()
    .min(SUBJECT_MIN, 'Un sujet de quelques mots.')
    .max(SUBJECT_MAX, `${SUBJECT_MAX} caractères au plus.`),
  body: z
    .string()
    .trim()
    .min(1, 'Décrivez votre demande.')
    .max(BODY_MAX, `${BODY_MAX} caractères au plus.`),
  orderId: z.uuid().nullable().default(null),
});
export type NewTicket = z.input<typeof NewTicketSchema>;
