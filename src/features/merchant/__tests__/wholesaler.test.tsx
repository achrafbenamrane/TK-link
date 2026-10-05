import { fireEvent, render, screen, waitFor } from '@/shared/testing/render';

import {
  canSupplierPublish,
  formatIban,
  isValidIban,
  missingSupplierFields,
} from '../lib/supplier';
import {
  nextWholesaleStatus,
  PREP_STEPS,
  WHOLESALE_ACTION_LABEL,
  WHOLESALE_STATUS_LABEL,
  WHOLESALE_STATUSES,
} from '../lib/wholesale-orders';
import { EMPTY_SUPPLIER, WholesaleOrderSchema } from '../model/schema';
import { useMerchantStore } from '../model/store';
import { MerchantOffersScreen } from '../ui/offers-screen';
import { ProLocked } from '../ui/pro-locked';
import { ProStatusBanner } from '../ui/pro-status-banner';
import { ProSetupScreen } from '../ui/pro-setup-screen';
import { WholesalerCatalogScreen } from '../ui/wholesaler-catalog-screen';
import { PublishForm } from '../ui/publish-form';
import { WholesalerDashboardScreen } from '../ui/wholesaler-dashboard-screen';
import { WholesalerOrdersScreen } from '../ui/wholesaler-orders-screen';

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/shared/lib/image-picker', () => ({
  pickImage: jest.fn().mockResolvedValue('file://id.jpg'),
}));

const order = (id: string, status: 'recue' | 'preparation' | 'terminee' = 'recue') => ({
  id,
  offerId: 'o1',
  title: 'Cagettes de légumes',
  seller: 'Grossiste Occitan',
  qty: 6,
  unitCents: 4500,
  totalCents: 27000,
  at: 1_700_000_000_000,
  status,
  buyer: 'Le Petit Toulousain',
  prep: [] as string[],
});

beforeEach(() =>
  useMerchantStore.setState({ wholesaleOrders: [], offers: [], supplier: EMPTY_SUPPLIER }),
);

describe('cycle d’une commande grossiste — schéma du client, CDC V1.1', () => {
  it('suit les statuts du schéma, sans étape « Acceptée » (le paiement vaut acceptation)', () => {
    expect([...WHOLESALE_STATUSES]).toEqual([
      'recue',
      'preparation',
      'expediee',
      'livree',
      'terminee',
    ]);
    expect(Object.values(WHOLESALE_STATUS_LABEL)).not.toContain('Acceptée');
    expect(Object.values(WHOLESALE_ACTION_LABEL)).not.toContain('Accepter');
  });

  it('avance d’un cran à la fois, et s’arrête à « Terminée »', () => {
    expect(nextWholesaleStatus('recue')).toBe('preparation');
    expect(nextWholesaleStatus('livree')).toBe('terminee');
    expect(nextWholesaleStatus('terminee')).toBeNull();
  });

  it('relit une commande enregistrée avant le suivi, comme « reçue »', () => {
    const legacy = WholesaleOrderSchema.parse({
      id: 'x',
      offerId: 'o',
      title: 'Lot',
      qty: 1,
      unitCents: 100,
      totalCents: 100,
      at: 1,
    });
    expect(legacy.status).toBe('recue');
  });
});

describe('<WholesalerOrdersScreen />', () => {
  it('liste les commandes des commerçants et les fait avancer', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_abc12')] });
    render(<WholesalerOrdersScreen />);

    const card = screen.getByTestId('wholesaler-order-w_abc12');
    expect(card).toHaveTextContent(/Le Petit Toulousain/);
    expect(card).toHaveTextContent(/COMMANDE REÇUE/);

    fireEvent.press(screen.getByTestId('wholesaler-order-w_abc12-advance'));
    expect(useMerchantStore.getState().wholesaleOrders[0]?.status).toBe('preparation');
    expect(screen.getByTestId('wholesaler-order-w_abc12')).toHaveTextContent(/EN PRÉPARATION/);
  });

  it('exige le bon de préparation rempli avant d’expédier', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_prep1', 'preparation')] });
    render(<WholesalerOrdersScreen />);

    // Tant que rien n'est coché, « expédiée » reste hors de portée.
    fireEvent.press(screen.getByTestId('wholesaler-order-w_prep1-advance'));
    expect(useMerchantStore.getState().wholesaleOrders[0]?.status).toBe('preparation');

    for (const p of PREP_STEPS) {
      fireEvent.press(screen.getByTestId(`wholesaler-order-w_prep1-prep-${p.key}`));
    }
    fireEvent.press(screen.getByTestId('wholesaler-order-w_prep1-advance'));
    expect(useMerchantStore.getState().wholesaleOrders[0]?.status).toBe('expediee');
    expect(screen.getByTestId('wholesaler-order-w_prep1')).toHaveTextContent(/transporteur/);
  });

  it('range les commandes terminées dans leur onglet, sans bouton d’action', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_done1', 'terminee')] });
    render(<WholesalerOrdersScreen />);
    expect(screen.getByTestId('wholesaler-orders-empty')).toBeTruthy();

    fireEvent.press(screen.getByTestId('wholesaler-filter-done'));
    expect(screen.getByTestId('wholesaler-order-w_done1')).toBeTruthy();
    expect(screen.queryByTestId('wholesaler-order-w_done1-advance')).toBeNull();
  });
});

