import { isSupabaseConfigured } from '@/shared/lib/env';
import { supabase } from '@/shared/lib/supabase';

import {
  NewTicketSchema,
  type NewTicket,
  type SupportMessage,
  SupportMessageSchema,
  type Ticket,
  TicketSchema,
} from '../model/schema';

/**
 * LE SUPPORT TK LINK SUR LE SERVEUR — tables `support_tickets` et `support_messages` (0014).
 *
 * La personne connectée lit SES demandes (RLS), en ouvre une, y écrit. Elle ne choisit ni le statut
 * ni l’auteur « TK LINK » : le serveur les pose (déclencheurs). Les réponses arrivent en direct
 * (Supabase Realtime, sous la même RLS).
 */

export type SupportError =
  /** Pas de serveur : l’app tourne en démonstration. */
  | 'not_configured'
  /** Le serveur n’a pas encore les tables du support (migration 0014 non appliquée). */
  | 'unavailable'
  | 'not_signed_in'
  /** Cinq demandes ouvertes en 24 heures. */
  | 'too_many_tickets'
  /** La demande est fermée : on en ouvre une nouvelle. */
  | 'ticket_closed'
  | 'invalid'
  | 'network'
  | 'unknown';

type Result<T> = { ok: true; value: T } | { ok: false; code: SupportError };

const TICKET_COLUMNS = 'id, category, subject, status, order_id, last_message_at';
const MESSAGE_COLUMNS = 'id, ticket_id, body, from_staff, created_at';

/** Traduit une erreur PostgREST ou réseau. */
export function classifySupportError(error: unknown): SupportError {
  const e = error as { code?: string; message?: string } | null | undefined;
  const message = String(e?.message ?? error ?? '');
  // Table absente du serveur (PostgREST : PGRST205 ; Postgres : 42P01).
  if (e?.code === 'PGRST205' || e?.code === '42P01') return 'unavailable';
  if (/too_many_tickets/.test(message)) return 'too_many_tickets';
  if (/ticket_closed/.test(message)) return 'ticket_closed';
  if (e?.code === '23514' || e?.code === '22P02' || e?.code === '42501') return 'invalid';
  if (/network|failed to fetch|fetch failed|timed? ?out/i.test(message)) return 'network';
  return 'unknown';
}

const parseAll = <T>(rows: unknown, parse: (r: unknown) => T | null): T[] =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const v = parse(r);
    return v ? [v] : [];
  });
const ticketOf = (r: unknown): Ticket | null => {
  const p = TicketSchema.safeParse(r);
  return p.success ? p.data : null;
};
const messageOf = (r: unknown): SupportMessage | null => {
  const p = SupportMessageSchema.safeParse(r);
  return p.success ? p.data : null;
};

async function signedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/** Mes demandes, la plus récente en tête. */
export async function fetchTickets(): Promise<Result<Ticket[]>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    if (!(await signedIn())) return { ok: false, code: 'not_signed_in' };
    const { data, error } = await supabase
      .from('support_tickets')
      .select(TICKET_COLUMNS)
      .order('last_message_at', { ascending: false });
    if (error) return { ok: false, code: classifySupportError(error) };
    return { ok: true, value: parseAll(data, ticketOf) };
  } catch (error) {
    return { ok: false, code: classifySupportError(error) };
  }
}

/** Une demande et ses messages, du plus ancien au plus récent. */
export async function fetchThread(
  ticketId: string,
): Promise<Result<{ ticket: Ticket; messages: SupportMessage[] }>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  try {
    const [t, m] = await Promise.all([
      supabase.from('support_tickets').select(TICKET_COLUMNS).eq('id', ticketId).maybeSingle(),
      supabase
        .from('support_messages')
        .select(MESSAGE_COLUMNS)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    ]);
    if (t.error || m.error) return { ok: false, code: classifySupportError(t.error ?? m.error) };
    const ticket = ticketOf(t.data);
    if (!ticket) return { ok: false, code: 'unknown' };
    return { ok: true, value: { ticket, messages: parseAll(m.data, messageOf) } };
  } catch (error) {
    return { ok: false, code: classifySupportError(error) };
  }
}

/** Ouvre une demande avec son premier message. Rend l’identifiant de la demande. */
export async function openTicket(input: NewTicket): Promise<Result<string>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  const parsed = NewTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid' };
  try {
    if (!(await signedIn())) return { ok: false, code: 'not_signed_in' };
    const { category, subject, body, orderId } = parsed.data;
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ category, subject, order_id: orderId })
      .select('id')
      .single();
    if (error || !data) return { ok: false, code: classifySupportError(error) };
    const ticketId = (data as { id: string }).id;
    const sent = await sendMessage(ticketId, body);
    // La demande existe même si le premier message n’est pas parti : on l’ouvre, la personne
    // pourra renvoyer son message depuis la conversation.
    return sent.ok || sent.code === 'network' ? { ok: true, value: ticketId } : sent;
  } catch (error) {
    return { ok: false, code: classifySupportError(error) };
  }
}

/** Écrit dans une demande. */
export async function sendMessage(ticketId: string, body: string): Promise<Result<null>> {
  if (!isSupabaseConfigured) return { ok: false, code: 'not_configured' };
  const text = body.trim();
  if (!text || text.length > 2000) return { ok: false, code: 'invalid' };
  try {
    const { error } = await supabase
      .from('support_messages')
      .insert({ ticket_id: ticketId, body: text });
    return error ? { ok: false, code: classifySupportError(error) } : { ok: true, value: null };
  } catch (error) {
    return { ok: false, code: classifySupportError(error) };
  }
}

/**
 * Les nouveaux messages d’une demande, en direct (dont les réponses de TK LINK). Rend la fonction
 * qui arrête l’écoute. Sans serveur, n’écoute rien.
 */
export function watchThread(ticketId: string, onMessage: (m: SupportMessage) => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const channel = supabase
    .channel(`support-${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        const m = messageOf(payload.new);
        if (m) onMessage(m);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
