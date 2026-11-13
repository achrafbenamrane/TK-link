import { act, fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

import { checkMedia, startMedia } from '../lib/media-api';
import { AiMediaScreen } from '../ui/ai-media-screen';

/**
 * Les visuels IA de la boutique (rapport d’avancement du 13/11/2026) : le commerçant lance une
 * création, la suit, et choisit ce qui s’affiche sur sa vitrine. Le serveur (fal.ai) est simulé.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/edge', () => ({ callEdge: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
}));

const edge = callEdge as jest.Mock;
const from = supabase.from as unknown as jest.Mock;
const rpc = supabase.rpc as unknown as jest.Mock;
const getSession = supabase.auth.getSession as unknown as jest.Mock;

const row = (o: Record<string, unknown>) => ({
  id: 'm-1',
  kind: 'image',
  status: 'pret',
  url: 'https://x.supabase.co/storage/v1/object/public/shop-media/s/m-1.jpg',
  visible: true,
  brief: 'pains au levain',
  created_at: '2026-11-13T10:00:00Z',
  ...o,
});

/** `from('shops')` puis `from('shop_media')`, comme le fait `fetchMyMedia`. */
function serve(media: unknown[]) {
  from.mockImplementation((table: string) => {
    const chain: Record<string, jest.Mock> = {};
    for (const k of ['select', 'eq', 'order']) chain[k] = jest.fn(() => chain);
    if (table === 'shops') {
      chain.maybeSingle = jest.fn(async () => ({ data: { id: 'shop-1' }, error: null }));
    } else {
      chain.order = jest.fn(async () => ({ data: media, error: null }));
    }
    return chain;
  });
}

beforeEach(() => {
  edge.mockReset();
  from.mockReset();
  rpc.mockReset();
  mockServer.configured = true;
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } });
});

describe('client des visuels', () => {
  it('lance une création et rend son identifiant', async () => {
    edge.mockResolvedValue({ ok: true, data: { mediaId: 'm-9', quotaLeft: 9 } });
    expect(await startMedia('image', '  vitrine  ')).toEqual({
      ok: true,
      value: { mediaId: 'm-9', quotaLeft: 9 },
    });
    expect(edge).toHaveBeenCalledWith('ai-media-start', { kind: 'image', brief: 'vitrine' });
  });

  it('traduit les refus du serveur', async () => {
    edge.mockResolvedValue({ ok: false, code: 'quota_exhausted', status: 429 });
    expect(await startMedia('video', '')).toEqual({ ok: false, code: 'quota_exhausted' });
    edge.mockResolvedValue({ ok: false, code: 'ai_not_configured', status: 503 });
    expect(await startMedia('video', '')).toEqual({ ok: false, code: 'not_configured' });
  });

  it('refuse un état inconnu au relevé', async () => {
    edge.mockResolvedValue({ ok: true, data: { status: 'bizarre' } });
    expect(await checkMedia('m-1')).toEqual({ ok: false, code: 'unknown' });
  });
});

describe('écran « Visuels IA »', () => {
  it('liste les visuels et cache celui qu’on retire de la vitrine', async () => {
    serve([row({})]);
    rpc.mockResolvedValue({ error: null });
    render(<AiMediaScreen />);

    expect(await screen.findByTestId('ai-media-m-1-image')).toBeOnTheScreen();
    fireEvent(screen.getByTestId('ai-media-m-1-visible'), 'valueChange', false);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('set_shop_media_visible', {
        p_media: 'm-1',
        p_visible: false,
      }),
    );
  });

  it('dit pourquoi une création est refusée', async () => {
    serve([]);
    edge.mockResolvedValue({ ok: false, code: 'shop_not_validated', status: 409 });
    render(<AiMediaScreen />);
    expect(await screen.findByTestId('ai-media-empty')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('ai-media-create-video'));
    expect(await screen.findByTestId('ai-media-error')).toHaveTextContent(
      'Votre boutique doit d’abord être validée par TK LINK.',
    );
  });

  it('relève une création en cours jusqu’à ce qu’elle soit prête', async () => {
    jest.useFakeTimers();
    serve([row({ status: 'en_cours', url: null })]);
    edge.mockResolvedValue({ ok: true, data: { status: 'pret', url: 'https://x/y.jpg' } });
    render(<AiMediaScreen />);
    expect(await screen.findByTestId('ai-media-m-1-pending')).toBeOnTheScreen();

    serve([row({})]);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(edge).toHaveBeenCalledWith('ai-media-status', { mediaId: 'm-1' });
    expect(await screen.findByTestId('ai-media-m-1-image')).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('sans serveur : expliqué, rien n’est appelé', () => {
    mockServer.configured = false;
    render(<AiMediaScreen />);
    expect(screen.getByTestId('ai-media-demo')).toBeOnTheScreen();
    expect(screen.queryByTestId('ai-media-create-image')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
