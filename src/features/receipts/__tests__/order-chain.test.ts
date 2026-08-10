import { receiptForOrder, toInvoice } from '../lib/receipts';
import { useReceiptsStore } from '../model/store';

/**
 * LA CHAÎNE DU CDC §14 : transaction → ticket → facture.
 *
 * Ce qui est vérifié ici, c'est l'enchaînement — pas chaque maillon pris à
 * part (couverts par `receipts.test.ts`). Le pont qui l'actionne vit dans
 * `src/app/_layout.tsx`, mais toute sa logique tient dans ces deux fonctions.
 */

const transaction = (orderId: string) => ({
  orderId,
  merchant: 'Le Petit Toulousain',
  category: 'restauration' as const,
  channel: 'online' as const,
  lines: [
    { label: 'Plateau de viennoiseries', qty: 2, unitCents: 950 },
    { label: 'Remise BIENVENUE', qty: 1, unitCents: -300 },
  ],
});

beforeEach(() => {
  useReceiptsStore.setState({ receipts: [] });
});

describe('commande → ticket', () => {
  it('crée un ticket qui garde le lien vers sa commande', () => {
    const receipt = useReceiptsStore.getState().addReceipt(transaction('o_1'));

    expect(receipt.orderId).toBe('o_1');
    expect(receipt.kind).toBe('ticket');
    expect(receipt.merchant).toBe('Le Petit Toulousain');
  });

  it('la remise négative est comptée : le total suit ce qui a été payé', () => {
    const receipt = useReceiptsStore.getState().addReceipt(transaction('o_1'));
    // 2 × 9,50 € − 3,00 € = 16,00 €
    expect(receipt.totalCents).toBe(1600);
    expect(receipt.netCents + receipt.vatCents).toBe(receipt.totalCents);
  });

  it('une commande ne produit qu’UN ticket, quoi qu’il arrive', () => {
    useReceiptsStore.getState().addReceipt(transaction('o_1'));
    const receipts = useReceiptsStore.getState().receipts;

    // C'est la garde du pont : sans elle, chaque passage émettrait un doublon.
    expect(receiptForOrder(receipts, 'o_1')).toBeDefined();
    expect(receiptForOrder(receipts, 'o_2')).toBeUndefined();
  });

  it('un ticket de caisse (sans commande) ne se confond avec aucune commande', () => {
    useReceiptsStore.getState().addReceipt({
      merchant: 'Carrefour City',
      lines: [{ label: 'Courses', qty: 1, unitCents: 1200 }],
    });
    const receipts = useReceiptsStore.getState().receipts;

    expect(receipts[0]!.orderId).toBe('');
    // Un `orderId` vide ne doit jamais « matcher » : sinon le premier ticket
    // de caisse bloquerait la facturation de toutes les commandes.
    expect(receiptForOrder(receipts, '')).toBeUndefined();
  });
});

describe('ticket → facture', () => {
  it('la conversion certifie sans perdre le lien à la commande', () => {
    const receipt = useReceiptsStore.getState().addReceipt(transaction('o_1'));
    useReceiptsStore.getState().convertToInvoice(receipt.id);

    const invoice = useReceiptsStore.getState().receipts.find((r) => r.id === receipt.id)!;
    expect(invoice.kind).toBe('facture');
    expect(invoice.certificateId).not.toBe('');
    expect(invoice.orderId).toBe('o_1');
  });

  it('convertir deux fois ne change pas le certificat', () => {
    const receipt = useReceiptsStore.getState().addReceipt(transaction('o_1'));
    const once = toInvoice(receipt);
    expect(toInvoice(once)).toBe(once);
  });
});
