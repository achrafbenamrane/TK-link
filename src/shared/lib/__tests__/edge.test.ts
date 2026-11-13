import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { callEdge } from '@/shared/lib/edge';
import { supabase } from '@/shared/lib/supabase';

/**
 * Un appel de fonction Edge rend sa réponse, ou un code lisible — jamais une exception, jamais un
 * « erreur inconnue » quand la fonction a dit pourquoi elle refusait.
 */
const mockServer = { configured: true };
jest.mock('@/shared/lib/env', () =>
  Object.defineProperty({ ...jest.requireActual('@/shared/lib/env') }, 'isSupabaseConfigured', {
    enumerable: true,
    get: () => mockServer.configured,
  }),
);
jest.mock('@/shared/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as unknown as jest.Mock;
const refusal = (status: number, body: unknown) => ({
  data: null,
  error: new FunctionsHttpError(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  ),
});

beforeEach(() => {
  invoke.mockReset();
  mockServer.configured = true;
});

it('rend la réponse de la fonction', async () => {
  invoke.mockResolvedValue({ data: { mediaId: 'm-1' }, error: null });
  expect(await callEdge('ai-media-start', { kind: 'image' })).toEqual({
    ok: true,
    data: { mediaId: 'm-1' },
  });
  expect(invoke).toHaveBeenCalledWith('ai-media-start', {
    method: 'POST',
    body: { kind: 'image' },
  });
});

it('rend le motif donné par la fonction', async () => {
  invoke.mockResolvedValue(refusal(429, { error: 'quota_exhausted' }));
  expect(await callEdge('ai-media-start')).toEqual({
    ok: false,
    code: 'quota_exhausted',
    status: 429,
  });
});

it('sans motif : 401 → session, 503 → pas configuré, sinon inconnu', async () => {
  invoke.mockResolvedValue(refusal(401, { msg: 'Invalid JWT' }));
  expect(await callEdge('x')).toMatchObject({ code: 'unauthorized' });
  invoke.mockResolvedValue(refusal(503, 'down'));
  expect(await callEdge('x')).toMatchObject({ code: 'not_configured' });
  invoke.mockResolvedValue(refusal(500, null));
  expect(await callEdge('x')).toMatchObject({ code: 'unknown', status: 500 });
});

it('hors ligne, ou sans serveur : un code, pas d’exception', async () => {
  invoke.mockResolvedValue({
    data: null,
    error: new FunctionsFetchError(new TypeError('Network request failed')),
  });
  expect(await callEdge('x')).toMatchObject({ code: 'offline' });
  invoke.mockRejectedValue(new Error('boom'));
  expect(await callEdge('x')).toMatchObject({ code: 'offline' });

  mockServer.configured = false;
  invoke.mockReset();
  expect(await callEdge('x')).toMatchObject({ code: 'not_configured' });
  expect(invoke).not.toHaveBeenCalled();
});
