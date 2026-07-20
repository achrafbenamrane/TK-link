import { ME, SUPPORT } from '../model/schema';
import { messagesOf, unreadCount, useShopStore } from '../model/store';

const CONV = 'c_test';

beforeEach(() => {
  useShopStore.setState({
    conversations: [{ id: CONV, partnerId: 'm_hammamet', lastReadMessageId: null }],
    messages: [],
  });
});

describe('sendMessage', () => {
  it('appends the message as me, in the right conversation', () => {
    useShopStore.getState().sendMessage(CONV, 'Bonjour');
    const [m] = messagesOf(useShopStore.getState(), CONV);
    expect(m?.body).toBe('Bonjour');
    expect(m?.sender_id).toBe(ME);
    expect(m?.conversation_id).toBe(CONV);
  });

  // Une bulle vide n'existe dans aucun messenger.
  it('ignores an empty or whitespace-only message', () => {
    useShopStore.getState().sendMessage(CONV, '   ');
    useShopStore.getState().sendMessage(CONV, '');
    expect(messagesOf(useShopStore.getState(), CONV)).toHaveLength(0);
  });

  it('trims what it stores', () => {
    useShopStore.getState().sendMessage(CONV, '  salut  ');
    expect(messagesOf(useShopStore.getState(), CONV)[0]?.body).toBe('salut');
  });

  it('keeps conversations separate', () => {
    useShopStore.getState().sendMessage(CONV, 'ici');
    useShopStore.getState().sendMessage('c_autre', 'ailleurs');
    expect(messagesOf(useShopStore.getState(), CONV)).toHaveLength(1);
  });
});

describe('unreadCount', () => {
  it('counts only what the other side sent after the last read', () => {
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Votre côte de bœuf est prête');
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(1);
  });

  // Sinon vos propres messages vous notifieraient vous-même.
  it('never counts my own messages as unread', () => {
    useShopStore.getState().sendMessage(CONV, 'Bonjour');
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(0);
  });

  it('drops to zero once the thread is opened', () => {
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Coucou');
    useShopStore.getState().markConversationRead(CONV);
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(0);
  });

  // Régression : la lecture était datée avec Date.now() et comparée à
  // `created_at`. Dans la même milliseconde, les deux étaient à égalité et le
  // message suivant était avalé — un commerçant répondant à l'instant où l'on
  // ferme le fil n'aurait jamais été signalé. La lecture suit maintenant
  // l'ordre des messages, qui lui n'est jamais ambigu.
  it('counts again for messages arriving after that, even within the same millisecond', () => {
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Un');
    useShopStore.getState().markConversationRead(CONV);
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Deux');
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(1);
  });

  it('counts the whole thread when nothing has been read yet', () => {
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Un');
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Deux');
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(2);
  });

  // Envoyer, c'est avoir lu ce qui précède.
  it('clears unread when I reply', () => {
    useShopStore.getState().receiveMessage(CONV, 'm_hammamet', 'Coucou');
    useShopStore.getState().sendMessage(CONV, 'Bonjour');
    expect(unreadCount(useShopStore.getState(), CONV)).toBe(0);
  });

  it('is zero for a conversation that does not exist', () => {
    expect(unreadCount(useShopStore.getState(), 'nope')).toBe(0);
  });
});

describe('seeded conversations', () => {
  it('ships a support thread and merchant threads that exist in the catalog', () => {
    useShopStore.setState(useShopStore.getInitialState());
    const convs = useShopStore.getState().conversations;
    expect(convs.some((c) => c.partnerId === SUPPORT)).toBe(true);
    expect(convs.length).toBeGreaterThan(1);
  });
});
