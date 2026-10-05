import { render, screen } from '@/shared/testing/render';
import { RouteMap } from '@/shared/ui';
import { projectPoints } from '@/shared/ui/route-map';

const from = { lat: 43.6045, lng: 1.4442, label: 'Boulangerie Marcel' };
const to = { lat: 43.6112, lng: 1.4531, label: 'Chez Lina' };

describe('<RouteMap />', () => {
  it('renders the stylised fallback with both markers and the route', () => {
    render(<RouteMap from={from} to={to} />);

    expect(screen.getByTestId('route-map')).toBeOnTheScreen();
    expect(screen.getByTestId('route-map-from')).toBeOnTheScreen();
    expect(screen.getByTestId('route-map-to')).toBeOnTheScreen();
    expect(screen.getByTestId('route-map-route')).toBeOnTheScreen();
    expect(screen.queryByTestId('route-map-courier')).not.toBeOnTheScreen();
  });

  it('passes the testID through to the container and the markers', () => {
    render(
      <RouteMap from={from} to={to} courier={{ lat: 43.607, lng: 1.449 }} testID="trip-map" />,
    );

    expect(screen.getByTestId('trip-map')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-map-from')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-map-to')).toBeOnTheScreen();
    expect(screen.getByTestId('trip-map-courier')).toBeOnTheScreen();
  });

  it('shows the point labels', () => {
    render(<RouteMap from={from} to={to} />);

    expect(screen.getByText('Boulangerie Marcel')).toBeOnTheScreen();
    expect(screen.getByText('Chez Lina')).toBeOnTheScreen();
  });

  it('applies the requested height', () => {
    render(<RouteMap from={from} to={to} height={300} />);

    expect(screen.getByTestId('route-map')).toHaveStyle({ height: 300 });
  });
});

describe('projectPoints', () => {
  it('keeps every point inside the padded box, north up', () => {
    const [a, b] = projectPoints([from, to], 320, 220, 40);

    for (const p of [a!, b!]) {
      expect(p.x).toBeGreaterThanOrEqual(40 - 0.001);
      expect(p.x).toBeLessThanOrEqual(280 + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(40 - 0.001);
      expect(p.y).toBeLessThanOrEqual(180 + 0.001);
    }
    // `to` est plus au nord et plus à l’est que `from`.
    expect(b!.x).toBeGreaterThan(a!.x);
    expect(b!.y).toBeLessThan(a!.y);
  });

  it('centres a degenerate single point', () => {
    const [a, b] = projectPoints([from, from], 320, 220, 40);

    expect(a).toEqual({ x: 160, y: 110 });
    expect(b).toEqual({ x: 160, y: 110 });
  });
});
