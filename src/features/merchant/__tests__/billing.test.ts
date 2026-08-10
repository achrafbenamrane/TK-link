import {
  canPublish,
  commissionCents,
  COMMISSION_PCT,
  formatCents,
  freeLeft,
  FREE_OPERATIONS,
  netCents,
  operationsLeft,
  PACKS,
  parseEurosToCents,
  unitPriceCents,
} from '../lib/billing';

describe('quota d’opérations — CDC §9', () => {
  it('offre les cinq premières publications', () => {
    expect(freeLeft(0)).toBe(FREE_OPERATIONS);
    expect(freeLeft(3)).toBe(2);
    expect(freeLeft(5)).toBe(0);
  });

  it('ne descend jamais sous zéro, même si le compteur dérape', () => {
    expect(freeLeft(99)).toBe(0);
    expect(operationsLeft(99, 0)).toBe(0);
  });

  it('bloque la publication une fois le quota consommé', () => {
    expect(canPublish(4, 0)).toBe(true);
    expect(canPublish(5, 0)).toBe(false);
  });

  it('un pack redonne le droit de publier', () => {
    expect(canPublish(5, 10)).toBe(true);
    expect(operationsLeft(5, 10)).toBe(10);
  });
});

describe('packs', () => {
  it('le prix à l’opération baisse avec le volume', () => {
    const unit = PACKS.map(unitPriceCents);
    for (let i = 1; i < unit.length; i++) {
      expect(unit[i]!).toBeLessThan(unit[i - 1]!);
    }
  });

  it('aucun pack gratuit ni vide', () => {
    for (const p of PACKS) {
      expect(p.operations).toBeGreaterThan(0);
      expect(p.priceCents).toBeGreaterThan(0);
    }
  });
});

describe('commission — CDC §21', () => {
  it('prélève 5 % par défaut', () => {
    expect(commissionCents(10_000)).toBe(500);
    expect(netCents(10_000)).toBe(9_500);
  });

  it('commission + net retombent TOUJOURS sur le total', () => {
    // Le piège d'un double arrondi : deux calculs indépendants finissent par
    // perdre un centime, et le relevé du commerçant ne tombe plus juste.
    for (const total of [1, 7, 99, 333, 1234, 99_999]) {
      expect(commissionCents(total) + netCents(total)).toBe(total);
    }
  });

  it('un total nul ou négatif ne produit rien', () => {
    expect(commissionCents(0)).toBe(0);
    expect(netCents(-100)).toBe(0);
  });

  it('accepte un autre taux — le CDC §23 le laisse ouvert', () => {
    expect(commissionCents(10_000, 12)).toBe(1_200);
    expect(COMMISSION_PCT).toBe(5);
  });
});

describe('saisie de montants', () => {
  it('accepte la virgule autant que le point', () => {
    expect(parseEurosToCents('24,90')).toBe(2490);
    expect(parseEurosToCents('24.90')).toBe(2490);
    expect(parseEurosToCents('7')).toBe(700);
  });

  it('refuse ce qui n’est pas un montant', () => {
    for (const bad of ['', 'abc', '-5', '1,234', '12€', '1.2.3']) {
      expect(parseEurosToCents(bad)).toBeNull();
    }
  });

  it('affiche à la française', () => {
    expect(formatCents(2490)).toBe('24,90 €');
    expect(formatCents(0)).toBe('0,00 €');
  });
});
