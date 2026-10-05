import { demoConversations } from '../lib/demo';
import { PersistedSchema } from '../model/schema';
import { selectUnreadTotal, useMessagesStore } from '../model/store';

const seed = {
  id: 'c1',
  title: 'Sushi Tokyo',
  subtitle: 'Rue des Arts',
  kind: 'commerce',
} as const;

beforeEach(() => useMessagesStore.setState({ conversations: [] }));

const get = () => useMessagesStore.getState();

describe('messagerie — store', () => {
  it('ensureConversation est idempotent et ne touche pas aux messages', () => {
    get().ensureConversation(seed);
    expect(get().send('c1', 'Bonjour')).toBe(true);
    get().ensureConversation({ ...seed, title: 'Autre titre' });
    expect(get().conversations).toHaveLength(1);
    expect(get().conversations[0]?.title).toBe('Sushi Tokyo');
    expect(get().conversations[0]?.messages).toHaveLength(1);
  });

  it('send rogne le texte, ignore le vide et les conversations inconnues', () => {
    get().ensureConversation(seed);
    expect(get().send('c1', '   ')).toBe(false);
    expect(get().send('inconnue', 'Salut')).toBe(false);
    expect(get().send('c1', '  Bonjour  ')).toBe(true);
    const messages = get().conversations[0]?.messages ?? [];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ from: 'me', text: 'Bonjour' });
    expect(messages[0]?.id).toBeTruthy();
    expect(messages[0]?.at).toBeGreaterThan(0);
  });

  it('n’invente jamais de réponse après un envoi', () => {
    jest.useFakeTimers();
    get().ensureConversation(seed);
    get().send('c1', 'Bonjour');
    jest.advanceTimersByTime(60_000);
    expect(get().conversations[0]?.messages).toHaveLength(1);
    jest.useRealTimers();
  });

  it('receive compte un non-lu, markRead le remet à zéro', () => {
    get().ensureConversation(seed);
    get().receive('c1', 'Prête dans 5 minutes');
    get().receive('c1', 'Merci');
    expect(get().conversations[0]?.unread).toBe(2);
    expect(selectUnreadTotal(get())).toBe(2);
    get().markRead('c1');
    expect(get().conversations[0]?.unread).toBe(0);
    expect(selectUnreadTotal(get())).toBe(0);
  });

  it('seedDemo n’insère les exemples que s’il n’y a aucune conversation', () => {
    get().seedDemo();
    expect(get().conversations.map((c) => c.id)).toEqual([
      'demo_commerce',
      'demo_client',
      'support',
    ]);
    expect(selectUnreadTotal(get())).toBe(1);

    get().send('support', 'Une question');
    get().seedDemo();
    expect(get().conversations).toHaveLength(3);
    expect(get().conversations.find((c) => c.id === 'support')?.messages).toHaveLength(2);

    useMessagesStore.setState({ conversations: [] });
    get().ensureConversation(seed);
    get().seedDemo();
    expect(get().conversations).toHaveLength(1);
  });

  it('reset vide tout', () => {
    get().seedDemo();
    get().reset();
    expect(get().conversations).toEqual([]);
  });

  it('la réhydratation complète les champs absents (schéma)', () => {
    const parsed = PersistedSchema.parse({
      conversations: [{ id: 'x', title: 'X', kind: 'client' }],
    });
    expect(parsed.conversations[0]).toEqual({
      id: 'x',
      title: 'X',
      subtitle: '',
      kind: 'client',
      unread: 0,
      messages: [],
    });
    expect(PersistedSchema.parse({})).toEqual({ conversations: [] });
    expect(
      PersistedSchema.safeParse({ conversations: [{ id: 'x', title: 'X', kind: 'nope' }] }).success,
    ).toBe(false);
  });

  it('les conversations d’exemple respectent le schéma et sont déterministes', () => {
    const demo = demoConversations(1_700_000_000_000);
    expect(PersistedSchema.parse({ conversations: demo }).conversations).toEqual(demo);
    expect(demoConversations(1_700_000_000_000)).toEqual(demo);
  });
});
