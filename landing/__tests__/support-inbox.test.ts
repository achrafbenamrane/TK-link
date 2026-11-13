/* eslint-disable @typescript-eslint/no-require-imports -- why: le site (landing/) est du JS hors tsconfig */

/**
 * La boîte de réception du support (back-office `/admin`, migration 0014). Ce qui compte : une
 * demande qui attend une réponse passe devant, la plus ancienne en tête ; une réponse vide ou trop
 * longue ne part pas.
 */
const support = require('../app/admin/support') as {
  toThreads: (
    tickets: unknown[],
    profiles: unknown[],
    nowMs: number,
  ) => { id: string; party: string; role: string; unread: boolean; messages: { from: string }[] }[];
  validReply: (body: unknown) => string | null;
  relativeTime: (iso: string, nowMs: number) => string;
};

const NOW = Date.parse('2026-11-13T18:00:00Z');
const ticket = (id: string, status: string, last: string, fromStaff: boolean) => ({
  id,
  author_id: 'u1',
  category: 'commande',
  subject: `Sujet ${id}`,
  status,
  order_id: null,
  last_message_at: last,
  support_messages: [{ id: `m-${id}`, body: '…', from_staff: fromStaff, created_at: last }],
});

it('les demandes sans réponse passent devant, la plus ancienne d’abord', () => {
  const threads = support.toThreads(
    [
      ticket('repondu', 'en_cours', '2026-11-13T17:59:00Z', true),
      ticket('recent', 'ouvert', '2026-11-13T17:50:00Z', false),
      ticket('ancien', 'ouvert', '2026-11-13T09:00:00Z', false),
      ticket('resolu', 'resolu', '2026-11-13T17:58:00Z', false),
    ],
    [{ id: 'u1', first_name: 'Clara', last_name: 'Martin', account_type: 'commercant' }],
    NOW,
  );
  expect(threads.map((t) => t.id)).toEqual(['ancien', 'recent', 'repondu', 'resolu']);
  expect(threads.map((t) => t.unread)).toEqual([true, true, false, false]);
  expect(threads[0]).toMatchObject({ party: 'Clara Martin', role: 'Commerçant' });
  expect(threads[2]!.messages[0]!.from).toBe('admin');
});

it('un auteur sans profil reste lisible', () => {
  const [t] = support.toThreads([ticket('x', 'ouvert', '2026-11-13T17:00:00Z', false)], [], NOW);
  expect(t).toMatchObject({ party: 'Utilisateur', role: 'Utilisateur' });
});

it('une réponse fait 1 à 2 000 caractères', () => {
  expect(support.validReply('  Bonjour  ')).toBe('Bonjour');
  expect(support.validReply('   ')).toBeNull();
  expect(support.validReply('x'.repeat(2001))).toBeNull();
  expect(support.validReply(42)).toBeNull();
});

it('l’heure se lit comme une messagerie', () => {
  expect(support.relativeTime('2026-11-13T17:59:40Z', NOW)).toBe('À l’instant');
  expect(support.relativeTime('2026-11-13T17:45:00Z', NOW)).toBe('Il y a 15 min');
  expect(support.relativeTime('2026-11-13T15:00:00Z', NOW)).toBe('Il y a 3 h');
});
