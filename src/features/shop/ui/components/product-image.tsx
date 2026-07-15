import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { AppText } from '@/shared/ui';

import { PRODUCT_IMAGES } from '../../model/product-images';
import type { Deal } from '../../model/schema';

type Props = {
  deal: Deal;
  /** Taille de l'emoji de repli, si le deal n'a pas encore de photo. */
  emojiSize: number;
};

/**
 * Visuel d'un produit : la photo si elle existe, sinon l'emoji sur sa tuile
 * teintée. Les deux vivent dans le même conteneur (centré, avec `deal.tint` en
 * fond) : la photo le remplit, l'emoji s'y centre.
 *
 * Le repli n'est pas un pis-aller : tant que tous les produits n'ont pas de
 * photo propre, une tuile emoji reste plus crédible qu'un trou ou une image
 * filigranée.
 */
export function ProductImage({ deal, emojiSize }: Props) {
  const source = PRODUCT_IMAGES[deal.id];

  if (source) {
    return (
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={180}
        accessibilityIgnoresInvertColors
        alt={deal.title}
      />
    );
  }

  return (
    <AppText style={{ fontSize: emojiSize, lineHeight: Math.round(emojiSize * 1.18) }}>
      {deal.emoji}
    </AppText>
  );
}
