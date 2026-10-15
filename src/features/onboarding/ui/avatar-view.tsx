import { Image } from 'expo-image';
import { View } from 'react-native';

import { avatarAt } from '../model/avatars';
import type { Avatar } from '../model/schema';
import { AvatarFigure } from './avatar-figure';

type Props = {
  avatar: Avatar;
  size?: number;
  /**
   * Coins arrondis. Les illustrations sont carrées avec un fond sombre : en
   * pastille (défaut) elles se posent partout, en carte elles gardent le décor.
   */
  rounded?: 'pill' | 'card';
};

/**
 * L'avatar de l'utilisateur — celui qu'il a composé (`custom`, dessiné en SVG), ou à défaut une des
 * dix illustrations de la galerie.
 *
 * Le conteneur porte le fond ET le rognage : sans fond, la fraction de seconde
 * qui précède le décodage de l'image laisserait un trou clair au milieu des
 * cartes sombres.
 */
export function AvatarView({ avatar, size = 96, rounded = 'pill' }: Props) {
  const preset = avatarAt(avatar.preset);
  const custom = avatar.custom;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={custom ? 'Avatar personnalisé' : `Avatar : ${preset.label}`}
      className="overflow-hidden bg-surface-inverse"
      style={{ width: size, height: size, borderRadius: rounded === 'pill' ? size / 2 : 18 }}
    >
      {custom ? (
        <AvatarFigure avatar={custom} size={size} />
      ) : (
        <Image
          source={preset.source}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={140}
          accessibilityIgnoresInvertColors
          alt={preset.label}
        />
      )}
    </View>
  );
}
