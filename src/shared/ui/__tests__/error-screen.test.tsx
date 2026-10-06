import { fireEvent, render, screen } from '@/shared/testing/render';
import { ErrorScreen } from '@/shared/ui';

describe('<ErrorScreen />', () => {
  it('rassure, et ne laisse qu’un geste : réessayer', () => {
    const onRetry = jest.fn();
    render(<ErrorScreen onRetry={onRetry} />);
    expect(screen.getByText('Un souci est survenu')).toBeTruthy();
    expect(screen.getByTestId('error-screen')).toHaveTextContent(/vos données restent/);
    fireEvent.press(screen.getByTestId('error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ne montre la trace technique que si on la lui donne', () => {
    const { unmount } = render(<ErrorScreen onRetry={jest.fn()} />);
    expect(screen.queryByTestId('error-detail')).toBeNull();
    unmount();

    render(<ErrorScreen onRetry={jest.fn()} detail="Cannot read properties of undefined" />);
    expect(screen.getByTestId('error-detail')).toHaveTextContent(/Cannot read/);
  });
});
