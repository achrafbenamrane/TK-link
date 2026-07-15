/**
 * Visuels produits, embarqués dans l'app (donc affichés hors ligne, sans
 * dépendre d'un CDN pendant une démo client).
 *
 * `require` n'accepte que des chemins littéraux : Metro résout les assets à la
 * compilation, une clé dynamique ne marcherait pas. D'où cette table écrite à
 * la main plutôt qu'un `require(`...${id}.jpg`)`.
 *
 * Le catalogue ne contient QUE des produits ayant un visuel propre : sushi et
 * chocolat ont été retirés faute d'image utilisable (filigranes / marques
 * tierces). Le repli emoji de `ProductImage` reste par sécurité, mais aucun
 * produit ne doit s'y trouver — un visuel manquant se corrige, il ne se cache
 * pas derrière un emoji.
 *
 * ⚠️ PROVISOIRE — ces images viennent de Pinterest et ne sont pas sous licence
 * commerciale. Bon pour la démo, à remplacer par les photos réelles des
 * commerçants (ou une banque sous licence) avant publication sur les stores.
 */
export const PRODUCT_IMAGES: Record<string, number | undefined> = {
  d_gigot: require('../../../../assets/images/products/d_gigot.jpg'),
  d_cassoulet: require('../../../../assets/images/products/d_cassoulet.jpg'),
  d_viennoiseries: require('../../../../assets/images/products/d_viennoiseries.jpg'),
  d_legumes: require('../../../../assets/images/products/d_legumes.jpg'),
  d_pizza: require('../../../../assets/images/products/d_pizza.jpg'),
  d_fromage: require('../../../../assets/images/products/d_fromage.jpg'),
  d_fruits: require('../../../../assets/images/products/d_fruits.jpg'),
  d_brunch: require('../../../../assets/images/products/d_brunch.jpg'),
};
