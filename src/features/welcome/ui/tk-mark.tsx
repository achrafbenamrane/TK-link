import { View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

/**
 * La marque TK LINK — le sigle, les ondes du sans-contact, l'arbre.
 *
 * Le mot est du TEXTE (police Unbounded déjà chargée), pas un tracé : il reste
 * net à toute taille, se lit par les lecteurs d'écran, et suit automatiquement
 * la typographie de la marque si elle change. Seuls les ondes et l'arbre sont
 * dessinés — eux n'existent dans aucune police.
 *
 * Repris de la scène du site (landing/app/scan-scene.jsx) pour que l'app et le
 * site racontent la même chose avec le même dessin.
 */

type Props = {
  /** Hauteur du sigle, en px. Tout le reste en dérive. */
  size?: number;
  tone?: string;
  wave?: string;
};

/** Les trois ondes du sans-contact, après le K. */
export function TkWaves({ size = 22, color = colors.lime }: { size?: number; color?: string }) {
  return (
    <Svg width={size * 0.75} height={size} viewBox="0 0 36 72" fill="none">
      <G stroke={color} strokeWidth={7} strokeLinecap="round" fill="none">
        <Path d="M4 22a24 24 0 0 1 0 28" />
        <Path d="M16 12a40 40 0 0 1 0 48" opacity={0.75} />
        <Path d="M28 3a56 56 0 0 1 0 66" opacity={0.45} />
      </G>
    </Svg>
  );
}

/**
 * L'arbre de la marque — le ticket papier qui disparaît, d'où le vert. Des
 * touches de feuillage plutôt qu'une masse pleine : à 40 px, une masse pleine
 * devient une tache.
 */
export function TkTree({ size = 96, color = colors.lime }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Path
        d="M66 100V52M66 66l-13-13M66 74l13-13M66 58l-8-9M66 62l9-10"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <G fill={color}>
        <Ellipse cx={66} cy={30} rx={15} ry={12} opacity={0.9} />
        <Ellipse cx={48} cy={44} rx={12} ry={9} opacity={0.75} />
        <Ellipse cx={85} cy={44} rx={12} ry={9} opacity={0.75} />
        <Ellipse cx={56} cy={20} rx={9} ry={7} opacity={0.6} />
        <Ellipse cx={78} cy={19} rx={9} ry={7} opacity={0.6} />
        <Ellipse cx={38} cy={33} rx={6} ry={5} opacity={0.45} />
        <Ellipse cx={95} cy={32} rx={6} ry={5} opacity={0.45} />
      </G>
    </Svg>
  );
}

/** Le sigle complet : TK + ondes, LINK dessous. */
export function TkMark({ size = 28, tone = colors.inkInverse, wave = colors.lime }: Props) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="TK LINK">
      <View className="flex-row items-center" style={{ gap: size * 0.14 }}>
        <AppText
          className="font-display-x"
          style={{
            color: tone,
            fontSize: size,
            lineHeight: size * 1.25,
            letterSpacing: -size * 0.04,
          }}
        >
          TK
        </AppText>
        <TkWaves size={size * 0.82} color={wave} />
      </View>
      <AppText
        className="font-sans-medium"
        style={{
          color: tone,
          fontSize: size * 0.36,
          letterSpacing: size * 0.3,
          marginTop: -size * 0.12,
        }}
      >
        LINK
      </AppText>
    </View>
  );
}
