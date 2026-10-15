import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { pick, shade, swatchOf, TK_PINK } from '../lib/avatar-parts';
import type { CustomAvatar } from '../model/schema';

/** Le cadrage : tout l'avatar, la tête, le visage, ou le buste (pour juger une tenue). */
export type FigureZoom = 'full' | 'head' | 'face' | 'chest';

const VIEWBOX: Record<FigureZoom, string> = {
  full: '0 0 200 200',
  head: '30 10 140 140',
  face: '40 40 120 120',
  chest: '25 55 150 150',
};

const INK = '#1F2024';
const MOUTH = '#7A2E2E';

/** Où se pose le logo sur chaque tenue : centre, et échelle (le logo mesure 48 unités de large). */
const TOP_LOGO = [
  { x: 100, y: 183, s: 0.95 }, // T-shirt
  { x: 100, y: 186, s: 0.95 }, // col V
  { x: 100, y: 182, s: 0.9 }, // sweat
  { x: 128, y: 178, s: 0.6 }, // veste : sur la poitrine
] as const;

/** Le logo sur le couvre-chef : sur la façade, au-dessus de la visière. */
const CAP_LOGO = [
  { x: 100, y: 50, s: 0.62 }, // casquette
  { x: 100, y: 68, s: 0.62 }, // bonnet : sur le revers
  { x: 100, y: 46, s: 0.62 }, // bob
] as const;

/**
 * LE LOGO TK LINK, dessiné en traits — « TK » en rose, « link » en blanc ou en noir selon le tissu,
 * légèrement penché comme sur la charte. Des traits plutôt qu'une police : le dessin ne dépend
 * d'aucune fonte chargée, et reste net à toutes les tailles.
 *
 * Il est dessiné par CHAQUE tenue et CHAQUE couvre-chef : c'est la règle du client, pas une option.
 */
function Logo({
  x,
  y,
  scale,
  dark,
  onPink,
}: {
  x: number;
  y: number;
  scale: number;
  /** Le tissu est sombre : « link » s'écrit en blanc. */
  dark: boolean;
  /** Le tissu est le rose de la marque : « TK » passe en blanc pour ne pas disparaître. */
  onPink: boolean;
}) {
  const link = dark ? '#FFFFFF' : INK;
  const tk = onPink ? '#FFFFFF' : TK_PINK;
  return (
    <G
      testID="avatar-logo"
      transform={`translate(${x - 24 * scale} ${y - 5 * scale}) scale(${scale}) skewX(-9)`}
    >
      <Path
        d="M0 0.5 H8 M4 0.5 V10 M11 0.5 V10 M19 0.5 L11 6.2 M14.2 4.2 L19.5 10"
        stroke={tk}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M24 0 V10 M28 3.6 V10 M28 0.4 V0.5 M32 10 V3.8 M32 6 C32 1.8 39 1.8 39 6 V10 M43 0 V10 M49 3.6 L43 7.2 M45.4 6.4 L49 10"
        stroke={link}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );
}

/* ---------------- visage ---------------- */

function Head({ shape, fill }: { shape: number; fill: string }) {
  if (shape === 1) return <Ellipse cx={100} cy={90} rx={40} ry={52} fill={fill} />;
  if (shape === 2) return <Rect x={56} y={40} width={88} height={98} rx={28} fill={fill} />;
  if (shape === 3) {
    return (
      <Path
        d="M56 82 C56 54 76 40 100 40 C124 40 144 54 144 82 C144 110 124 136 100 142 C76 136 56 110 56 82Z"
        fill={fill}
      />
    );
  }
  return <Ellipse cx={100} cy={88} rx={44} ry={47} fill={fill} />;
}

