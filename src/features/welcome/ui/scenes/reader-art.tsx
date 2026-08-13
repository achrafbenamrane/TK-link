import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { colors } from '@/shared/theme/colors';

/**
 * LE LECTEUR, peint — la géométrie exacte de la scène du site.
 *
 * L'app le montrait jusqu'ici en trois dimensions calculées : un pavé arrondi
 * extrudé, éclairé par deux lampes. Le volume était juste, la MATIÈRE ne l'était
 * pas — un boîtier plastique sous lumière rasante ne ressemble pas à un cube
 * gris. Et cette 3D exigeait expo-gl, un module natif : quand il ne démarrait
 * pas, l'écran d'accueil retombait sur deux rectangles.
 *
 * Le site avait déjà résolu le problème, et l'avait résolu autrement : la
 * géométrie est PEINTE. Le dessus est un trapèze — la perspective resserre
 * l'arête arrière — et le corps descend sous l'arête avant. Ce sont les
 * dégradés qui font le volume, comme sur un visuel produit. Les tracés
 * ci-dessous sont ceux de `landing/app/scan-scene.jsx`, au point près : les
 * deux surfaces doivent montrer le même objet.
 *
 * Aucune dépendance native. Ce dessin s'affiche toujours, partout.
 */

/** Sommets du dessus : arrière resserré, avant élargi. */
const TOP =
  'M132,72 L308,72 Q328,72 336.2,90.2 L373.8,173.8 Q382,192 362,192 ' +
  'L78,192 Q58,192 66.2,173.8 L103.8,90.2 Q112,72 132,72 Z';

/** Silhouette complète : le dessus, prolongé de 34 px sous l'arête avant. */
const BODY =
  'M132,72 L308,72 Q328,72 336.2,90.2 L373.8,173.8 Q382,192 382,206 ' +
  'L382,210 Q382,226 366,226 L74,226 Q58,226 58,210 L58,206 ' +
  'Q58,192 66.2,173.8 L103.8,90.2 Q112,72 132,72 Z';

/**
 * Le sigle imprimé sur le dessus, aplati pour suivre le plan du dessus.
 *
 * Le mot est du TEXTE, pas un tracé : les polices de la marque sont déjà
 * chargées par `expo-font`, et react-native-svg sait les résoudre par leur nom
 * d'enregistrement. C'est aussi le choix du site — un sigle tracé à la main
 * dérive du logo dès qu'on regarde de près.
 *
 * Redessiné ici plutôt que réutilisé depuis `tk-mark.tsx` : ce dernier compose
 * du texte React Native, qui ne peut ni entrer dans un `<Svg>` ni se laisser
 * écraser par une matrice de perspective.
 *
 * Coordonnées reprises telles quelles du site (viewBox 0 0 148 96).
 */
function PrintedMark() {
  return (
    <G transform="translate(96,120) scale(0.85,0.56)">
      <SvgText
        x={0}
        y={54}
        fontFamily="Unbounded_800ExtraBold"
        fontSize={54}
        letterSpacing={-3}
        fill="#14170f"
      >
        TK
      </SvgText>

      {/* Les trois ondes du sans-contact, après le K. */}
      <G stroke="#6ea82f" strokeWidth={7} strokeLinecap="round" fill="none">
        <Path d="M92 24a24 24 0 0 1 0 26" />
        <Path d="M104 15a40 40 0 0 1 0 44" opacity={0.75} />
        <Path d="M116 6a56 56 0 0 1 0 62" opacity={0.45} />
      </G>

      <SvgText
        x={3}
        y={84}
        fontFamily="Manrope_500Medium"
        fontSize={21}
        letterSpacing={9}
        fill="#14170f"
      >
        LINK
      </SvgText>
    </G>
  );
}

