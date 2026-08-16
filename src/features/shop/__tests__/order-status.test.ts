import {
  canTransition,
  FULFILMENT_LABEL,
  isActive,
  isFinal,
  nextStatuses,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  timelineFor,
  timelineIndex,
  type OrderStatus,
} from '../lib/order-status';
import { FulfilmentSchema } from '../model/schema';
import { formatCountdown } from '../ui/components/countdown';

describe('statuts — CDC §11', () => {
  it('reprend les dix statuts du cahier des charges', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'panier',
      'creee',
      'paiement_attente',
      'payee',
      'preparation',
      'prete',
      'recuperee',
      'livree',
      'annulee',
      'remboursee',
    ]);
  });

  it('libelle chacun d’eux', () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABEL[s].length).toBeGreaterThan(0);
    expect(ORDER_STATUS_LABEL.paiement_attente).toBe('Paiement en attente');
  });

  it('donne un ton à chacun', () => {
    for (const s of ORDER_STATUSES) expect(STATUS_TONE[s]).toBeDefined();
    expect(STATUS_TONE.annulee).toBe('echec');
    expect(STATUS_TONE.livree).toBe('succes');
  });
});

describe('machine à états', () => {
  it('suit le parcours nominal jusqu’au bout', () => {
    const path: OrderStatus[] = [
      'panier',
      'creee',
      'paiement_attente',
      'payee',
      'preparation',
      'prete',
      'livree',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!, 'livraison')).toBe(true);
    }
  });

  it('interdit de remonter le temps', () => {
    // Sans cette barrière, un bug d’affichage devient un bug comptable.
    expect(canTransition('remboursee', 'preparation', 'livraison')).toBe(false);
    expect(canTransition('livree', 'payee', 'livraison')).toBe(false);
    expect(canTransition('payee', 'creee', 'livraison')).toBe(false);
  });

  it('interdit de sauter le paiement', () => {
    expect(canTransition('creee', 'preparation', 'livraison')).toBe(false);
    expect(canTransition('creee', 'payee', 'livraison')).toBe(false);
  });

  it('laisse annuler tant que rien n’est conclu', () => {
    for (const s of ['panier', 'creee', 'paiement_attente', 'payee', 'preparation', 'prete']) {
      expect(canTransition(s as OrderStatus, 'annulee', 'livraison')).toBe(true);
    }
  });

  it('permet encore de rembourser une commande annulée', () => {
    // Annulée après paiement : l’argent doit pouvoir revenir.
    expect(canTransition('annulee', 'remboursee', 'livraison')).toBe(true);
  });

  it('ne connaît qu’un seul état terminal', () => {
    expect(ORDER_STATUSES.filter(isFinal)).toEqual(['remboursee']);
  });
});

describe('Touch & Collect vs livraison — CDC §12', () => {
  it('une commande à retirer se termine « récupérée », jamais « livrée »', () => {
    expect(nextStatuses('prete', 'touch-collect')).toContain('recuperee');
    expect(nextStatuses('prete', 'touch-collect')).not.toContain('livree');
    expect(canTransition('prete', 'livree', 'touch-collect')).toBe(false);
  });

  it('une commande livrée se termine « livrée », jamais « récupérée »', () => {
    expect(nextStatuses('prete', 'livraison')).toContain('livree');
    expect(nextStatuses('prete', 'livraison')).not.toContain('recuperee');
    expect(canTransition('prete', 'recuperee', 'livraison')).toBe(false);
  });

  it('laisse annuler dans les deux modes', () => {
    expect(nextStatuses('prete', 'touch-collect')).toContain('annulee');
    expect(nextStatuses('prete', 'livraison')).toContain('annulee');
  });
});

describe('frise du client', () => {
  it('se termine par l’étape correspondant au mode', () => {
    expect(timelineFor('touch-collect').at(-1)).toBe('recuperee');
    expect(timelineFor('livraison').at(-1)).toBe('livree');
  });

  it('situe la commande sur la frise', () => {
    expect(timelineIndex('creee', 'livraison')).toBe(0);
    expect(timelineIndex('livree', 'livraison')).toBe(5);
  });

  it('sort de la frise ce qui n’en fait pas partie', () => {
    // Afficher « annulée » comme une étape d’avancement serait un mensonge.
    expect(timelineIndex('annulee', 'livraison')).toBeNull();
    expect(timelineIndex('remboursee', 'livraison')).toBeNull();
    // « livrée » n’est pas une étape d’un parcours Touch & Collect.
    expect(timelineIndex('livree', 'touch-collect')).toBeNull();
  });
});

describe('isActive', () => {
  it('distingue ce qui est en cours de ce qui est clos', () => {
    expect(isActive('preparation')).toBe(true);
    expect(isActive('prete')).toBe(true);
    expect(isActive('livree')).toBe(false);
    expect(isActive('recuperee')).toBe(false);
    expect(isActive('annulee')).toBe(false);
  });
});

describe('Touch & Collect — CDC V1.0 §5.3', () => {
  it('relit une commande stockée sous l’ancien nom sans la perdre', () => {
    // Renommer une valeur d'énum PERSISTÉE n'est pas un renommage : les
    // commandes déjà sur les téléphones portent 'click-collect'. Sans ce
    // passage, `safeParse` échouerait et le store repartirait de zéro —
    // tout l'historique effacé, sans un message d'erreur.
    const relu = FulfilmentSchema.parse('click-collect');
    expect(relu).toBe('touch-collect');
  });

  it('accepte évidemment la valeur actuelle', () => {
    expect(FulfilmentSchema.parse('touch-collect')).toBe('touch-collect');
    expect(FulfilmentSchema.parse('livraison')).toBe('livraison');
  });

  it('refuse une valeur inconnue plutôt que de la laisser passer', () => {
    expect(() => FulfilmentSchema.parse('drive')).toThrow();
  });

  it('n’emploie plus « Click & Collect » nulle part dans les libellés', () => {
    for (const label of Object.values(FULFILMENT_LABEL)) {
      expect(label).not.toMatch(/Click ?& ?Collect/i);
    }
    expect(FULFILMENT_LABEL['touch-collect']).toBe('Touch & Collect');
  });
});

describe('le compte à rebours garde trois blocs — affiches client', () => {
  it('affiche les heures même quand il en reste zéro', () => {
    // Le format passait de « 1:01:12 » à « 01:12 » sous l’heure : la pastille
    // se rétrécissait au milieu du décompte, et « 04:31 » ne dit pas s’il
    // reste quatre minutes ou quatre heures. Les affiches montrent toujours
    // trois blocs.
    expect(formatCountdown(45)).toBe('00:00:45');
    expect(formatCountdown(4 * 60 + 31)).toBe('00:04:31');
    expect(formatCountdown(3600 + 72)).toBe('01:01:12');
  });

  it('ne descend jamais sous zéro', () => {
    expect(formatCountdown(-10)).toBe('00:00:00');
  });
});
