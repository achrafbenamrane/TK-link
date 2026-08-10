import type { PublishedOffer } from './schema';

/**
 * Trois lots de grossistes, pour que le marché B2B ne s'ouvre pas sur le vide.
 *
 * ⚠️ DONNÉES DE DÉMONSTRATION, au même titre que le catalogue de la boutique :
 * aucun grossiste n'est encore inscrit. Le jour où le back-office existe, ces
 * lots viendront du serveur et ce fichier disparaît.
 *
 * Les horodatages sont RELATIFS au lancement : figer des dates ferait vieillir
 * la démonstration, et tous les lots apparaîtraient expirés au bout d'un jour.
 */
export function seedWholesaleLots(nowMs: number = Date.now()): PublishedOffer[] {
  return [
    {
      id: 'lot_cafe',
      title: 'Café en grains — 12 kg',
      category: 'restauration',
      priceCents: 8400,
      oldPriceCents: 12600,
      stock: 20,
      stockLeft: 14,
      durationMinutes: 2880,
      description: 'Palette fin de série, torréfaction de janvier. Retrait à Fenouillet.',
      publishedAt: nowMs - 3 * 3600_000,
      offline: false,
      audience: 'commercants',
      seller: 'Grossiste Occitan',
    },
    {
      id: 'lot_gobelets',
      title: 'Gobelets compostables — 2 000 pièces',
      category: 'services',
      priceCents: 5900,
      oldPriceCents: 8900,
      stock: 12,
      stockLeft: 9,
      durationMinutes: 4320,
      description: 'Norme NF T51-800. Carton de 500, vendu par lot de quatre.',
      publishedAt: nowMs - 7 * 3600_000,
      offline: false,
      audience: 'commercants',
      seller: 'Sud Emballage',
    },
    {
      id: 'lot_tshirts',
      title: 'T-shirts coton bio — lot de 50',
      category: 'mode',
      priceCents: 19500,
      oldPriceCents: 32500,
      stock: 8,
      stockLeft: 8,
      durationMinutes: 5760,
      description: 'Tailles S à XL assorties, blanc et écru. Fin de collection.',
      publishedAt: nowMs - 20 * 3600_000,
      offline: false,
      audience: 'commercants',
      seller: 'Textile Garonne',
    },
  ];
}