/** L'arbre : le ticket papier qui disparaît, d'où le vert. */
function PrintedTree() {
  return (
    <G transform="translate(258,74) scale(0.87,0.57)">
      {/* Le trait de signal qui arrive de la gauche. */}
      <Path
        d="M0 96h22l7-11 6 20 7-24 6 15h10"
        stroke="#6ea82f"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
        fill="none"
      />
      <Path
        d="M66 100V52M66 66l-13-13M66 74l13-13M66 58l-8-9M66 62l9-10"
        stroke="#6ea82f"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <G fill="#6ea82f">
        <Ellipse cx={66} cy={30} rx={15} ry={12} opacity={0.9} />
        <Ellipse cx={48} cy={44} rx={12} ry={9} opacity={0.75} />
        <Ellipse cx={85} cy={44} rx={12} ry={9} opacity={0.75} />
        <Ellipse cx={56} cy={20} rx={9} ry={7} opacity={0.6} />
        <Ellipse cx={78} cy={19} rx={9} ry={7} opacity={0.6} />
        <Ellipse cx={38} cy={33} rx={6} ry={5} opacity={0.45} />
        <Ellipse cx={95} cy={32} rx={6} ry={5} opacity={0.45} />
      </G>
    </G>
  );
}

/**
 * Le lecteur seul, sans la carte ni les ondes — celles-ci s'animent par-dessus
 * et vivent donc dans le composant parent.
 */
export function ReaderArt({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 440 300" fill="none">
      <Defs>
        {/* Coque : lumière rasante venue du haut-gauche. */}
        <LinearGradient id="tkTop" x1="0.1" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.45" stopColor="#f8faf5" />
          <Stop offset="1" stopColor="#e4e8dd" />
        </LinearGradient>
        {/* Socle : plus sombre en descendant, avec un rebond de lumière en bas. */}
        <LinearGradient id="tkBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#e9ece2" />
          <Stop offset="0.42" stopColor="#c2c8b9" />
          <Stop offset="0.86" stopColor="#98a08e" />
          <Stop offset="1" stopColor="#aab19f" />
        </LinearGradient>
        {/* Reflet doux sur le dessus. */}
        <LinearGradient id="tkGloss" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="tkPort" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#15180f" />
          <Stop offset="1" stopColor="#3b4034" />
        </LinearGradient>
        <RadialGradient id="tkShadow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#04180b" stopOpacity="0.5" />
          <Stop offset="0.6" stopColor="#04180b" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#04180b" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="tkTopClip">
          <Path d={TOP} />
        </ClipPath>
      </Defs>

      {/* Ombre portée. Deux ellipses superposées plutôt qu'un flou gaussien :
          les filtres SVG restent inégalement gérés selon les appareils Android,
          et une ombre qui disparaît se remarque plus qu'une ombre approximative. */}
      <Ellipse cx={222} cy={236} rx={185} ry={34} fill="url(#tkShadow)" />
      <Ellipse cx={222} cy={230} rx={150} ry={17} fill="#04180b" opacity={0.18} />
      <Ellipse cx={222} cy={228} rx={118} ry={11} fill="#04180b" opacity={0.16} />

      {/* Corps */}
      <Path d={BODY} fill="url(#tkBody)" />
      {/* Arête vive entre le socle et la coque */}
      <Path
        d="M66.2,173.8 Q58,192 58,206 L58,210 Q58,226 74,226 L366,226 Q382,226 382,210 L382,206 Q382,192 373.8,173.8"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.28}
        strokeWidth={1.2}
      />

      {/* Port USB-C, centré sur la face avant */}
      <Rect x={200} y={203} width={44} height={13} rx={6.5} fill="url(#tkPort)" />
      <Rect x={200} y={203} width={44} height={2} rx={1} fill="#ffffff" opacity={0.22} />

      {/* Dessus */}
      <Path d={TOP} fill="url(#tkTop)" />
      {/* Liseré clair sur l'arête haute : ce qui « allume » le bord */}
      <Path
        d="M132,72 L308,72 Q328,72 336.2,90.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.6}
        strokeOpacity={0.9}
      />

      <G clipPath="url(#tkTopClip)">
        {/* Reflet en écharpe */}
        <Path d="M40,60 L240,60 L120,210 L-10,210 Z" fill="url(#tkGloss)" />
        <PrintedMark />
        <PrintedTree />
      </G>

      {/* Témoin lumineux */}
      <Ellipse cx={102} cy={112} rx={5} ry={4} fill={colors.lime} opacity={0.95} />
    </Svg>
  );
}
