import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { supabase } from '@/shared/lib/supabase';

import { formatWhen } from '../lib/format';
import { classifySupportError, openTicket, sendMessage } from '../lib/support-api';
import { NewTicketScreen } from '../ui/new-ticket-screen';
import { SupportScreen } from '../ui/support-screen';
import { mergeMessages, TicketScreen } from '../ui/ticket-screen';

/**
 * Le support TK LINK (rapport d’avancement du 13/11/2026) : écrire à l’équipe, suivre ses
 * demandes, lire la réponse. Le serveur (migration 0014) est simulé.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);

const channel = { on: jest.fn(), subscribe: jest.fn() };
jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const from = supabase.from as unknown as jest.Mock;
const getSession = supabase.auth.getSession as unknown as jest.Mock;

const TICKET = {
  id: '11111111-1111-4111-8111-111111111111',
  category: 'commande',
  subject: 'Brioche manquante',
  status: 'en_cours',
  order_id: null,
  last_message_at: '2026-11-13T10:00:00Z',
};
const msg = (id: string, fromStaff: boolean, at: string) => ({
  id,
  ticket_id: TICKET.id,
  body: fromStaff ? 'Nous regardons.' : 'Il manquait une brioche.',
  from_staff: fromStaff,
  created_at: at,
});

/** Un faux client PostgREST : chaque table rend ce qu’on lui donne. */
function serve(tables: Record<string, { data?: unknown; error?: unknown }>) {
  const inserted: Record<string, unknown[]> = {};
  from.mockImplementation((table: string) => {
    const result = tables[table] ?? { data: [], error: null };
    const chain: Record<string, jest.Mock> & { then?: unknown } = {};
    for (const k of ['select', 'eq', 'order']) chain[k] = jest.fn(() => chain);
    chain.insert = jest.fn((row: unknown) => {
      (inserted[table] ??= []).push(row);
      return chain;
    });
    chain.single = jest.fn(async () => ({ data: result.data, error: result.error ?? null }));
    chain.maybeSingle = jest.fn(async () => ({ data: result.data, error: result.error ?? null }));
    chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: result.data, error: result.error ?? null });
    return chain;
  });
  return inserted;
}

beforeEach(() => {
  from.mockReset();
  mockServer.configured = true;
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  (supabase.channel as unknown as jest.Mock).mockReturnValue(channel);
});

describe('client du support', () => {
  it('ouvre une demande avec son premier message', async () => {
    const inserted = serve({ support_tickets: { data: { id: TICKET.id } } });
    expect(
      await openTicket({ category: 'commande', subject: '  Brioche  ', body: ' Il manquait… ' }),
    ).toEqual({ ok: true, value: TICKET.id });
    expect(inserted.support_tickets).toEqual([
      { category: 'commande', subject: 'Brioche', order_id: null },
    ]);
    expect(inserted.support_messages).toEqual([{ ticket_id: TICKET.id, body: 'Il manquait…' }]);
  });

  it('refuse une saisie vide sans rien envoyer', async () => {
    expect(await openTicket({ category: 'autre', subject: 'ab', body: '' })).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(await sendMessage(TICKET.id, '   ')).toEqual({ ok: false, code: 'invalid' });
    expect(from).not.toHaveBeenCalled();
  });

  it('reconnaît les refus du serveur', () => {
    expect(classifySupportError({ code: 'P0001', message: 'too_many_tickets' })).toBe(
      'too_many_tickets',
    );
    expect(classifySupportError({ code: 'P0001', message: 'ticket_closed' })).toBe('ticket_closed');
    expect(classifySupportError(new TypeError('Network request failed'))).toBe('network');
    // Migration 0014 pas encore appliquée : « pas encore activé », pas une erreur vague.
    expect(classifySupportError({ code: 'PGRST205', message: 'Could not find the table' })).toBe(
      'unavailable',
    );
  });

  it('sans serveur : rien n’est appelé', async () => {
    mockServer.configured = false;
    expect(await openTicket({ category: 'autre', subject: 'Bonjour', body: 'Test' })).toEqual({
      ok: false,
      code: 'not_configured',
    });
    expect(from).not.toHaveBeenCalled();
  });
});

describe('écrans', () => {
  it('liste mes demandes avec leur statut, et ouvre la conversation', async () => {
    serve({ support_tickets: { data: [TICKET] } });
    const onOpen = jest.fn();
    render(<SupportScreen onOpenTicket={onOpen} onNewTicket={jest.fn()} />);

    const row = await screen.findByTestId(`support-ticket-${TICKET.id}`);
    expect(row.props.accessibilityLabel).toBe('Brioche manquante, En cours');
    fireEvent.press(row);
    expect(onOpen).toHaveBeenCalledWith(TICKET.id);
  });

  it('nouvelle demande : un sujet trop court est signalé, puis la demande part', async () => {
    serve({ support_tickets: { data: { id: TICKET.id } } });
    const onCreated = jest.fn();
    render(<NewTicketScreen onCreated={onCreated} />);

    fireEvent.changeText(screen.getByTestId('support-subject'), 'ab');
    fireEvent.changeText(screen.getByTestId('support-body'), 'Bonjour');
    fireEvent.press(screen.getByTestId('support-send'));
    expect(await screen.findByTestId('support-subject-error')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('support-category-paiement'));
    fireEvent.changeText(screen.getByTestId('support-subject'), 'Paiement refusé');
    fireEvent.press(screen.getByTestId('support-send'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(TICKET.id));
  });

  it('conversation : la réponse de TK LINK est signée « Équipe TK LINK »', async () => {
    serve({
      support_tickets: { data: TICKET },
      support_messages: {
        data: [msg('m1', false, '2026-11-13T09:00:00Z'), msg('m2', true, '2026-11-13T09:30:00Z')],
      },
    });
    render(<TicketScreen ticketId={TICKET.id} />);

    expect(await screen.findByTestId('support-message-m2')).toHaveTextContent(/Équipe TK LINK/);
    expect(screen.getByTestId('support-ticket-status')).toHaveTextContent(
      'Une commande · En cours',
    );
    expect(supabase.channel).toHaveBeenCalledWith(`support-${TICKET.id}`);
  });

  it('une demande fermée ne propose plus de répondre', async () => {
    serve({ support_tickets: { data: { ...TICKET, status: 'ferme' } } });
    render(<TicketScreen ticketId={TICKET.id} />);
    expect(await screen.findByTestId('support-closed')).toBeOnTheScreen();
    expect(screen.queryByTestId('support-reply')).toBeNull();
  });
});

describe('petits calculs', () => {
  it('fusionne les messages sans doublon, dans l’ordre', () => {
    const a = { id: 'a', ticketId: 't', body: '', fromStaff: false, at: 2 };
    const b = { id: 'b', ticketId: 't', body: '', fromStaff: true, at: 1 };
    expect(mergeMessages([a], [b, a]).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('dit l’heure comme une messagerie', () => {
    const now = new Date(2026, 10, 13, 15, 0).getTime();
    expect(formatWhen(now - 20_000, now)).toBe('À l’instant');
    expect(formatWhen(now - 12 * 60_000, now)).toBe('Il y a 12 min');
    expect(formatWhen(new Date(2026, 10, 13, 9, 5).getTime(), now)).toBe('09:05');
    expect(formatWhen(new Date(2026, 10, 12, 18, 30).getTime(), now)).toBe('Hier, 18:30');
    expect(formatWhen(new Date(2026, 9, 2, 8, 0).getTime(), now)).toBe('02/10/2026');
  });
});
