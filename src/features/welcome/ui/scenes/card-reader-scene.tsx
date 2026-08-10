import { Component, type ReactNode } from 'react';

import { CardReader3D } from './card-reader-3d';
import { CardReaderFlat } from './card-reader-flat';

/**
 * Repli si la 3D échoue au montage. expo-gl est un module natif : il peut
 * manquer (Expo Go), buter sur la Nouvelle Architecture, ou tomber sur un
 * pilote GL récalcitrant. Un premier écran qui plante coûte l'installation
 * entière — une illustration fixe qui marche vaut mille fois une 3D fragile.
 */
class GlBoundary extends Component<
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

type Props = { size?: number; still?: boolean };

/**
 * La scène « carte + lecteur » : en volume quand on peut, à plat sinon.
 *
 * `still` (réduire les animations) passe DÉLIBÉRÉMENT par la version plate :
 * figer une scène 3D laisserait tourner une boucle de rendu GL pour afficher
 * une image fixe.
 */
export function CardReaderScene({ size = 300, still = false }: Props) {
  if (still) return <CardReaderFlat size={size} />;

  return (
    <GlBoundary fallback={<CardReaderFlat size={size} />}>
      <CardReader3D size={size} />
    </GlBoundary>
  );
}
