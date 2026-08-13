import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { TkMark } from '../tk-mark';
import { ReaderArt } from './reader-art';

/** Un tour complet : approche, contact, échange, retrait. */
const CYCLE = 5200;

/** Les instants clés, en fraction du cycle. */
const CONTACT = 0.3;
const LIFT = 0.62;

type Props = { size?: number; still?: boolean };

/**
 * LE GESTE DU PRODUIT : la carte s'approche du lecteur, touche, les ondes
 * partent, le ticket arrive dans l'app.
 *
 * Sans ce plan, TK LINK reste une idée abstraite — « passez votre carte » ne
 * veut rien dire tant qu'on ne l'a pas vu.
 *
 * Le lecteur est le dessin du site, au tracé près ([`reader-art.tsx`]) : la
 * version précédente calculait un vrai volume avec three.js, mais un pavé
 * arrondi éclairé par deux lampes ne ressemble pas à un boîtier plastique — et
 * elle dépendait d'expo-gl, un module natif qui, lorsqu'il ne démarrait pas,
 * laissait l'écran d'accueil sur deux rectangles gris. Ici tout est peint, donc
 * tout s'affiche, partout.
 *
 * `still` (l'utilisateur a demandé moins d'animations) fige la scène à
 * l'instant du contact : le moment le plus parlant des cinq secondes.
 */
export function CardReaderScene({ size = 300, still = false }: Props) {
  const progress = useSharedValue(still ? CONTACT : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, still]);

  return (
    <View
      testID="welcome-card-scene"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Une carte TK LINK est présentée au lecteur : le ticket arrive dans l’application."
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      {/* Le ticket sort par la droite une fois l'échange fait. */}
      <Ticket progress={progress} size={size} />

      {/* Les ondes du sans-contact, décalées pour donner une pulsation. */}
      <Ping progress={progress} size={size} delay={0} />
      <Ping progress={progress} size={size} delay={0.05} />
      <Ping progress={progress} size={size} delay={0.1} />

      <Card progress={progress} size={size} />

      <View style={{ position: 'absolute', bottom: size * 0.06 }}>
        <ReaderArt width={size * 0.94} height={size * 0.64} />
      </View>
    </View>
  );
}

/**
 * La carte : elle descend en se redressant, touche, reste posée le temps de
 * l'échange, puis repart.
 *
 * L'inclinaison compte autant que la trajectoire — une carte qui descend à
 * plat ressemble à un ascenseur ; une carte qui s'incline en approchant
 * ressemble à une main.
 */
function Card({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Trois segments, décrits par leurs points de passage. `interpolate`
    // s'occupe des transitions : une seule table à relire, pas trois branches.
    const y = interpolate(
      p,
      [0, CONTACT, LIFT, 1],
      [-size * 0.42, -size * 0.02, -size * 0.02, -size * 0.42],
    );
    const x = interpolate(p, [0, CONTACT, LIFT, 1], [size * 0.16, 0, 0, size * 0.16]);
    const rotate = interpolate(p, [0, CONTACT, LIFT, 1], [-16, -4, -4, -16]);
    // Un rebond court au contact, amorti — le poids de l'objet.
    const bounce =
      p > CONTACT && p < LIFT
        ? Math.sin(((p - CONTACT) / (LIFT - CONTACT)) * Math.PI * 3) *
          size *
          0.012 *
          (1 - (p - CONTACT) / (LIFT - CONTACT))
        : 0;

    return {
      transform: [{ translateX: x }, { translateY: y - bounce }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          width: size * 0.56,
          height: size * 0.35,
          borderRadius: size * 0.045,
          backgroundColor: colors.brand600,
          shadowColor: '#02120a',
          shadowOpacity: 0.4,
          shadowRadius: size * 0.05,
          shadowOffset: { width: 0, height: size * 0.03 },
          elevation: 12,
          overflow: 'hidden',
        },
      ]}
    >
      <View className="flex-1 justify-between" style={{ padding: size * 0.038 }}>
        <TkMark size={size * 0.07} />
        <AppText
          className="font-sans-semibold text-ink-inverse/80"
          style={{ fontSize: size * 0.042, letterSpacing: 2 }}
        >
          7014 2299
        </AppText>
      </View>
      {/* La bande lime : la signature de la carte, lisible même petite. */}
      <View style={{ height: size * 0.022, backgroundColor: colors.lime }} />
    </Animated.View>
  );
}

/** Une onde : un anneau qui s'ouvre et s'efface depuis le dessus du lecteur. */
function Ping({
  progress,
  size,
  delay,
}: {
  progress: SharedValue<number>;
  size: number;
  delay: number;
}) {
  const style = useAnimatedStyle(() => {
    // L'onde ne vit qu'après le contact : avant, elle n'a aucune raison d'être.
    const t = progress.value - CONTACT - delay;
    const span = 0.26;
    if (t < 0 || t > span) return { opacity: 0, transform: [{ scale: 0.4 }] };
    const p = t / span;
    return {
      opacity: (1 - p) * 0.55,
      transform: [{ scale: 0.4 + p * 1.5 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: 'absolute',
          bottom: size * 0.3,
          width: size * 0.52,
          height: size * 0.2,
          borderRadius: size * 0.26,
          borderWidth: Math.max(2, size * 0.008),
          borderColor: colors.lime,
        },
      ]}
    />
  );
}

/**
 * Le ticket dématérialisé — la promesse « zéro papier ».
 *
 * Il ne sort qu'APRÈS le contact : c'est ce décalage qui raconte la causalité.
 * Sorti d'emblée, il ressemblerait à une décoration.
 */
function Ticket({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const start = CONTACT + 0.08;
    if (p < start) return { opacity: 0, transform: [{ translateY: size * 0.06 }] };
    const out = Math.min(1, (p - start) / 0.18);
    const fade = p > LIFT + 0.16 ? Math.max(0, 1 - (p - LIFT - 0.16) / 0.14) : 1;
    return {
      opacity: out * fade,
      transform: [{ translateY: size * 0.06 - out * size * 0.13 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          position: 'absolute',
          right: size * 0.02,
          top: size * 0.12,
          width: size * 0.26,
          borderRadius: size * 0.03,
          backgroundColor: '#F6F8F2',
          padding: size * 0.032,
          gap: size * 0.018,
        },
      ]}
    >
      {[1, 0.6, 1, 0.45].map((w, i) => (
        <View
          key={i}
          style={{
            height: size * 0.012,
            width: `${w * 100}%`,
            borderRadius: size * 0.01,
            backgroundColor: '#C7CFBC',
          }}
        />
      ))}
      <View
        style={{
          marginTop: size * 0.012,
          alignSelf: 'flex-start',
          paddingHorizontal: size * 0.022,
          paddingVertical: size * 0.008,
          borderRadius: size * 0.02,
          backgroundColor: colors.lime,
        }}
      >
        <AppText className="font-sans-bold" style={{ fontSize: size * 0.036, color: colors.ink }}>
          ✓ Ticket
        </AppText>
      </View>
    </Animated.View>
  );
}
