import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AnimatedLogo } from './animated-logo';
import { Logo3D } from './logo-3d';

type Props = {
  onSettled?: () => void;
};

/**
 * Repli si la 3D échoue au montage. expo-gl est natif et peut buter sur la
 * Nouvelle Architecture ; une intro qui plante vaut moins qu'une intro 2D qui
 * marche. On retombe alors sur le logo Reanimated, indiscernable pour l'œil.
 */
class Logo3DBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Le logo d'accueil : 3D par défaut, 2D animé en repli (échec 3D) ou en mode
 * « réduire les animations » — où faire tourner une scène 3D n'aurait aucun sens.
 */
export function LogoHero({ onSettled }: Props) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <AnimatedLogo size={128} variant="onDark" onSettled={onSettled} />;
  }

  return (
    <Logo3DBoundary
      fallback={
        <View className="h-[260px] w-[260px] items-center justify-center">
          <AnimatedLogo size={128} variant="onDark" onSettled={onSettled} />
        </View>
      }
    >
      <Logo3D size={260} onSettled={onSettled} />
    </Logo3DBoundary>
  );
}
