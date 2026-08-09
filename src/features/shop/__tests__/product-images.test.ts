import { DEALS, MERCHANTS } from '../model/catalog';
import { AWAITING_PHOTO, PRODUCT_IMAGES } from '../model/product-images';

describe('product images', () => {
  // La règle décidée avec le client : pas de visuel propre → pas de produit.
  // Les huit catégories du CDC ont forcé une exception, mais elle est NOMMÉE :
  // toute offre sans photo doit figurer dans `AWAITING_PHOTO`, sinon ce test
  // casse. On ne peut pas en ajouter une par distraction.
  it('gives every deal a real photo, or declares it as owed', () => {
    const missing = DEALS.filter((d) => !PRODUCT_IMAGES[d.id] && !AWAITING_PHOTO.has(d.id)).map(
      (d) => d.id,
    );
    expect(missing).toEqual([]);
  });

  it('empties the debt list as photos arrive', () => {
    // Un identifiant qui a DÉJÀ sa photo n'a rien à faire dans la liste : sans
    // ce test, elle ne rétrécirait jamais et perdrait tout son sens.
    const settled = [...AWAITING_PHOTO].filter((id) => PRODUCT_IMAGES[id]);
    expect(settled).toEqual([]);
  });

  it('owes no photo to a deal that does not exist', () => {
    const ids = new Set(DEALS.map((d) => d.id));
    expect([...AWAITING_PHOTO].filter((id) => !ids.has(id))).toEqual([]);
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
