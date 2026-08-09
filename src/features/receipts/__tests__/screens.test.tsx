import { fireEvent, render, screen } from '@/shared/testing/render';

import { seedReceipts } from '../model/seed';
import { useReceiptsStore } from '../model/store';
import { ReceiptDetailScreen } from '../ui/receipt-detail-screen';
import { ReceiptsScreen } from '../ui/receipts-screen';

/**
 * Filet anti-plantage des écrans « tickets ».
 *
 * Le piège maison : un sélecteur Zustand v5 qui filtre renvoie un tableau neuf
 * à chaque rendu → boucle infinie → l'app se ferme. Monter réellement les
 * écrans, avec des données, est ce qui attrape ça.
 */
beforeEach(() => {
  useReceiptsStore.setState({ receipts: seedReceipts() });
});

describe('<ReceiptsScreen />', () => {
  it('monte et liste les tickets', () => {
    render(<ReceiptsScreen onOpenReceipt={jest.fn()} />);
    expect(screen.getByTestId('receipts-screen')).toBeTruthy();
    // Le portefeuille de démo contient bien des enseignes.
    expect(screen.getByText('Carrefour City')).toBeTruthy();
  });

  it('filtre à la recherche et propose un vide explicite', () => {
    render(<ReceiptsScreen onOpenReceipt={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('receipts-search'), 'carrefour');
    expect(screen.getByText('Carrefour City')).toBeTruthy();
    expect(screen.queryByText('Monoprix')).toBeNull();

    fireEvent.changeText(screen.getByTestId('receipts-search'), 'zzzzz');
    expect(screen.getByTestId('receipts-empty')).toBeTruthy();
  });

  it('ouvre le ticket touché', () => {
    const onOpen = jest.fn();
    render(<ReceiptsScreen onOpenReceipt={onOpen} />);
    fireEvent.press(screen.getByTestId('receipt-row-seed_0'));
    expect(onOpen).toHaveBeenCalledWith('seed_0');
  });

  it('tient sans aucun ticket', () => {
    useReceiptsStore.setState({ receipts: [] });
    render(<ReceiptsScreen onOpenReceipt={jest.fn()} />);
    expect(screen.getByTestId('receipts-empty')).toBeTruthy();
  });
});

describe('<ReceiptDetailScreen />', () => {
  it('affiche les montants HT / TVA / TTC', () => {
    render(<ReceiptDetailScreen id="seed_0" onBack={jest.fn()} />);
    expect(screen.getByTestId('receipt-detail-screen')).toBeTruthy();
    expect(screen.getByText('Montant HT')).toBeTruthy();
    expect(screen.getByText('Montant TVA')).toBeTruthy();
    expect(screen.getByText('Montant TTC')).toBeTruthy();
  });

  it('transforme le ticket en facture certifiée', () => {
    render(<ReceiptDetailScreen id="seed_0" onBack={jest.fn()} />);
    expect(screen.queryByTestId('receipt-certificate')).toBeNull();

    fireEvent.press(screen.getByTestId('receipt-convert'));

    expect(screen.getByTestId('receipt-certificate')).toBeTruthy();
    expect(useReceiptsStore.getState().receipts.find((r) => r.id === 'seed_0')?.kind).toBe(
      'facture',
    );
  });

  it('montre déjà le certificat pour une facture semée', () => {
    // seed_4 (Bureau Vallée) arrive en facture.
    render(<ReceiptDetailScreen id="seed_4" onBack={jest.fn()} />);
    expect(screen.getByTestId('receipt-certificate')).toBeTruthy();
    expect(screen.queryByTestId('receipt-convert')).toBeNull();
  });

  it('reste stable sur un identifiant inconnu', () => {
    render(<ReceiptDetailScreen id="nope" onBack={jest.fn()} />);
    expect(screen.getByTestId('receipt-detail-missing')).toBeTruthy();
  });
});