function Eye({ x, type, color }: { x: number; type: number; color: string }) {
  const y = 94;
  if (type === 2) {
    return (
      <Path
        d={`M${x - 8} ${y + 3} Q${x} ${y - 9} ${x + 8} ${y + 3}`}
        stroke={INK}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  const ry = type === 1 ? 5.5 : type === 3 ? 4 : type === 4 ? 9 : 7.5;
  const rx = type === 1 || type === 4 ? 8 : 7;
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#FFFFFF" />
      <Circle cx={x} cy={y + 0.5} r={Math.min(ry - 0.5, 4.4)} fill={color} />
      <Circle cx={x} cy={y + 0.5} r={2} fill={INK} />
      <Circle cx={x + 1.6} cy={y - 1.4} r={1.1} fill="#FFFFFF" />
      {type === 3 ? (
        <Path
          d={`M${x - 8} ${y - 1} Q${x} ${y - 6} ${x + 8} ${y - 1}`}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      {type === 4 ? (
        <Path
          d={`M${x - 8} ${y - 3} L${x - 11} ${y - 7} M${x} ${y - 9} L${x} ${y - 13} M${x + 8} ${y - 3} L${x + 11} ${y - 7}`}
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : null}
    </G>
  );
}

function Brow({ x, type, color, flip }: { x: number; type: number; color: string; flip: boolean }) {
  const y = 80;
  const s = flip ? -1 : 1;
  const d =
    type === 1
      ? `M${x - 9 * s} ${y + 2} Q${x} ${y - 6} ${x + 9 * s} ${y + 2}`
      : type === 3
        ? `M${x - 9 * s} ${y - 1} Q${x} ${y - 7} ${x + 9 * s} ${y - 1}`
        : `M${x - 9 * s} ${y + 1} L${x + 9 * s} ${y - 1}`;
  return (
    <Path
      d={d}
      stroke={color}
      strokeWidth={type === 2 ? 5.4 : type === 3 ? 2 : 3.2}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Nose({ type, skin }: { type: number; skin: string }) {
  const line = shade(skin, -0.28);
  if (type === 1) return <Circle cx={100} cy={106} r={4.2} fill={shade(skin, -0.13)} />;
  if (type === 2) {
    return (
      <Path
        d="M100 92 L97 107 Q100 110 103 107"
        stroke={line}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }
  return (
    <Path
      d="M96.5 106 Q100 110 103.5 106"
      stroke={line}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Mouth({ type }: { type: number }) {
  if (type === 1) {
    return (
      <G>
        <Path d="M83 116 Q100 140 117 116 Z" fill={MOUTH} />
        <Path d="M86 116.5 Q100 123 114 116.5 L113 120 Q100 126 87 120Z" fill="#FFFFFF" />
      </G>
    );
  }
  if (type === 2) {
    return <Path d="M90 122 H110" stroke={MOUTH} strokeWidth={3.2} strokeLinecap="round" />;
  }
  if (type === 3) {
    return (
      <Path
        d="M88 123 Q102 126 113 116"
        stroke={MOUTH}
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (type === 4) return <Ellipse cx={100} cy={123} rx={6} ry={8} fill={MOUTH} />;
  return (
    <Path
      d="M86 118 Q100 134 114 118"
      stroke={MOUTH}
      strokeWidth={3.2}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Beard({ type, color }: { type: number; color: string }) {
  const moustache = 'M84 112 Q92 105 100 110 Q108 105 116 112 Q108 116 100 114 Q92 116 84 112Z';
  const jaw =
    'M55 90 C55 132 76 150 100 150 C124 150 145 132 145 90 C140 114 128 124 100 124 C72 124 60 114 55 90Z';
  if (type === 1) return <Path d={moustache} fill={color} />;
  if (type === 2) {
    return (
      <G fill={color}>
        <Path d={moustache} />
        <Path d="M89 130 Q100 146 111 130 Q100 136 89 130Z" />
      </G>
    );
  }
  if (type === 3) {
    return (
      <G fill={color}>
        <Path d={jaw} />
        <Path d={moustache} />
      </G>
    );
  }
  if (type === 4) return <Path d={jaw} fill={color} opacity={0.28} />;
  return null;
}

function Glasses({ type }: { type: number }) {
  if (type === 0) return null;
  const sun = type === 3;
  const stroke = { stroke: INK, strokeWidth: 3, fill: 'none' } as const;
  return (
    <G>
      {type === 1 ? (
        <>
          <Circle cx={82} cy={94} r={14} {...stroke} />
          <Circle cx={118} cy={94} r={14} {...stroke} />
        </>
      ) : (
        <>
          <Rect
            x={68}
            y={83}
            width={28}
            height={22}
            rx={sun ? 8 : 5}
            fill={sun ? INK : 'none'}
            opacity={sun ? 0.88 : 1}
            stroke={INK}
            strokeWidth={3}
          />
          <Rect
            x={104}
            y={83}
            width={28}
            height={22}
            rx={sun ? 8 : 5}
            fill={sun ? INK : 'none'}
            opacity={sun ? 0.88 : 1}
            stroke={INK}
            strokeWidth={3}
          />
        </>
      )}
      <Path d="M96 93 Q100 90 104 93" stroke={INK} strokeWidth={3} fill="none" />
      <Path
        d="M54 92 L68 94 M146 92 L132 94"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </G>
  );
}

/* ---------------- cheveux ---------------- */

const HAIR_FRONT: Record<number, string> = {
  1: 'M53 82 C50 46 74 32 100 32 C128 32 150 46 147 82 C141 64 128 55 100 55 C74 55 62 64 53 82Z',
  2: 'M56 78 C56 50 76 40 100 40 C124 40 144 50 144 78 C136 62 124 54 100 54 C76 54 64 62 56 78Z',
  3: 'M53 82 C50 46 74 32 100 32 C128 32 150 46 147 82 C141 64 128 55 100 55 C74 55 62 64 53 82Z',
  4: 'M53 82 C50 46 74 32 100 32 C128 32 150 46 147 82 C141 64 128 55 100 55 C74 55 62 64 53 82Z',
  5: 'M53 82 C50 46 74 32 100 32 C128 32 150 46 147 82 C141 64 128 55 100 55 C74 55 62 64 53 82Z',
  6: 'M50 84 C42 44 76 24 110 28 C138 31 152 52 147 84 C143 66 132 52 114 49 C92 49 66 56 50 84Z',
  7: 'M53 78 C53 50 76 38 100 38 C124 38 147 50 147 78 C130 67 120 63 100 63 C80 63 70 67 53 78Z',
  8: 'M53 82 C50 46 74 32 100 32 C128 32 150 46 147 82 C141 64 128 55 100 55 C74 55 62 64 53 82Z',
};

/** Ce qui se dessine DERRIÈRE la tête : mèches longues, boucles, chignon, queue de cheval. */
function HairBack({ type, color }: { type: number; color: string }) {
  if (type === 3) {
    return (
      <G fill={color}>
        <Circle cx={58} cy={62} r={19} />
        <Circle cx={78} cy={44} r={21} />
        <Circle cx={100} cy={38} r={23} />
        <Circle cx={122} cy={44} r={21} />
        <Circle cx={142} cy={62} r={19} />
        <Circle cx={52} cy={84} r={13} />
        <Circle cx={148} cy={84} r={13} />
      </G>
    );
  }
  if (type === 4) {
    return (
      <Path
        d="M48 84 C46 44 74 28 100 28 C128 28 154 44 152 84 L154 148 L134 148 L134 96 L66 96 L66 148 L46 148Z"
        fill={color}
      />
    );
  }
  if (type === 5) return <Circle cx={100} cy={26} r={17} fill={color} />;
  if (type === 7) {
    return (
      <Path
        d="M48 84 C46 46 74 30 100 30 C128 30 154 46 152 84 L150 128 C150 136 138 136 134 128 L134 92 L66 92 L66 128 C62 136 50 136 50 128Z"
        fill={color}
      />
    );
  }
  if (type === 8) {
    return (
      <Path
        d="M140 58 C172 54 186 90 170 128 C166 138 154 132 158 120 C164 98 158 82 144 76Z"
        fill={color}
      />
    );
  }
  return null;
}

function HairFront({ type, color }: { type: number; color: string }) {
  const d = HAIR_FRONT[type];
  if (!d) return null;
  return <Path d={d} fill={color} opacity={type === 2 ? 0.82 : 1} />;
}

/* ---------------- tenue ---------------- */

function Outfit({ type, fill, skin }: { type: number; fill: string; skin: string }) {
  const rim = shade(fill, -0.22);
  const body = 'M18 200 C18 166 54 148 86 146 L114 146 C146 148 182 166 182 200 Z';
  return (
    <G>
      <Path d={body} fill={fill} />
      {type === 0 ? (
        <>
          <Path d="M82 146 Q100 168 118 146Z" fill={skin} />
          <Path d="M82 146 Q100 168 118 146" stroke={rim} strokeWidth={4} fill="none" />
        </>
      ) : null}
      {type === 1 ? (
        <>
          <Path d="M84 146 L100 174 L116 146Z" fill={skin} />
          <Path
            d="M84 146 L100 174 L116 146"
            stroke={rim}
            strokeWidth={4}
            fill="none"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {type === 2 ? (
        <>
          <Path d="M80 146 Q100 166 120 146Z" fill={skin} />
          <Path d="M80 146 Q100 166 120 146" stroke={rim} strokeWidth={5} fill="none" />
          <Path
            d="M92 160 V176 M108 160 V176"
            stroke="#FFFFFF"
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Path d="M64 192 H136 L130 200 H70Z" fill={rim} opacity={0.55} />
        </>
      ) : null}
      {type === 3 ? (
        <>
          <Path d="M86 146 L100 178 L114 146Z" fill="#F3F4F6" />
          <Path d="M86 146 L100 178 L114 146" stroke="#D1D5DB" strokeWidth={2} fill="none" />
          <Path d="M100 178 V200" stroke={rim} strokeWidth={3} />
          <Path
            d="M82 146 L96 172 M118 146 L104 172"
            stroke={rim}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </G>
  );
}

/** La capuche du sweat : elle s'accroche DERRIÈRE le cou, donc se dessine avant le corps. */
function Hood({ fill }: { fill: string }) {
  return (
    <Path d="M62 152 C56 118 76 110 100 110 C124 110 144 118 138 152Z" fill={shade(fill, -0.18)} />
  );
}

/* ---------------- couvre-chef ---------------- */

function Headwear({
  type,
  fill,
  dark,
  onPink,
}: {
  type: number;
  fill: string;
  dark: boolean;
  onPink: boolean;
}) {
  if (type === 0) return null;
  const rim = shade(fill, -0.2);
  const logo = CAP_LOGO[type - 1] ?? CAP_LOGO[0];
  return (
    <G>
      {type === 1 ? (
        <>
          <Path
            d="M53 72 C52 38 76 24 100 24 C124 24 148 38 147 72 C124 77 76 77 53 72Z"
            fill={fill}
          />
          <Path d="M100 24 V74" stroke={rim} strokeWidth={1.4} opacity={0.5} />
          <Circle cx={100} cy={24.5} r={3.4} fill={rim} />
          <Path
            d="M52 70 C78 77 122 77 148 70 C151 77 132 82 100 82 C68 82 49 77 52 70Z"
            fill={rim}
          />
        </>
      ) : null}
      {type === 2 ? (
        <>
          <Path d="M51 68 C50 30 76 14 100 14 C124 14 150 30 149 68Z" fill={fill} />
          <Rect x={48} y={58} width={104} height={22} rx={9} fill={rim} />
          <Circle cx={100} cy={14.5} r={5} fill={rim} />
        </>
      ) : null}
      {type === 3 ? (
        <>
          <Path d="M58 68 C58 36 78 26 100 26 C122 26 142 36 142 68Z" fill={fill} />
          <Path
            d="M32 70 C58 62 142 62 168 70 C168 79 140 77 100 77 C60 77 32 79 32 70Z"
            fill={rim}
          />
        </>
      ) : null}
      <Logo x={logo.x} y={logo.y} scale={logo.s} dark={dark} onPink={onPink} />
    </G>
  );
}

/* ---------------- l'avatar ---------------- */

type Props = {
  avatar: CustomAvatar;
  size: number;
  zoom?: FigureZoom;
};

/**
 * L'AVATAR PERSONNALISÉ, dessiné en SVG par couches — comme un Bitmoji : le fond, ce qui est
 * derrière la tête (capuche, chignon…), le cou et la tenue, la tête et ses détails, puis les
 * cheveux et le couvre-chef par-dessus.
 *
 * Aucune image : tout est calculé à partir de quelques entiers (`CustomAvatar`), donc l'avatar
 * pèse quelques octets et reste net à toute taille. Le logo TK LINK est dessiné par la tenue et par
 * le couvre-chef eux-mêmes : on ne peut pas les porter sans lui.
 */
export function AvatarFigure({ avatar, size, zoom = 'full' }: Props) {
  const skin = swatchOf(avatar, 'skin').hex;
  const hair = swatchOf(avatar, 'hairColor').hex;
  const eye = swatchOf(avatar, 'eyeColor').hex;
  const top = swatchOf(avatar, 'topColor');
  const cap = swatchOf(avatar, 'capColor');
  const bg = swatchOf(avatar, 'bg');

  const topType = pick(avatar, 'top');
  const capType = pick(avatar, 'cap');
  const hairType = pick(avatar, 'hair');
  const brow = shade(hair, -0.3);
  const skinShadow = shade(skin, -0.14);
  const logo = TOP_LOGO[topType] ?? TOP_LOGO[0];

  const layers: ReactNode[] = [
    <Rect key="bg" x={-60} y={-60} width={320} height={320} fill={bg.hex} />,
    topType === 2 ? <Hood key="hood" fill={top.hex} /> : null,
    <HairBack key="hair-back" type={hairType} color={hair} />,
    <Rect key="neck" x={85} y={118} width={30} height={34} fill={skinShadow} />,
    <Outfit key="outfit" type={topType} fill={top.hex} skin={skinShadow} />,
    <Logo
      key="top-logo"
      x={logo.x}
      y={logo.y}
      scale={logo.s}
      dark={!!top.dark}
      onPink={top.hex === TK_PINK}
    />,
    <Circle key="ear-l" cx={58} cy={94} r={9} fill={skin} />,
    <Circle key="ear-r" cx={142} cy={94} r={9} fill={skin} />,
    <Head key="head" shape={pick(avatar, 'face')} fill={skin} />,
    pick(avatar, 'freckles') === 1 ? (
      <G key="freckles" fill={shade(skin, -0.3)}>
        <Circle cx={76} cy={106} r={1.5} />
        <Circle cx={83} cy={109} r={1.5} />
        <Circle cx={90} cy={106} r={1.5} />
        <Circle cx={110} cy={106} r={1.5} />
        <Circle cx={117} cy={109} r={1.5} />
        <Circle cx={124} cy={106} r={1.5} />
      </G>
    ) : null,
    <Beard key="beard" type={pick(avatar, 'beard')} color={hair} />,
    <Nose key="nose" type={pick(avatar, 'nose')} skin={skin} />,
    <Mouth key="mouth" type={pick(avatar, 'mouth')} />,
    <Eye key="eye-l" x={82} type={pick(avatar, 'eyes')} color={eye} />,
    <Eye key="eye-r" x={118} type={pick(avatar, 'eyes')} color={eye} />,
    <Brow key="brow-l" x={82} type={pick(avatar, 'brows')} color={brow} flip={false} />,
    <Brow key="brow-r" x={118} type={pick(avatar, 'brows')} color={brow} flip />,
    <Glasses key="glasses" type={pick(avatar, 'glasses')} />,
    <HairFront key="hair-front" type={hairType} color={hair} />,
    <Headwear
      key="headwear"
      type={capType}
      fill={cap.hex}
      dark={!!cap.dark}
      onPink={cap.hex === TK_PINK}
    />,
  ];

  return (
    <Svg width={size} height={size} viewBox={VIEWBOX[zoom]}>
      {layers}
    </Svg>
  );
}
