import { View } from 'react-native';

import { cn } from '@/shared/lib/cn';
import { AppText } from '@/shared/ui';
import { useColors } from '@/shared/theme/theme-provider';

import { discountPercent } from '../../lib/price';

type Props = {
  price: number;
  oldPrice?: number;
  /**
   * Taille du prix promotionnel, en points. Tout le reste en dérive — le prix
   * barré, l'espacement, la pastille de remise.
   */
  size?: number;
  /** Alignement du bloc : à gauche (défaut) ou à droite, collé au bord. */
  align?: 'start' | 'end';
  /** Virgule décimale (« 24,90 ») au lieu du point — l'usage des fiches. */
  comma?: boolean;
  /** Masque la pastille de remise quand l'écran l'affiche déjà ailleurs. */
  hideDiscount?: boolean;
  /** Préfixe des testID : `<testID>-discount`, `<testID>-promo`, `<testID>-old`. */
  testID?: string;
};

/**
 * LE PRIX D'UNE VENTE FLASH — un seul endroit pour tous les écrans.
 *
 * Demande de la conduite de projet (11/08) : « mets le prix plus visible, le
 * prix barré plus visible aussi ; il faut vraiment attirer l'attention sur la
 * promotion ». Trois écrans affichaient ce couple de prix chacun à sa façon ;
 * d'où ce composant partagé : la prochaine demande sur le prix se traite ici,
 * une fois.
 *
 * Demande du client (réunion de design) : le prix d'origine est en ROUGE,
 * barré, et le prix remisé en VERT — « le rouge et le vert signalent l'accès ».
 * Et la remise « −NN % » n'encombre plus la ligne du prix : c'est une petite
 * pastille AU-DESSUS, sur sa propre ligne.
 *
 * Les couleurs passent par les classes `text-success` / `text-danger`, donc par
 * les jetons de thème : elles suivent le mode Jour / Nuit sans qu'aucun écran
 * n'ait à y penser.
 */
export function PriceTag({
  price,
  oldPrice,
  size = 30,
  align = 'start',
  comma = false,
  hideDiscount = false,
  testID = 'price-tag',
}: Props) {
  const colors = useColors();
  const showOld = typeof oldPrice === 'number' && oldPrice > price;
  const pct = hideDiscount ? null : discountPercent(price, oldPrice);
  const fmt = (n: number) => (comma ? n.toFixed(2).replace('.', ',') : n.toFixed(2));

  return (
    <View className={cn('gap-1', align === 'end' ? 'items-end' : 'items-start')}>
      {/* La remise AVANT le prix dans l'arbre : une rangée à part, au-dessus. */}
      {pct ? (
        <View
          testID={`${testID}-discount`}
          accessible
          accessibilityLabel={`Remise de ${pct} pour cent`}
          className="rounded-control bg-brand-500 px-2 py-0.5"
        >
          <AppText
            className="font-sans-bold text-ink-inverse"
            style={{ fontSize: Math.max(10, size * 0.34) }}
          >
            −{pct} %
          </AppText>
        </View>
      ) : null}

      <View className="flex-row items-baseline" style={{ gap: size * 0.22 }}>
        <AppText
          testID={`${testID}-promo`}
          className="font-display text-success"
          style={{
            fontSize: size,
            lineHeight: size * 1.26,
            fontVariant: ['tabular-nums'],
          }}
        >
          {fmt(price)}€
        </AppText>

        {showOld ? (
          <AppText
            testID={`${testID}-old`}
            className="font-sans-semibold text-danger line-through"
            style={{
              fontSize: Math.max(11, size * 0.56),
              lineHeight: Math.max(14, size * 0.78),
              // Le trait reprend la couleur du texte : barrer en gris sur du
              // gris revient à ne pas barrer du tout.
              textDecorationColor: colors.danger,
              fontVariant: ['tabular-nums'],
            }}
          >
            {fmt(oldPrice)}€
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
