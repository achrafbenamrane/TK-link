import { fireEvent, render, screen } from '@/shared/testing/render';

import { discountPercent } from '../lib/price';
import { getDeal } from '../model/catalog';
import type { Deal } from '../model/schema';
import { useShopStore } from '../model/store';
import { Countdown } from '../ui/components/countdown';
import { FlashCard } from '../ui/components/flash-card';
import { LiquidationRail } from '../ui/components/liquidation-rail';
import { PriceTag } from '../ui/components/price-tag';
import { MerchantDetailScreen } from '../ui/merchant-detail-screen';
import { ProductScreen } from '../ui/product-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const cote = getDeal('d_cote')!;

const withStock = (stockLeft: number, stockTotal = 100): Deal => ({
  ...cote,
  stockLeft,
  stockTotal,
});

beforeEach(() => {
  mockPush.mockClear();
  useShopStore.setState({ cart: [], favorites: [], userCoord: null });
});

/** La classe d'un nœud, qu'elle soit portée par `className` ou déjà résolue. */
const classOf = (testID: string) => String(screen.getByTestId(testID).props.className ?? '');

describe('discountPercent', () => {
  it('calcule la remise entière, et rien sans vrai prix barré', () => {
    expect(discountPercent(7.5, 10)).toBe(25);
    expect(discountPercent(10, 10)).toBeNull();
    expect(discountPercent(10, 8)).toBeNull();
    expect(discountPercent(10, undefined)).toBeNull();
  });
});

describe('<PriceTag />', () => {
  it('barre l’ancien prix en ROUGE et affiche le prix remisé en VERT', () => {
    render(<PriceTag price={7.5} oldPrice={10} />);

    expect(classOf('price-tag-old')).toContain('text-danger');
    expect(classOf('price-tag-old')).toContain('line-through');
    expect(classOf('price-tag-promo')).toContain('text-success');
    expect(screen.getByTestId('price-tag-old')).toHaveTextContent('10.00€');
    expect(screen.getByTestId('price-tag-promo')).toHaveTextContent('7.50€');
  });

  it('range la remise sur sa propre ligne, AVANT le prix dans l’arbre', () => {
    render(<PriceTag price={7.5} oldPrice={10} />);

    const badge = screen.getByTestId('price-tag-discount');
    expect(badge).toHaveTextContent('−25 %');

    // Ordre de l'arbre : la remise précède le prix remisé, lui-même avant l'ancien.
    const order = screen
      .getAllByTestId(/^price-tag-(discount|promo|old)$/)
      .map((n) => n.props.testID);
    expect(order).toEqual(['price-tag-discount', 'price-tag-promo', 'price-tag-old']);

    // Et la remise n'est pas DANS la ligne du prix : elle a la sienne.
    const row = screen.getByTestId('price-tag-promo').parent!;
    expect(row.findAll((n) => n.props?.testID === 'price-tag-discount')).toHaveLength(0);
  });

  it('sans remise : ni pastille ni prix barré', () => {
    render(<PriceTag price={7.5} />);
    expect(screen.queryByTestId('price-tag-discount')).toBeNull();
    expect(screen.queryByTestId('price-tag-old')).toBeNull();
    expect(classOf('price-tag-promo')).toContain('text-success');
  });

  it('peut masquer la pastille et écrire à la française', () => {
    render(<PriceTag price={7.5} oldPrice={10} hideDiscount comma />);
    expect(screen.queryByTestId('price-tag-discount')).toBeNull();
    expect(screen.getByTestId('price-tag-promo')).toHaveTextContent('7,50€');
  });
});

