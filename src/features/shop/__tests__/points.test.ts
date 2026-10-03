import { pointsByMerchant } from '../lib/points';
import { getDeal } from '../model/catalog';

const line = (dealId: string, qty: number) => {
  const d = getDeal(dealId)!;
  return { dealId, title: d.title, emoji: d.emoji, qty, price: d.price };
};

describe('pointsByMerchant — CDC §8.2', () => {
  it('crédite le commerçant de l’offre, 1 € = 1 point', () => {
    const cote = getDeal('d_cote')!;
    const pts = pointsByMerchant({ items: [line('d_cote', 2)] });
    expect(pts).toEqual({ [cote.merchantId]: Math.round(cote.price * 2) });
  });

  it('sépare les points par commerçant quand la commande en mêle plusieurs', () => {
    const a = getDeal('d_cote')!;
    const b = getDeal('d_pizza')!;
    expect(a.merchantId).not.toBe(b.merchantId);
    const pts = pointsByMerchant({ items: [line('d_cote', 1), line('d_pizza', 1)] });
    expect(Object.keys(pts).sort()).toEqual([a.merchantId, b.merchantId].sort());
    expect(pts[a.merchantId]).toBe(Math.round(a.price));
    expect(pts[b.merchantId]).toBe(Math.round(b.price));
  });

  it('ignore une offre sans fiche commerçant (publiée depuis l’app)', () => {
    const item = { dealId: 'pub_x', title: 'Test', emoji: '🍞', qty: 1, price: 10 };
    expect(pointsByMerchant({ items: [item] })).toEqual({});
  });
});
