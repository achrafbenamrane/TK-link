import { fireEvent, render, screen } from '@/shared/testing/render';

import {
  DEFAULT_TIERS,
  programOf,
  selectPrograms,
  TierSchema as TierShape,
  useMerchantLoyaltyStore,
} from '../model/merchant-store';
import { TiersSettingsScreen } from '../ui/tiers-settings-screen';

const MID = 'm_boulanger';

const programNow = (id: string = MID) =>
  programOf(selectPrograms(useMerchantLoyaltyStore.getState()), id);

/**
 * CDC §8.3 et V1.1 — « jusqu'à 4 paliers » propres à CHAQUE commerçant, et une
 * unité de calcul (achats ou euros) choisie à la création, figée une fois en
 * ligne.
 *
 * Les paliers étaient une liste partagée par toutes les enseignes : un
 * boulanger offrait « 4 californias saumon-cheese ». Un barème qui ne ressemble
 * pas à ce que le commerce vend ne fidélise personne.
 */
describe('paliers de fidélité — CDC §8.3', () => {
  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ programs: {} });
  });

  it('enregistre un barème propre au commerçant', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '10');
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(programNow().tiers[0]).toMatchObject({
      rank: 1,
      cost: 10,
      reward: 'Un croissant offert',
    });
  });

  it('ne touche pas au barème des autres commerçants', () => {
    render(<TiersSettingsScreen merchantId={MID} />);
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(programNow('m_napoli').tiers).toEqual(DEFAULT_TIERS);
  });

  it('refuse un palier qui ne coûte pas plus cher que le précédent', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    // Palier 2 moins cher que le palier 1 : personne ne s'arrêterait au premier.
    fireEvent.changeText(screen.getByTestId('tier-cost-1'), '100');
    fireEvent.changeText(screen.getByTestId('tier-cost-2'), '50');
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(screen.getByTestId('tier-error-2')).toBeTruthy();
    // Et rien n'est enregistré : un barème à moitié valide n'existe pas.
    expect(selectPrograms(useMerchantLoyaltyStore.getState())[MID]).toBeUndefined();
  });

  it('refuse un avantage sans libellé', () => {
    render(<TiersSettingsScreen merchantId={MID} />);

    fireEvent.changeText(screen.getByTestId('tier-reward-1'), '   ');
    fireEvent.press(screen.getByTestId('tiers-save'));

    // Une case blanche sur la carte du client ne lui dit pas ce qu'il a gagné.
    expect(screen.getByTestId('tier-error-1')).toBeTruthy();
  });

  it('renumérote les rangs dans l’ordre et plafonne à quatre paliers', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, {
      unit: 'euros',
      tiers: [1, 2, 3, 4, 5].map((n) => ({ rank: 9, cost: n * 10, reward: `R${n}` })),
    });
    expect(programNow().tiers.map((t) => t.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe('unité de calcul — CDC V1.1', () => {
  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ programs: {} });
  });

  it('se choisit à la création…', () => {
    render(<TiersSettingsScreen merchantId={MID} />);
    fireEvent.press(screen.getByTestId('program-unit-achats'));
    fireEvent.press(screen.getByTestId('tiers-save'));
    expect(programNow().unit).toBe('achats');
  });

  it('…puis ne change plus une fois le programme en ligne', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, { unit: 'achats', tiers: DEFAULT_TIERS });

    // Même en passant une autre unité, le programme en ligne garde la sienne.
    useMerchantLoyaltyStore.getState().saveProgram(MID, { unit: 'euros', tiers: DEFAULT_TIERS });
    expect(programNow().unit).toBe('achats');

    render(<TiersSettingsScreen merchantId={MID} />);
    expect(screen.getByTestId('program-unit-note')).toHaveTextContent(/ne peut plus être modifiée/);
  });
});

describe('récompense choisie parmi les produits du commerçant', () => {
  const PRODUCTS = [
    { id: 'p_casque', title: 'Casque audio sans fil offert' },
    { id: 'p_cable', title: 'Câble USB-C offert' },
  ];

  beforeEach(() => {
    useMerchantLoyaltyStore.setState({ programs: {} });
  });

  it('un palier ancien, sans productId, se relit', () => {
    const parsed = TierShape.safeParse({ rank: 1, cost: 20, reward: '1 boisson' });
    expect(parsed.success).toBe(true);
  });

  it('choisir un produit remplit le libellé et mémorise son identifiant', () => {
    render(<TiersSettingsScreen merchantId={MID} products={PRODUCTS} />);

    fireEvent.press(screen.getByTestId('loyalty-reward-product-open-1'));
    fireEvent.press(screen.getByTestId('loyalty-reward-product-p_casque'));

    expect(screen.getByTestId('tier-reward-1').props.value).toBe('Casque audio sans fil offert');
    fireEvent.press(screen.getByTestId('tiers-save'));
    expect(programNow().tiers[0]).toMatchObject({
      reward: 'Casque audio sans fil offert',
      productId: 'p_casque',
    });
  });

  it('la saisie libre reste possible et défait le lien avec le produit', () => {
    render(<TiersSettingsScreen merchantId={MID} products={PRODUCTS} />);

    fireEvent.press(screen.getByTestId('loyalty-reward-product-open-1'));
    fireEvent.press(screen.getByTestId('loyalty-reward-product-p_cable'));
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un café offert');
    fireEvent.press(screen.getByTestId('tiers-save'));

    const tier = programNow().tiers[0];
    expect(tier?.reward).toBe('Un café offert');
    expect(tier?.productId).toBeUndefined();
  });

  it('« Autre récompense » détache le produit mais garde le texte', () => {
    render(<TiersSettingsScreen merchantId={MID} products={PRODUCTS} />);

    fireEvent.press(screen.getByTestId('loyalty-reward-product-open-1'));
    fireEvent.press(screen.getByTestId('loyalty-reward-product-p_cable'));
    fireEvent.press(screen.getByTestId('loyalty-reward-product-open-1'));
    fireEvent.press(screen.getByTestId('loyalty-reward-product-other'));
    fireEvent.press(screen.getByTestId('tiers-save'));

    expect(programNow().tiers[0]).toMatchObject({ reward: 'Câble USB-C offert' });
    expect(programNow().tiers[0]?.productId).toBeUndefined();
  });

  it('sans produit publié, la liste est remplacée par un message clair', () => {
    render(<TiersSettingsScreen merchantId={MID} products={[]} />);

    expect(screen.queryByTestId('loyalty-reward-product-open-1')).toBeNull();
    expect(screen.getByTestId('loyalty-reward-product-empty-1')).toHaveTextContent(
      'Aucun produit publié pour l’instant',
    );
    // Le texte libre, lui, fonctionne toujours.
    fireEvent.changeText(screen.getByTestId('tier-reward-1'), 'Un croissant offert');
    fireEvent.press(screen.getByTestId('tiers-save'));
    expect(programNow().tiers[0]?.reward).toBe('Un croissant offert');
  });

  it('un produit enregistré réapparaît sélectionné à la réouverture', () => {
    useMerchantLoyaltyStore.getState().saveProgram(MID, {
      unit: 'euros',
      tiers: [{ rank: 1, cost: 10, reward: PRODUCTS[0]!.title, productId: 'p_casque' }],
    });
    render(<TiersSettingsScreen merchantId={MID} products={PRODUCTS} />);
    expect(screen.getByText('Casque audio sans fil offert')).toBeTruthy();
  });
});
