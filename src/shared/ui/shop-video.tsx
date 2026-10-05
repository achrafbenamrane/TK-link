import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './text';

export type ShopVideoProps = {
  /** La vidéo : un fichier du dépôt (`require`) ou une adresse (`{ uri }`). */
  source: VideoSource;
  /** L'image affichée avant la lecture. */
  poster?: string | undefined;
  /** Hauteur du lecteur ; la largeur suit le conteneur. */
  height?: number;
  testID?: string;
};

/** Le lecteur proprement dit : monté seulement quand on appuie sur lecture. */
function Player({
  source,
  height,
  testID,
}: {
  source: VideoSource;
  height: number;
  testID: string;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      testID={`${testID}-player`}
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', height }}
      accessibilityLabel="Vidéo du magasin"
    />
  );
}

/**
 * LA VIDÉO DU MAGASIN — « Vidéo du magasin » de la vitrine : une vignette avec le bouton lecture,
 * puis le lecteur (lecture, pause, barre de progression, plein écran).
 *
 * Le lecteur n'est créé qu'au premier appui : une vitrine qui s'ouvre ne charge pas une vidéo
 * que le client ne regardera peut-être pas.
 */
export function ShopVideo({ source, poster, height = 190, testID = 'shop-video' }: ShopVideoProps) {
  const [started, setStarted] = useState(false);

  return (
    <View
      testID={testID}
      className="overflow-hidden rounded-card border border-brand-500 bg-surface-inverse"
      style={{ height }}
    >
      {started ? (
        <Player source={source} height={height} testID={testID} />
      ) : (
        <Pressable
          testID={`${testID}-play`}
          accessibilityRole="button"
          accessibilityLabel="Lire la vidéo du magasin"
          onPress={() => setStarted(true)}
          className="flex-1 items-center justify-center"
        >
          {poster ? (
            <Image
              source={{ uri: poster }}
              style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }}
              contentFit="cover"
            />
          ) : null}
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-brand-500">
            <Feather name="play" size={28} color="#FFFFFF" />
          </View>
          <AppText className="mt-2 font-sans-semibold text-white" style={{ fontSize: 12 }}>
            Voir la vidéo
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
