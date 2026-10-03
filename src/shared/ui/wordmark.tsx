import { View } from 'react-native';

import { AppText } from './text';

type Props = {
  /** Corps du mot, en px. Tout le reste en dérive. */
  size?: number;
  /** « TK » seul en rose, « link » dans la couleur du texte (défaut), ou tout en blanc. */
  tone?: 'default' | 'inverse';
};

/**
 * Le logotype « TKlink » — « TK » en rose, « link » en couleur de texte, en gras
 * et légèrement penché, comme sur la charte du client (03/10/2026).
 *
 * C'est du TEXTE, pas une image : il reste net à toute taille, suit le mode
 * Nuit / Jour, et se lit par les lecteurs d'écran. Le fichier du logo définitif
 * reste à fournir par le client ; ce composant en tient lieu jusque-là.
 *
 * L'inclinaison passe par une transformation et non par `fontStyle: 'italic'` :
 * Manrope n'a pas d'italique, et chaque plateforme en fabriquerait un différent.
 */
export function Wordmark({ size = 22, tone = 'default' }: Props) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="TKlink"
      style={{ transform: [{ skewX: '-9deg' }] }}
      className="flex-row items-baseline"
    >
      <AppText
        className="font-display text-brand-500"
        style={{ fontSize: size, lineHeight: size * 1.15, letterSpacing: -size * 0.03 }}
      >
        TK
      </AppText>
      <AppText
        className={tone === 'inverse' ? 'font-display text-ink-inverse' : 'font-display text-ink'}
        style={{ fontSize: size, lineHeight: size * 1.15, letterSpacing: -size * 0.03 }}
      >
        link
      </AppText>
    </View>
  );
}
