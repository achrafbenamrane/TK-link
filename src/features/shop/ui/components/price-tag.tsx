import { View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

type Props = {
  price: number;
  oldPrice?: number;
  /**
   * Taille du prix promotionnel, en points. Tout le reste en dérive — le prix
   * barré, l'espacement, l'épaisseur du trait.
   */
  size?: number;
};

/**
 * LE PRIX D'UNE VENTE FLASH — un seul endroit pour tous les écrans.
 *
 * Demande de la conduite de projet (11/08) : « mets le prix plus visible,
 * style en rouge ou plus gros, le prix barré plus visible aussi ; il faut
 * vraiment attirer l'attention sur la promotion ».
 *
 * Trois écrans affichaient ce couple de prix chacun à sa façon (accueil,
 * favoris, rail de déstockage). Les retoucher un par un les aurait fait
 * diverger au premier ajustement suivant — d'où ce composant partagé : la
 * prochaine demande sur le prix se traite ici, une fois.
 *
 * Le prix promotionnel est en ROUGE, la couleur de la promotion dans tout le
 * commerce. Le prix barré ne s'efface plus dans le gris clair : il monte en
 * `ink-muted` et son trait est rouge lui aussi — c'est le contraste entre les
 * deux qui porte la remise, pas le prix seul.
 */
export function PriceTag({ price, oldPrice, size = 30 }: Props) {
  const showOld = typeof oldPrice === 'number' && oldPrice > price;

  return (
    <View className="flex-row items-baseline" style={{ gap: size * 0.22 }}>
      <AppText
        className="font-display"
        style={{
          color: colors.danger,
          fontSize: size,
          lineHeight: size * 1.26,
          fontVariant: ['tabular-nums'],
        }}
      >
        {price.toFixed(2)}€
      </AppText>

      {showOld ? (
        <AppText
          className="font-sans-semibold text-ink-muted line-through"
          style={{
            fontSize: size * 0.56,
            lineHeight: size * 0.78,
            // Le trait reprend le rouge : barrer en gris sur du gris revient à
            // ne pas barrer du tout.
            textDecorationColor: colors.danger,
            fontVariant: ['tabular-nums'],
          }}
        >
          {oldPrice.toFixed(2)}€
        </AppText>
      ) : null}
    </View>
  );
}