describe('<Countdown />', () => {
  it('affiche « 24:00:00 » en entier pour une offre de 24 heures, sans largeur figée', () => {
    render(<Countdown seconds={86400} />);

    const text = screen.getByText('24:00:00');
    expect(text).toBeOnTheScreen();
    // Ni troncature, ni largeur imposée : le texte refuse de rétrécir.
    expect(text.props.numberOfLines).toBeUndefined();
    const flat = Object.assign({}, ...[text.props.style].flat(Infinity).filter(Boolean));
    expect(flat.width).toBeUndefined();
    expect(flat.maxWidth).toBeUndefined();
    expect(flat.flexShrink).toBe(0);
  });

  it('tient aussi à 100 heures et plus, sans casser la ligne', () => {
    render(<Countdown seconds={100 * 3600 + 61} />);
    expect(screen.getByText('100:01:01')).toBeOnTheScreen();
  });
});

describe('stock en jauge d’essence', () => {
  it('carte flash : la jauge et la pastille suivent la teinte', () => {
    const cases = [
      { left: 80, bar: 'bg-success', border: 'border-success', label: 'plein' },
      { left: 40, bar: 'bg-warning', border: 'border-warning', label: 'à moitié' },
      { left: 10, bar: 'bg-danger', border: 'border-danger', label: 'presque épuisé' },
    ];
    for (const c of cases) {
      const deal = withStock(c.left);
      const { unmount } = render(<FlashCard deal={deal} />);
      expect(classOf(`deal-${deal.id}-gauge-fill`)).toContain(c.bar);
      expect(classOf(`deal-${deal.id}-stock`)).toContain(c.border);
      expect(screen.getByTestId(`deal-${deal.id}-gauge`).props.accessibilityLabel).toContain(
        `Stock : ${c.label}`,
      );
      unmount();
    }
  });

  it('carte flash : le prix passe par le composant partagé, remise au-dessus', () => {
    render(<FlashCard deal={cote} />);
    expect(classOf(`deal-${cote.id}-price-promo`)).toContain('text-success');
    expect(classOf(`deal-${cote.id}-price-old`)).toContain('text-danger');
    expect(screen.getByTestId(`deal-${cote.id}-price-discount`)).toBeOnTheScreen();
  });

  it('fiche offre : jauge, chiffre et prix suivent la même règle', () => {
    render(<ProductScreen dealId="d_cote" />);
    const ratio = cote.stockLeft / cote.stockTotal;
    const expected = ratio > 0.5 ? 'success' : ratio > 0.25 ? 'warning' : 'danger';
    expect(classOf('product-stock-gauge-fill')).toContain(`bg-${expected}`);
    expect(classOf('product-stock')).toContain(`text-${expected}`);
    expect(classOf('product-price-promo')).toContain('text-success');
    expect(classOf('product-price-old')).toContain('text-danger');
    expect(screen.getByTestId('product-price-discount')).toBeOnTheScreen();
  });

  it('rail de déstockage : la jauge et le chiffre sont teintés', () => {
    render(<LiquidationRail limit={3} />);
    const fills = screen.getAllByTestId(/^liquidation-d_.*-gauge-fill$/);
    expect(fills).toHaveLength(3);
    for (const fill of fills) {
      expect(String(fill.props.className)).toMatch(/bg-(success|warning|danger)/);
    }
  });

  it('vitrine du commerçant : la pastille « Stock : N » est teintée et lisible', () => {
    render(
      <MerchantDetailScreen
        merchantId={cote.merchantId}
        onOpenLoyalty={jest.fn()}
        onOpenDeal={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    const chip = screen.getByTestId(`merchant-deal-${cote.id}-stock`);
    expect(String(chip.props.className)).toMatch(/border-(success|warning|danger)/);
    expect(chip.props.accessibilityLabel).toMatch(/^Stock : /);
    expect(classOf(`merchant-deal-${cote.id}-price-promo`)).toContain('text-success');
  });
});

describe('« Voir la boutique » sur la fiche offre', () => {
  it('ouvre la vitrine de l’enseigne, où sont ses autres offres', () => {
    render(<ProductScreen dealId="d_cote" />);

    const link = screen.getByTestId('product-view-shop');
    expect(link.props.accessibilityRole).toBe('button');
    expect(screen.getByText('Voir la boutique')).toBeOnTheScreen();

    fireEvent.press(link);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/enseigne/[id]',
      params: { id: cote.merchantId },
    });
  });
});