describe('<WholesalerDashboardScreen />', () => {
  it('montre ses propres chiffres : offres B2B, commandes de commerçants, chiffre d’affaires', () => {
    useMerchantStore.setState({ wholesaleOrders: [order('w_1'), order('w_2', 'preparation')] });
    render(<WholesalerDashboardScreen companyName="Grossiste Occitan" onOpen={jest.fn()} />);
    expect(screen.getByTestId('wholesaler-dashboard')).toBeTruthy();
    expect(screen.getByText('Nouvelle offre pro')).toBeTruthy();
    expect(screen.getByTestId('wholesaler-recent-w_1')).toBeTruthy();
    // Aucun vocabulaire de client : pas de « Flash » ni de fidélité.
    expect(screen.queryByText('Fidélité')).toBeNull();
  });

  it('ouvre la création d’une offre pro quand le compte est validé', () => {
    useMerchantStore.setState({ supplier: { ...EMPTY_SUPPLIER, status: 'valide' } });
    const onOpen = jest.fn();
    render(<WholesalerDashboardScreen companyName="Grossiste Occitan" onOpen={onOpen} />);
    fireEvent.press(screen.getByTestId('wholesaler-create-offer'));
    expect(onOpen).toHaveBeenCalledWith('new');
  });
});

describe('<PublishForm wholesale />', () => {
  it('parle en prix grossiste, demande une quantité minimale et propose des durées longues', () => {
    render(<PublishForm wholesale onPublish={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Prix grossiste')).toBeTruthy();
    expect(screen.getByTestId('publish-min-qty')).toBeTruthy();
    expect(screen.getByTestId('publish-duration-1440')).toBeTruthy();
    expect(screen.queryByTestId('publish-duration-15')).toBeNull();
  });

  it('publie une offre B2B avec son minimum, sans refuser une durée de plusieurs jours', () => {
    const onPublish = jest.fn();
    render(<PublishForm wholesale onPublish={onPublish} onCancel={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('publish-title'), 'Cagettes de légumes');
    fireEvent.changeText(screen.getByTestId('publish-old-price'), '68');
    fireEvent.changeText(screen.getByTestId('publish-price'), '45');
    fireEvent.changeText(screen.getByTestId('publish-stock'), '60');
    fireEvent.changeText(screen.getByTestId('publish-min-qty'), '5');
    fireEvent.press(screen.getByTestId('publish-duration-4320'));
    fireEvent.press(screen.getByTestId('publish-submit'));

    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish.mock.calls[0]![0]).toMatchObject({
      minQty: 5,
      durationMinutes: 4320,
      audience: 'commercants',
    });
  });
});

describe('dossier fournisseur — étapes 3 à 6 du schéma', () => {
  const VALID = {
    siret: '44306184100047',
    address: '8 rue des Carmes, 31000 Toulouse',
    iban: 'FR76 3000 6000 0112 3456 7890 189',
    idUri: 'file://id.jpg',
  };

  it('valide un IBAN par sa clé, pas par sa seule longueur', () => {
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 189')).toBe(true);
    expect(isValidIban('FR76 3000 6000 0112 3456 7890 188')).toBe(false);
    expect(isValidIban('1234')).toBe(false);
    expect(formatIban('fr7630006000011234567890189')).toBe('FR76 3000 6000 0112 3456 7890 189');
  });

  it('liste ce qui manque au dossier', () => {
    expect(
      Object.keys(missingSupplierFields({ siret: '', address: '', iban: '', idUri: '' })),
    ).toEqual(['siret', 'address', 'iban', 'idUri']);
    expect(missingSupplierFields(VALID)).toEqual({});
  });

  it('ne publie qu’une fois le compte validé', () => {
    expect(canSupplierPublish('brouillon')).toBe(false);
    expect(canSupplierPublish('en_verification')).toBe(false);
    expect(canSupplierPublish('valide')).toBe(true);
  });

  it('refuse un dossier incomplet, accepte un dossier complet puis le fait valider', () => {
    const { submitSupplier, validateSupplier } = useMerchantStore.getState();
    expect(submitSupplier({ ...VALID, iban: 'FR00' }).ok).toBe(false);
    expect(useMerchantStore.getState().supplier.status).toBe('brouillon');

    // Valider un dossier jamais envoyé ne fait rien.
    validateSupplier();
    expect(useMerchantStore.getState().supplier.status).toBe('brouillon');

    expect(submitSupplier(VALID).ok).toBe(true);
    expect(useMerchantStore.getState().supplier.status).toBe('en_verification');
    expect(useMerchantStore.getState().supplier.iban).toBe('FR7630006000011234567890189');

    validateSupplier();
    expect(useMerchantStore.getState().supplier.status).toBe('valide');
  });

  it('parcourt l’écran : informations, vérification, sécurité, compte validé', async () => {
    const authenticate = jest.fn().mockResolvedValue(true);
    const onDone = jest.fn();
    render(
      <ProSetupScreen
        siret="44306184100047"
        address="8 rue des Carmes, 31000 Toulouse"
        authenticate={authenticate}
        onDone={onDone}
      />,
    );

    // Dossier vide : l'envoi est refusé, avec les champs en cause.
    fireEvent.press(screen.getByTestId('supplier-submit'));
    expect(screen.getByText('Cet IBAN n’est pas valide')).toBeTruthy();
    expect(screen.getByText('Ajoutez la pièce d’identité du dirigeant')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('supplier-iban'), VALID.iban);
    fireEvent.press(screen.getByTestId('supplier-id-add'));
    await waitFor(() => expect(screen.getByTestId('supplier-id-preview')).toBeTruthy());

    fireEvent.press(screen.getByTestId('supplier-submit'));
    expect(screen.getByTestId('supplier-verification-status')).toHaveTextContent(/en cours/);

    // La validation vient de TK LINK : ici, le bouton de démonstration.
    fireEvent.press(screen.getByTestId('supplier-demo-validate'));
    fireEvent.press(screen.getByTestId('supplier-to-security'));
    fireEvent.press(screen.getByTestId('supplier-enrol'));
    await waitFor(() => expect(screen.getByTestId('supplier-done')).toBeTruthy());
    expect(authenticate).toHaveBeenCalled();
    expect(useMerchantStore.getState().supplier.deviceEnrolled).toBe(true);

    fireEvent.press(screen.getByTestId('supplier-done'));
    expect(onDone).toHaveBeenCalled();
  });

  it('ferme la publication tant que le compte n’est pas validé', () => {
    const onOpenSetup = jest.fn();
    render(<ProLocked status="en_verification" onOpenSetup={onOpenSetup} />);
    expect(screen.getByText('Dossier en cours de contrôle')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pro-locked-open'));
    expect(onOpenSetup).toHaveBeenCalled();
  });

  it('le tableau de bord renvoie vers le dossier tant qu’il n’est pas validé', () => {
    const onOpen = jest.fn();
    render(<WholesalerDashboardScreen companyName="Grossiste Occitan" onOpen={onOpen} />);
    expect(screen.getByTestId('wholesaler-setup-banner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wholesaler-create-offer'));
    expect(onOpen).toHaveBeenCalledWith('setup');
  });
});

describe('dossier pro du commerçant — mêmes étapes 3 à 6 que le grossiste', () => {
  it('parle de commerçant et de Flash, pas de fournisseur', () => {
    render(
      <ProSetupScreen
        role="commercant"
        siret="44306184100047"
        address="8 rue des Carmes, 31000 Toulouse"
        authenticate={jest.fn().mockResolvedValue(true)}
        onDone={jest.fn()}
      />,
    );
    expect(screen.getByText(/tableau de bord commerçant/)).toBeTruthy();
    expect(screen.queryByText(/fournisseur/)).toBeNull();
  });

  it('ferme la publication de Flash tant que le dossier n’est pas validé', () => {
    render(<ProLocked status="brouillon" role="commercant" onOpenSetup={jest.fn()} />);
    expect(screen.getByText(/publication de Flash/)).toBeTruthy();
  });

  it('rappelle le dossier sur le tableau de bord', () => {
    const onPress = jest.fn();
    render(<ProStatusBanner status="brouillon" role="commercant" onPress={onPress} />);
    fireEvent.press(screen.getByTestId('pro-setup-banner'));
    expect(onPress).toHaveBeenCalled();
  });

  it('s’efface une fois le dossier validé', () => {
    render(<ProStatusBanner status="valide" role="commercant" onPress={jest.fn()} />);
    expect(screen.queryByTestId('pro-setup-banner')).toBeNull();
  });
});

describe('le grossiste n’est pas un commerçant', () => {
  const lot = (id: string) => ({
    id,
    title: 'Cagettes',
    category: 'restauration' as const,
    priceCents: 4500,
    oldPriceCents: 6800,
    stock: 10,
    stockLeft: 10,
    durationMinutes: 1440,
    description: '',
    publishedAt: 1,
    startsAt: 0,
    state: 'publiee' as const,
    offline: false,
    audience: 'commercants' as const,
    photoUri: '',
    modes: ['touch-collect' as const, 'livraison' as const],
    seller: 'Grossiste Occitan',
    minQty: 3,
  });
  const draft = {
    title: 'Cagettes',
    category: 'restauration' as const,
    priceCents: 4500,
    oldPriceCents: 6800,
    stock: 10,
    durationMinutes: 1440,
    audience: 'commercants' as const,
  };

  it('une offre pro ne consomme pas le quota des Flash et n’en dépend pas', () => {
    useMerchantStore.setState({ used: 5, purchased: 0 });
    const res = useMerchantStore.getState().publish(draft, 'G');
    expect(res.ok).toBe(true);
    expect(useMerchantStore.getState().used).toBe(5);

    // Le même quota épuisé bloque, lui, un Flash de commerçant.
    expect(useMerchantStore.getState().publish({ ...draft, audience: 'clients' }, 'K').ok).toBe(
      false,
    );
  });

  it('l’écran des lots ne parle ni de quota Flash ni d’opérations offertes', () => {
    useMerchantStore.setState({ offers: [lot('l1')], used: 5 });
    render(<MerchantOffersScreen audience="commercants" />);
    expect(screen.getByTestId('merchant-live-lots')).toHaveTextContent('1');
    expect(screen.queryByText(/offerte/)).toBeNull();
    expect(screen.queryByText(/CDC/)).toBeNull();
    expect(screen.getByText('Publier un lot')).toBeTruthy();
    // Un lot s'annonce « Lot · min. 3 », pas « Resto ».
    expect(screen.getByTestId('merchant-offer-l1')).toHaveTextContent(/Lot · min\. 3/);
  });

  it('règle le stock d’un lot, jamais sous zéro', () => {
    useMerchantStore.setState({ offers: [lot('l1')] });
    const { adjustStock } = useMerchantStore.getState();
    adjustStock('l1', 5);
    expect(useMerchantStore.getState().offers[0]?.stockLeft).toBe(15);
    adjustStock('l1', -100);
    expect(useMerchantStore.getState().offers[0]?.stockLeft).toBe(0);
  });

  it('paramètre le catalogue : stocks, livraison (retrait ou expédition), zone', () => {
    useMerchantStore.setState({ offers: [lot('l1')] });
    render(<WholesalerCatalogScreen />);
    expect(screen.getByText('Retrait sur place')).toBeTruthy();
    expect(screen.getByText('Expédition')).toBeTruthy();
    expect(screen.queryByText('Touch & Collect')).toBeNull();

    fireEvent.press(screen.getByTestId('wholesaler-lot-l1-inc'));
    expect(screen.getByTestId('wholesaler-lot-l1-stock')).toHaveTextContent('11');

    fireEvent.changeText(screen.getByTestId('wholesaler-zone'), 'Occitanie');
    fireEvent(screen.getByTestId('wholesaler-mode-touch-collect'), 'valueChange', false);
    fireEvent(screen.getByTestId('wholesaler-mode-livraison'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('wholesaler-catalog-save'));
    expect(screen.getByTestId('wholesaler-modes-error')).toBeTruthy();

    fireEvent(screen.getByTestId('wholesaler-mode-livraison'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('wholesaler-catalog-save'));
    expect(screen.getByTestId('wholesaler-catalog-saved')).toBeTruthy();
    expect(useMerchantStore.getState().profile.zone).toBe('Occitanie');
    expect(useMerchantStore.getState().profile.modes).toEqual(['livraison']);
  });
});
