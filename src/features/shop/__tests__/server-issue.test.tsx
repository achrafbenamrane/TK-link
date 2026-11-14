import { fireEvent, render, screen } from '@/shared/testing/render';

import { supabase } from '@/shared/lib/supabase';

import { classifyIssueError, reportServerIssue } from '../lib/issues-api';
import { toServerOrder } from '../lib/orders-api';
import { ServerReportIssue } from '../ui/components/server-issue';

/**
 * « Signaler un problème » sur une commande DU SERVEUR (migration 0027) — CDC V1.1 : un point
 * d'entrée unique qui route vers un remboursement ou vers la file Super Admin. Le serveur décide ;
 * l'app dit au client où ça part. Le serveur est simulé.
 */
jest.mock('@/shared/lib/env', () => ({
  ...jest.requireActual('@/shared/lib/env'),
  isSupabaseConfigured: true,
}));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const rpc = supabase.rpc as jest.Mock;
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const order = (status: string) =>
  toServerOrder(
    {
      id: ORDER_ID,
      shop_id: 'shop-1',
      fulfilment: 'touch-collect',
      status,
      subtotal_cents: 400,
      discount_cents: 0,
      delivery_fee_cents: 0,
      total_cents: 400,
      delivery_address: null,
      delivery_lat: null,
      delivery_lng: null,
      reserved_until: '2026-11-14T18:15:00Z',
      uber_tracking_url: null,
      created_at: '2026-11-14T18:00:00Z',
      flash_order_items: [
        {
          offer_id: '33333333-3333-4333-8333-333333333333',
          title: 'Brioche',
          qty: 2,
          unit_price_cents: 200,
        },
      ],
    } as never,
    () => '🥐',
  );

beforeEach(() => {
  rpc.mockReset();
  mockPush.mockClear();
});

describe('issues-api', () => {
  it('envoie le motif par report_order_issue ; le serveur répond où ça part', async () => {
    rpc.mockResolvedValue({ data: 'remboursement', error: null });
    await expect(reportServerIssue(ORDER_ID, 'non_recue')).resolves.toEqual({
      ok: true,
      value: 'remboursement',
    });
    expect(rpc).toHaveBeenCalledWith('report_order_issue', {
      p_order: ORDER_ID,
      p_kind: 'non_recue',
    });
  });

  it('les refus gardent leur nom ; sans 0027, « indisponible »', () => {
    expect(classifyIssueError({ code: 'P0001', message: 'already_reported' })).toBe(
      'already_reported',
    );
    expect(classifyIssueError({ code: 'P0001', message: 'not_reportable' })).toBe('not_reportable');
    expect(classifyIssueError({ message: 'not_authenticated' })).toBe('not_signed_in');
    expect(classifyIssueError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(
      'unavailable',
    );
  });

  it('une réponse inattendue n’est pas prise pour une route', async () => {
    rpc.mockResolvedValue({ data: 'ailleurs', error: null });
    await expect(reportServerIssue(ORDER_ID, 'autre')).resolves.toEqual({
      ok: false,
      code: 'unknown',
    });
  });
});

describe('<ServerReportIssue />', () => {
  const report = (kind: string) => {
    fireEvent.press(screen.getByTestId('order-report-open'));
    fireEvent.press(screen.getByTestId(`report-kind-${kind}`));
    fireEvent.press(screen.getByTestId('report-submit'));
  };

  it('rien reçu avant la remise : « Remboursement en cours », et la commande est relue', async () => {
    rpc.mockResolvedValue({ data: 'remboursement', error: null });
    const onChanged = jest.fn();
    render(<ServerReportIssue order={order('preparation')} onChanged={onChanged} />);
    report('non_recue');
    expect(await screen.findByTestId('server-issue-sent')).toHaveTextContent(
      /Remboursement en cours.*5 à 10 jours/,
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('le reste part au support TK LINK ; on peut y ajouter un message', async () => {
    rpc.mockResolvedValue({ data: 'admin', error: null });
    render(<ServerReportIssue order={order('livree')} onChanged={jest.fn()} />);
    report('non_conforme');
    expect(await screen.findByTestId('server-issue-sent')).toHaveTextContent(
      /Transmis au support TK LINK/,
    );
    fireEvent.press(screen.getByTestId('server-issue-write'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/aide/nouvelle',
      params: { commande: ORDER_ID, sujet: 'commande' },
    });
  });

  it('déjà entre les mains de TK LINK : où en est la commande, sans nouveau signalement', () => {
    render(<ServerReportIssue order={order('remboursement_en_cours')} onChanged={jest.fn()} />);
    expect(screen.getByTestId('server-issue-sent')).toHaveTextContent(/Remboursement en cours/);
    expect(screen.queryByTestId('order-report-open')).toBeNull();
  });

  it('un refus s’explique, et le formulaire reste', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'already_reported' } });
    render(<ServerReportIssue order={order('prete')} onChanged={jest.fn()} />);
    report('autre');
    expect(await screen.findByTestId('report-error')).toHaveTextContent(/déjà signalé/);
    expect(screen.getByTestId('order-report')).toBeOnTheScreen();
  });

  it('serveur sans 0027 : on retombe sur une demande au support, rattachée à la commande', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    render(<ServerReportIssue order={order('payee')} onChanged={jest.fn()} />);
    report('non_recue');
    await screen.findByTestId('order-report-open');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/aide/nouvelle',
      params: { commande: ORDER_ID, sujet: 'commande' },
    });
  });
});
