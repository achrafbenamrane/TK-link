import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { avatarColors } from '../lib/avatar';
import type { Avatar } from '../model/schema';

/**
 * L'avatar, dessiné. Trois entiers suffisent à le décrire, donc il se stocke,
 * se transmet et se redessine à n'importe quelle taille sans jamais pixeliser.
 */
export function AvatarView({ avatar, size = 96 }: { avatar: Avatar; size?: number }) {
  const { bg, fg } = avatarColors(avatar);
  const c = size / 2;
  const r = size / 2;

  // Yeux : la variante 1 est un clin d'œil, la 2 des yeux ronds « surpris ».
  const eyeY = c - size * 0.06;
  const eyeDx = size * 0.16;
  const eyeR = avatar.face === 2 ? size * 0.06 : size * 0.045;

  // Bouche : sourire, léger, grand ouvert, ou trait serein.
  const mouthY = c + size * 0.14;
  const mouthW = size * 0.2;
  const smile =
    avatar.face === 3
      ? `M${c - mouthW},${mouthY} L${c + mouthW},${mouthY}`
      : `M${c - mouthW},${mouthY - size * 0.02} Q${c},${mouthY + size * (avatar.face === 2 ? 0.16 : 0.1)} ${c + mouthW},${mouthY - size * 0.02}`;

  return (
    <Svg width={size} height={size} accessibilityLabel="Avatar">
      <Circle cx={c} cy={c} r={r} fill={bg} />

      {/* Visage */}
      <Circle cx={c} cy={c} r={r * 0.62} fill={fg} opacity={0.18} />

      {/* Yeux */}
      {avatar.face === 1 ? (
        <Path
          d={`M${c - eyeDx - eyeR},${eyeY} q${eyeR},${-eyeR} ${eyeR * 2},0`}
          stroke={fg}
          strokeWidth={size * 0.03}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <Circle cx={c - eyeDx} cy={eyeY} r={eyeR} fill={fg} />
      )}
      <Circle cx={c + eyeDx} cy={eyeY} r={eyeR} fill={fg} />

      {/* Bouche */}
      <Path d={smile} stroke={fg} strokeWidth={size * 0.035} strokeLinecap="round" fill="none" />

      {/* Accessoires */}
      {avatar.accessory === 1 ? (
        <>
          <Circle
            cx={c - eyeDx}
            cy={eyeY}
            r={size * 0.11}
            stroke={fg}
            strokeWidth={size * 0.025}
            fill="none"
          />
          <Circle
            cx={c + eyeDx}
            cy={eyeY}
            r={size * 0.11}
            stroke={fg}
            strokeWidth={size * 0.025}
            fill="none"
          />
          <Path
            d={`M${c - eyeDx + size * 0.11},${eyeY} L${c + eyeDx - size * 0.11},${eyeY}`}
            stroke={fg}
            strokeWidth={size * 0.025}
          />
        </>
      ) : null}

      {avatar.accessory === 2 ? (
        <>
          <Path
            d={`M${c - r * 0.62},${c - size * 0.2} a${r * 0.62},${r * 0.62} 0 0 1 ${r * 1.24},0 Z`}
            fill={fg}
          />
          <Rect
            x={c - r * 0.72}
            y={c - size * 0.22}
            width={r * 1.44}
            height={size * 0.055}
            rx={size * 0.027}
            fill={fg}
          />
        </>
      ) : null}

      {/* La feuille — clin d'œil au symbole de l'arbre TK LINK. */}
      {avatar.accessory === 3 ? (
        <>
          <Path
            d={`M${c + r * 0.34},${c - r * 0.5} q${size * 0.16},${-size * 0.14} ${size * 0.2},${size * 0.02} q${-size * 0.05},${size * 0.14} ${-size * 0.2},${-size * 0.02} Z`}
            fill={fg}
          />
          <Ellipse
            cx={c + r * 0.3}
            cy={c - r * 0.42}
            rx={size * 0.012}
            ry={size * 0.05}
            fill={fg}
            opacity={0.6}
          />
        </>
      ) : null}
    </Svg>
  );
}
