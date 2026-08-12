/**
 * Visuels produits, embarqués dans l'app (donc affichés hors ligne, sans
 * dépendre d'un CDN pendant une démo client).
 *
 * `require` n'accepte que des chemins littéraux : Metro résout les assets à la
 * compilation, une clé dynamique ne marcherait pas. D'où cette table écrite à
 * la main plutôt qu'un `require(`...${id}.jpg`)`.
 *
 * Toutes les offres du catalogue ont un visuel. Le repli emoji de
 * `ProductImage` reste par sécurité — une offre publiée depuis l'app n'a pas
 * encore de photo — mais aucune offre du catalogue ne doit s'y trouver : un
 * visuel manquant se corrige, il ne se cache pas derrière un emoji.
 *
 * ⚠️ DEUX PROVENANCES, DEUX RISQUES DIFFÉRENTS — détail dans
 * `assets/images/products/CREDITS.md` :
 *
 * - les huit premières (alimentaire) viennent de Pinterest : droits de tiers,
 *   bonnes pour une démonstration, **à remplacer avant publication** ;
 * - les treize suivantes sont en domaine public (CC0), trouvées via Openverse :
 *   usage commercial autorisé, aucune attribution due.
 *
 * Toutes restent des bouche-trous : le CDC §3.2 et §18 prévoient que le
 * commerçant fournisse sa propre photo.
 */
/**
 * Offres publiées SANS photo, en connaissance de cause.
 *
 * **La liste est vide — toutes les offres ont leur visuel.** Le mécanisme
 * reste, parce que c'est lui qui empêche la dette de revenir en silence : le
 * test d'intégrité refuse toute offre sans image ET non déclarée ici, refuse
 * un identifiant inconnu, et refuse qu'un identifiant y reste une fois sa
 * photo arrivée.
 *
 * Ajouter une offre sans visuel oblige donc à l'inscrire ici, c'est-à-dire à
 * l'assumer par écrit. C'était le but.
 */
export const AWAITING_PHOTO = new Set<string>([]);

export const PRODUCT_IMAGES: Record<string, number | undefined> = {
  d_cote: require('../../../../assets/images/products/d_cote.jpg'),
  d_cassoulet: require('../../../../assets/images/products/d_cassoulet.jpg'),
  d_viennoiseries: require('../../../../assets/images/products/d_viennoiseries.jpg'),
  d_legumes: require('../../../../assets/images/products/d_legumes.jpg'),
  d_pizza: require('../../../../assets/images/products/d_pizza.jpg'),
  d_fromage: require('../../../../assets/images/products/d_fromage.jpg'),
  d_fruits: require('../../../../assets/images/products/d_fruits.jpg'),
  d_brunch: require('../../../../assets/images/products/d_brunch.jpg'),
  // Sorties et loisirs — domaine public (voir CREDITS.md).
  d_cinema: require('../../../../assets/images/products/d_cinema.jpg'),
  d_cine_duo: require('../../../../assets/images/products/d_cine_duo.jpg'),
  d_cine_vost: require('../../../../assets/images/products/d_cine_vost.jpg'),
  d_cine_tardif: require('../../../../assets/images/products/d_cine_tardif.jpg'),
  d_bowling: require('../../../../assets/images/products/d_bowling.jpg'),
  d_poterie: require('../../../../assets/images/products/d_poterie.jpg'),
  // Les six autres catégories du CDC §4.
  d_casque: require('../../../../assets/images/products/d_casque.jpg'),
  d_tablette: require('../../../../assets/images/products/d_tablette.jpg'),
  d_lampe: require('../../../../assets/images/products/d_lampe.jpg'),
  d_veste: require('../../../../assets/images/products/d_veste.jpg'),
  d_soin: require('../../../../assets/images/products/d_soin.jpg'),
  d_padel: require('../../../../assets/images/products/d_padel.jpg'),
  d_revision: require('../../../../assets/images/products/d_revision.jpg'),
};
