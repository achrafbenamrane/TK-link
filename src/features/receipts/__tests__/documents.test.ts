import { isAccounting, isCustomerFacing, RECEIPT_KIND_LABEL } from '../model/schema';
import { isPurgeable, purge } from '../lib/retention';
import type { Receipt } from '../model/schema';

const NOW = new Date(2026, 7, 16, 12).getTime();

const doc = (over: Partial<Receipt> = {}): Receipt =>
  ({
    id: 'r1',
    merchant: 'Maison Hammamet',
    category: 'alimentation',
    channel: 'store',
    kind: 'ticket',
    issuedAt: new Date(2010, 0, 1).getTime(),
    totalCents: 1990,
    vatCents: 199,
    lines: [],
    reference: 'T-1',
    certificateId: '',
    pointsEarned: 0,
    pinned: false,
    orderId: '',
    ...over,
  }) as Receipt;

describe('les quatre documents du CDC V1.0 §9.1', () => {
  it('les distingue tous les quatre', () => {
    // « Ces objets ne doivent pas être confondus dans la base de données ni
    // dans les workflows. » Ils n’ont ni le même destinataire, ni la même
    // valeur, ni la même durée de vie.
    expect(Object.keys(RECEIPT_KIND_LABEL).sort()).toEqual([
      'facture',
      'garantie',
      'preparation',
      'ticket',
    ]);
  });

  it('ne compte comme comptable que ce qui l’est', () => {
    // Les dix ans du §9.6 visent « les pièces justificatives comptables ».
    expect(isAccounting('facture')).toBe(true);
    expect(isAccounting('ticket')).toBe(true);
    expect(isAccounting('preparation')).toBe(false);
    expect(isAccounting('garantie')).toBe(false);
  });

  it('garde le ticket de préparation hors de l’espace du client', () => {
    // §6.3 : c’est un document d’atelier — cuisine, comptoir. L’afficher au
    // client montrerait l’arrière-boutique du commerçant.
    expect(isCustomerFacing('preparation')).toBe(false);
    expect(isCustomerFacing('facture')).toBe(true);
  });
});

describe('la purge respecte le type', () => {
  it('n’efface JAMAIS une garantie, même très ancienne', () => {
    // Une garantie se périme avec le produit, pas avec l’exercice comptable.
    // Le CDC ne fixe pas sa durée : on ne la devine pas, on ne purge pas.
    const g = doc({ id: 'g', kind: 'garantie' });
    expect(isPurgeable(g, NOW)).toBe(false);
    expect(purge([g], NOW).map((r) => r.id)).toEqual(['g']);
  });

  it('efface une facture au terme des dix ans', () => {
    const f = doc({ id: 'f', kind: 'facture' });
    expect(isPurgeable(f, NOW)).toBe(true);
    expect(purge([f], NOW)).toEqual([]);
  });

  it('épargne ce que l’utilisateur a épinglé, quel que soit le type', () => {
    const f = doc({ id: 'f', kind: 'facture', pinned: true });
    expect(purge([f], NOW).map((r) => r.id)).toEqual(['f']);
  });
});
