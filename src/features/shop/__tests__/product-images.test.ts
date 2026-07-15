import { DEALS, MERCHANTS } from '../model/catalog';
import { PRODUCT_IMAGES } from '../model/product-images';

describe('product images', () => {
  // La règle décidée avec le client : pas de visuel propre → pas de produit.
  // Un test plutôt qu'une bonne intention : ajouter un deal sans image casse ici.
  it('gives every deal a real photo', () => {
    const missing = DEALS.filter((d) => !PRODUCT_IMAGES[d.id]).map((d) => d.id);
    expect(missing).toEqual([]);
  });

  it('has no image pointing at a deal that no longer exists', () => {
    const ids = new Set(DEALS.map((d) => d.id));
    const orphans = Object.keys(PRODUCT_IMAGES).filter((id) => !ids.has(id));
    expect(orphans).toEqual([]);
  });
});

describe('catalog integrity', () => {
  it('points every deal at a merchant that exists', () => {
    const broken = DEALS.filter((d) => !MERCHANTS[d.merchantId]).map((d) => d.id);
    expect(broken).toEqual([]);
  });

  // Un commerçant sans vente flash ne s'affiche nulle part : c'est de la donnée
  // morte, et elle traîne quand on retire un produit sans retirer sa boutique.
  it('leaves no merchant without a deal', () => {
    const used = new Set(DEALS.map((d) => d.merchantId));
    const orphans = Object.keys(MERCHANTS).filter((id) => !used.has(id));
    expect(orphans).toEqual([]);
  });
});
