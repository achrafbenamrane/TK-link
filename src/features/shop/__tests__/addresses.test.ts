import { AddressDraftSchema, MerchantApplicationSchema } from '../model/schema';
import { useShopStore } from '../model/store';

const DRAFT = { label: 'Maison', street: '12 rue des Filatiers', zip: '31000', city: 'Toulouse' };

beforeEach(() => {
  useShopStore.setState({ addresses: [], merchantApplication: null });
});

describe('addresses', () => {
  it('makes the first address the default, so an order always has a target', () => {
    useShopStore.getState().addAddress(DRAFT);
    const [first] = useShopStore.getState().addresses;
    expect(first?.isDefault).toBe(true);
  });

  it('does not steal the default from an existing address', () => {
    useShopStore.getState().addAddress(DRAFT);
    useShopStore.getState().addAddress({ ...DRAFT, label: 'Bureau' });
    const defaults = useShopStore.getState().addresses.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.label).toBe('Maison');
  });

  it('keeps exactly one default when switching', () => {
    useShopStore.getState().addAddress(DRAFT);
    const id = useShopStore.getState().addAddress({ ...DRAFT, label: 'Bureau' });
    useShopStore.getState().setDefaultAddress(id);
    const addresses = useShopStore.getState().addresses;
    expect(addresses.filter((a) => a.isDefault)).toHaveLength(1);
    expect(addresses.find((a) => a.isDefault)?.id).toBe(id);
  });

  // Sans ça, supprimer l'adresse par défaut laisserait le compte sans cible
  // de livraison alors qu'il reste des adresses.
  it('promotes another address when the default is deleted', () => {
    const first = useShopStore.getState().addAddress(DRAFT);
    useShopStore.getState().addAddress({ ...DRAFT, label: 'Bureau' });
    useShopStore.getState().removeAddress(first);

    const addresses = useShopStore.getState().addresses;
    expect(addresses).toHaveLength(1);
    expect(addresses[0]?.isDefault).toBe(true);
  });

  it('deleting the last address leaves none', () => {
    const id = useShopStore.getState().addAddress(DRAFT);
    useShopStore.getState().removeAddress(id);
    expect(useShopStore.getState().addresses).toEqual([]);
  });

  it('edits in place without touching the default flag', () => {
    const id = useShopStore.getState().addAddress(DRAFT);
    useShopStore.getState().updateAddress(id, { ...DRAFT, label: 'Chez moi' });
    const [a] = useShopStore.getState().addresses;
    expect(a?.label).toBe('Chez moi');
    expect(a?.isDefault).toBe(true);
  });
});

describe('AddressDraftSchema', () => {
  it('rejects a zip that is not 5 digits', () => {
    expect(AddressDraftSchema.safeParse({ ...DRAFT, zip: '310' }).success).toBe(false);
  });

  it('accepts a valid draft with no notes', () => {
    expect(AddressDraftSchema.safeParse(DRAFT).success).toBe(true);
  });
});

describe('MerchantApplicationSchema', () => {
  const APP = {
    shopName: 'Maison Hammamet',
    category: 'restauration' as const,
    contactName: 'Farid',
    phone: '06 12 34 56 78',
    email: 'farid@hammamet.fr',
    area: 'Empalot',
  };

  it('accepts a French mobile in the usual spaced format', () => {
    expect(MerchantApplicationSchema.safeParse(APP).success).toBe(true);
  });

  it('accepts the +33 international form', () => {
    expect(MerchantApplicationSchema.safeParse({ ...APP, phone: '+33612345678' }).success).toBe(
      true,
    );
  });

  it('rejects a phone that is too short', () => {
    expect(MerchantApplicationSchema.safeParse({ ...APP, phone: '0612' }).success).toBe(false);
  });

  it('rejects a malformed email', () => {
    expect(MerchantApplicationSchema.safeParse({ ...APP, email: 'farid@' }).success).toBe(false);
  });

  it('stores the application once submitted', () => {
    useShopStore.getState().submitMerchantApplication(APP);
    expect(useShopStore.getState().merchantApplication?.shopName).toBe('Maison Hammamet');
  });
});
