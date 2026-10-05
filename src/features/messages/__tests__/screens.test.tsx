import { fireEvent, render, screen } from '@/shared/testing/render';

import { useMessagesStore } from '../model/store';
import { InboxScreen } from '../ui/inbox-screen';
import { ThreadScreen } from '../ui/thread-screen';

const conv = (
  id: string,
  title: string,
  at: number,
  unread = 0,
  kind: 'commerce' | 'client' | 'support' = 'client',
) => ({
  id,
  title,
  subtitle: 'Toulouse',
  kind,
  unread,
  messages: [{ id: `${id}_m`, from: 'them' as const, text: `Message de ${title}`, at }],
});

beforeEach(() => useMessagesStore.setState({ conversations: [] }));

describe('InboxScreen', () => {
  it('affiche l’état vide', () => {
    render(<InboxScreen onOpen={jest.fn()} />);
    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByTestId('messages-empty')).toBeTruthy();
  });

  it('trie par dernier message, affiche le non-lu et ouvre la conversation', () => {
    const now = Date.now();
    useMessagesStore.setState({
      conversations: [
        conv('vieux', 'Ancien', now - 5 * 86_400_000),
        conv('recent', 'Récent', now - 60_000, 2, 'commerce'),
        conv('milieu', 'Milieu', now - 3_600_000, 0, 'support'),
      ],
    });
    const onOpen = jest.fn();
    render(<InboxScreen onOpen={onOpen} />);

    const rows = screen.getAllByTestId(/^messages-row-/).map((r) => r.props.testID);
    expect(rows).toEqual(['messages-row-recent', 'messages-row-milieu', 'messages-row-vieux']);

    expect(screen.getByTestId('messages-unread-recent')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByTestId('messages-unread-milieu')).toBeNull();
    expect(screen.getByText('Message de Récent')).toBeTruthy();

    fireEvent.press(screen.getByTestId('messages-row-milieu'));
    expect(onOpen).toHaveBeenCalledWith('milieu');
  });

  it('montre le retour seulement quand onBack est fourni', () => {
    const onBack = jest.fn();
    const first = render(<InboxScreen onOpen={jest.fn()} />);
    expect(screen.queryByTestId('messages-inbox-back')).toBeNull();
    first.unmount();
    render(<InboxScreen onOpen={jest.fn()} onBack={onBack} />);
    fireEvent.press(screen.getByTestId('messages-inbox-back'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('ThreadScreen', () => {
  const open = () =>
    useMessagesStore.setState({ conversations: [conv('c1', 'Emma Bernard', Date.now(), 1)] });

  it('affiche l’en-tête et les messages', () => {
    open();
    render(<ThreadScreen conversationId="c1" onBack={jest.fn()} />);
    expect(screen.getByText('Emma Bernard')).toBeTruthy();
    expect(screen.getByText('Toulouse')).toBeTruthy();
    expect(screen.getByText('Message de Emma Bernard')).toBeTruthy();
  });

  it('marque la conversation comme lue à l’ouverture', () => {
    open();
    render(<ThreadScreen conversationId="c1" onBack={jest.fn()} />);
    expect(useMessagesStore.getState().conversations[0]?.unread).toBe(0);
  });

  it('envoie : ajoute une bulle, vide le champ, sans réponse inventée', () => {
    open();
    render(<ThreadScreen conversationId="c1" onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('messages-input'), '  J’arrive  ');
    fireEvent.press(screen.getByTestId('messages-send'));

    expect(screen.getByText('J’arrive')).toBeTruthy();
    expect(screen.getByTestId('messages-input').props.value).toBe('');
    const messages = useMessagesStore.getState().conversations[0]?.messages ?? [];
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ from: 'me', text: 'J’arrive' });
  });

  it('n’envoie rien quand le champ est vide', () => {
    open();
    render(<ThreadScreen conversationId="c1" onBack={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('messages-input'), '   ');
    fireEvent.press(screen.getByTestId('messages-send'));
    expect(useMessagesStore.getState().conversations[0]?.messages).toHaveLength(1);
  });

  it('le bouton retour appelle onBack', () => {
    open();
    const onBack = jest.fn();
    render(<ThreadScreen conversationId="c1" onBack={onBack} />);
    fireEvent.press(screen.getByTestId('messages-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('affiche « Conversation introuvable » pour un identifiant inconnu', () => {
    render(<ThreadScreen conversationId="nope" onBack={jest.fn()} />);
    expect(screen.getByText('Conversation introuvable')).toBeTruthy();
    expect(screen.queryByTestId('messages-input')).toBeNull();
  });
});
