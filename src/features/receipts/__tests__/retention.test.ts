import {
  daysLeft,
  expiringCount,
  formatKeptUntil,
  isExpired,
  keptUntil,
  purge,
  RETENTION_YEARS,
} from '../lib/retention';
import type { Receipt } from '../model/schema';
import { useReceiptsStore } from '../model/store';

const NOW = new Date(2026, 7, 10, 12).getTime();

const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r1',
  merchant: 'Carrefour City',
  reference: 'TK-2024-0001',
  issuedAt: new Date(2024, 7, 10, 12).getTime(),
  currency: 'EUR',
  totalCents: 1200,
  vatCents: 200,
  netCents: 1000,
  dueAt: null,
  category: 'alimentation',
  supplierCode: '',
  lines: [{ label: 'Courses', qty: 1, unitCents: 1200 }],
  channel: 'store',
  kind: 'ticket',
  certificateId: '',
  pointsEarned: 12,
  pinned: false,
  orderId: '',
  ...over,
});

describe('durée de conservation — CDC V1.0 §9.6', () => {
  it('DIX ans calendaires, pas 3 650 jours', () => {
    // Le piège des bissextiles : un décalage d'un jour sur une purge
    // automatique, c'est un document effacé la veille d'un contrôle.
    const r = receipt({ issuedAt: new Date(2024, 1, 29, 12).getTime() });
    const until = new Date(keptUntil(r));
    expect(until.getFullYear()).toBe(2034);
    // Le V0.1 disait deux ans ; le V1.0 écarte explicitement cette règle et
    // retient dix ans, durée légale des pièces comptables en France.
    expect(RETENTION_YEARS).toBe(10);
  });

  it('un document tout juste échu est expiré, pas « encore valable »', () => {
    const r = receipt({ issuedAt: new Date(2016, 7, 10, 12).getTime() });
    expect(isExpired(r, NOW)).toBe(true);
    expect(daysLeft(r, NOW)).toBe(0);
  });

  it('compte les jours restants pour un document récent', () => {
    const r = receipt({ issuedAt: new Date(2026, 7, 1, 12).getTime() });
    expect(isExpired(r, NOW)).toBe(false);
    // Dix ans moins quelques jours : le seuil monte avec la durée légale.
    expect(daysLeft(r, NOW)).toBeGreaterThan(3600);
  });

  it('affiche la date jusqu’à laquelle on garde', () => {
    expect(formatKeptUntil(receipt())).toBe('10/08/2034');
  });
});

describe('purge', () => {
  it('efface ce qui est échu, garde le reste', () => {
    const vieux = receipt({ id: 'vieux', issuedAt: new Date(2015, 0, 1).getTime() });
    const recent = receipt({ id: 'recent', issuedAt: new Date(2026, 6, 1).getTime() });

    expect(purge([vieux, recent], NOW).map((r) => r.id)).toEqual(['recent']);
    expect(expiringCount([vieux, recent], NOW)).toBe(1);
  });

  it('un document ÉPINGLÉ survit à sa date', () => {
    // L'utilisateur a dit explicitement qu'il en avait besoin — une garantie
    // de dix ans, un litige. Le purger détruirait ce qu'on avait promis.
    const garantie = receipt({ id: 'g', issuedAt: new Date(2020, 0, 1).getTime(), pinned: true });
    expect(purge([garantie], NOW)).toHaveLength(1);
  });

  it('une durée différente change tout, sans toucher au reste du code', () => {
    // Le §23 Q8 est ouverte : dix ans pour les factures pro reste possible.
    const r = receipt({ issuedAt: new Date(2024, 7, 10, 12).getTime() });
    expect(isExpired(r, NOW, 2)).toBe(true);
    expect(isExpired(r, NOW, 10)).toBe(false);
  });
});

describe('store', () => {
  beforeEach(() => {
    useReceiptsStore.setState({ receipts: [] });
  });

  it('purgeExpired dit COMBIEN il a supprimé', () => {
    useReceiptsStore.setState({
      receipts: [
        // Antérieurs de plus de DIX ans : 2020 et 2021 ne suffisent plus
        // depuis que la durée légale est passée de deux à dix ans.
        receipt({ id: 'a', issuedAt: new Date(2012, 0, 1).getTime() }),
        receipt({ id: 'b', issuedAt: new Date(2013, 0, 1).getTime() }),
        receipt({ id: 'c', issuedAt: Date.now() }),
      ],
    });

    expect(useReceiptsStore.getState().purgeExpired()).toBe(2);
    expect(useReceiptsStore.getState().receipts.map((r) => r.id)).toEqual(['c']);
  });

  it('ne touche à rien quand rien n’est échu', () => {
    const fresh = [receipt({ id: 'c', issuedAt: Date.now() })];
    useReceiptsStore.setState({ receipts: fresh });

    expect(useReceiptsStore.getState().purgeExpired()).toBe(0);
    // Référence INCHANGÉE : remplacer le tableau pour rien relancerait un
    // rendu chez tous les abonnés à chaque démarrage.
    expect(useReceiptsStore.getState().receipts).toBe(fresh);
  });
});
