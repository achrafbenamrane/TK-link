import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/shared/ui';
import { ThemeScope } from '@/shared/theme/theme-provider';

import { useWelcomeStore } from '../model/store';

/**
 * L'OUVERTURE — le logo « TKlink » prend son relief, en 3D.
 *
 * Une séquence rendue dans Blender (`assets/blender/ouverture.py`, 1080 × 1920, 2,2 s) : elle part du
 * logo plat de l'écran de lancement natif (même fond #0A0A0D, même taille), les lettres prennent
 * leur épaisseur l'une après l'autre, la caméra tourne doucement, un trait de lumière balaie le
 * logo. Le client voulait que « l'éclair arrive plus vite que le texte, comme la lumière » : c'est
 * maintenant de la vraie lumière qui passe, plus une icône d'éclair. La signature apparaît une fois
 * la lumière passée.
 *
 * Lue par `expo-video`, déjà présent dans l'APK (vitrines vidéo) : la mise à jour OTA suffit.
 *
 * Aucun bouton : l'écran ne demande rien. Il ne bloque jamais non plus : si la vidéo ne démarre pas
 * vite, l'image finale prend sa place et l'app continue. « Réduire les animations » : l'image finale,
 * tout de suite.
 */

/** Durée de la séquence (66 images à 30 i/s). */
export const OPENING_MS = 2200;
/** Le temps de garder la dernière image avant de passer à la suite. */
export const SPLASH_MS = OPENING_MS + 300;
/** Quand la signature apparaît, une fois le trait de lumière passé (depuis la première image). */
export const TAGLINE_AT_MS = 1500;
/** Au-delà, on n'attend plus la vidéo : image finale, et la suite. */
export const FIRST_FRAME_TIMEOUT_MS = 1200;
/** Durée de l'image fixe (repli, ou mouvement réduit). */
export const STILL_MS = 900;

const OPENING = require('../../../../assets/videos/ouverture.mp4');
const FIRST_FRAME = require('../../../../assets/images/ouverture-debut.webp');
const LAST_FRAME = require('../../../../assets/images/ouverture-fin.webp');

type Phase = 'loading' | 'playing' | 'still';

type Props = {
  /**
   * Appelé quand l'ouverture est finie — la route décide où aller : le choix du profil
   * au premier lancement, l'accueil quand le compte existe déjà.
   */
  onDone: () => void;
};

export function WelcomeScreen({ onDone }: Props) {
  const reduced = useReducedMotion();
  const markSeen = useWelcomeStore((s) => s.markSeen);
  const [phase, setPhase] = useState<Phase>(reduced ? 'still' : 'loading');
  const done = useRef(false);
  const tagline = useSharedValue(reduced ? 1 : 0);

  // Mouvement réduit : la vidéo n'est même pas chargée.
  const player = useVideoPlayer(reduced ? null : OPENING, (p) => {
    p.loop = false;
    p.muted = true;
    if (!reduced) p.play();
  });

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    markSeen();
    // L'ouverture ne se rejoue pas : une seule passe au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chaque phase a son minuteur : la vidéo qui joue, l'image fixe, ou l'attente de la première image.
  useEffect(() => {
    if (phase === 'playing') {
      tagline.value = withDelay(
        TAGLINE_AT_MS,
        withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
      );
      const t = setTimeout(finish, SPLASH_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'still') {
      tagline.value = withTiming(1, { duration: reduced ? 0 : 350 });
      const t = setTimeout(finish, STILL_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase('still'), FIRST_FRAME_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 8 }],
  }));

  return (
    <ThemeScope scheme="night">
      <View
        testID="welcome-screen"
        className="flex-1 bg-surface"
        accessible
        accessibilityRole="image"
        accessibilityLabel="TKlink — Le bon plan, partout."
      >
        <StatusBar style="light" />

        {/* L'image sous la vidéo : la première tant qu'elle se charge, la dernière en repli. */}
        <Image
          testID="welcome-logo"
          source={phase === 'still' ? LAST_FRAME : FIRST_FRAME}
          contentFit="cover"
          transition={phase === 'still' && !reduced ? 250 : 0}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />

        {phase !== 'still' ? (
          <VideoView
            testID="welcome-video"
            player={player}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            // Une vue de texture (pas de surface) : la vidéo se compose avec l'image dessous, sans
            // rectangle noir avant la première image.
            surfaceType="textureView"
            useExoShutter={false}
            onFirstFrameRender={() => {
              // Relancée ici aussi : un `play()` donné avant que la vue existe peut se perdre (le
              // web l'ignore). Sur téléphone, la lecture a déjà commencé : sans effet.
              player.play();
              setPhase((p) => (p === 'loading' ? 'playing' : p));
            }}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              opacity: phase === 'playing' ? 1 : 0,
            }}
          />
        ) : null}

        <View pointerEvents="none" className="flex-1 items-center justify-center">
          <Animated.View style={[{ marginTop: 124 }, taglineStyle]}>
            <AppText className="text-ink-muted" style={{ fontSize: 15, letterSpacing: 0.4 }}>
              Le bon plan, partout.
            </AppText>
          </Animated.View>
        </View>
      </View>
    </ThemeScope>
  );
}
