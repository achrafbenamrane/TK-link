import { View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors } from '@/shared/theme/colors';

import { TkMark, TkWaves } from '../tk-mark';

/**
 * La même scène, sans 3D : carte posée sur le lecteur, ondes figées.
 *
 * Deux cas la font apparaître — l'utilisateur a demandé moins d'animations, ou
 * expo-gl n'a pas démarré. Dans les deux cas il faut une image qui tienne
 * DEBOUT toute seule : c'est une illustration à part entière, pas un carré
 * gris d'attente.
 */
export function CardReaderFlat({ size = 300 }: { size?: number }) {
  return (
    <View
      testID="welcome-card-flat"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Une carte TK LINK posée sur le lecteur"
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      {/* Ondes, en arrière-plan */}
      <View className="absolute" style={{ top: size * 0.3, right: size * 0.16, opacity: 0.5 }}>
        <TkWaves size={size * 0.26} />
      </View>

      {/* La carte */}
      <View
        className="overflow-hidden rounded-card bg-brand-600"
        style={{
          width: size * 0.62,
          height: size * 0.39,
          transform: [{ rotate: '-7deg' }],
          marginBottom: -size * 0.08,
        }}
      >
        <View className="flex-1 justify-between p-3">
          <TkMark size={size * 0.075} />
          <AppText
            className="font-sans-semibold text-ink-inverse/80"
            style={{ fontSize: size * 0.045, letterSpacing: 2 }}
          >
            7014 2299
          </AppText>
        </View>
        <View className="h-2 bg-lime" />
      </View>

      {/* Le lecteur */}
      <View
        className="items-center justify-center rounded-card"
        style={{
          width: size * 0.72,
          height: size * 0.26,
          backgroundColor: '#EDF1E7',
          borderBottomWidth: size * 0.03,
          borderBottomColor: '#AAB19F',
        }}
      >
        <View
          className="rounded-pill bg-brand-500"
          style={{ width: size * 0.4, height: size * 0.02 }}
        />
        <View
          className="absolute rounded-pill"
          style={{
            bottom: size * 0.03,
            width: size * 0.1,
            height: size * 0.022,
            backgroundColor: colors.ink,
          }}
        />
      </View>
    </View>
  );
}
