import * as ImagePicker from 'expo-image-picker';

/**
 * Prendre ou choisir une photo — partagé par la création d'un Flash (commerçant)
 * et les justificatifs du livreur : une feature n'importe pas sa voisine, et le
 * module natif reste isolé en un seul endroit.
 *
 * Renvoie `null` — jamais une erreur — si la personne refuse ou annule. La
 * permission se demande au moment du geste, jamais au lancement. L'adresse rendue
 * est LOCALE (cache de l'appareil) : sans serveur, rien ne l'envoie nulle part.
 */
export type PhotoSource = 'galerie' | 'camera';

export async function pickImage(
  source: PhotoSource,
  options: { aspect?: [number, number]; front?: boolean; media?: 'images' | 'videos' } = {},
): Promise<string | null> {
  try {
    const base: ImagePicker.ImagePickerOptions = {
      mediaTypes: options.media === 'videos' ? ['videos'] : ['images'],
      // Une vidéo se garde telle quelle : le recadrage d'image n'a pas de sens.
      allowsEditing: options.media !== 'videos',
      ...(options.media === 'videos' ? { videoMaxDuration: 30 } : {}),
      aspect: options.aspect ?? [4, 3],
      quality: 0.7,
    };

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return null;
      const result = await ImagePicker.launchCameraAsync({
        ...base,
        ...(options.front ? { cameraType: ImagePicker.CameraType.front } : {}),
      });
      return result.canceled ? null : (result.assets[0]?.uri ?? null);
    }

    const result = await ImagePicker.launchImageLibraryAsync(base);
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  } catch {
    return null;
  }
}

/**
 * LA VIDÉO DU MAGASIN — un format standard, pour qu'un fichier lourd n'écrase pas le serveur
 * (demande du client). Valeurs provisoires : 30 secondes et 50 Mo, à confirmer avec lui.
 */
export const VIDEO_LIMITS = { maxSeconds: 30, maxMegabytes: 50 } as const;

export type VideoCheck = { ok: true } | { ok: false; reason: 'trop_longue' | 'trop_lourde' };

/** Une vidéo respecte-t-elle le format ? `duration` en millisecondes, `fileSize` en octets (si connus). */
export function checkVideo(asset: {
  duration?: number | null;
  fileSize?: number | null;
}): VideoCheck {
  if (asset.duration != null && asset.duration > VIDEO_LIMITS.maxSeconds * 1000) {
    return { ok: false, reason: 'trop_longue' };
  }
  if (asset.fileSize != null && asset.fileSize > VIDEO_LIMITS.maxMegabytes * 1024 * 1024) {
    return { ok: false, reason: 'trop_lourde' };
  }
  return { ok: true };
}

/** Le message à montrer au commerçant quand sa vidéo est refusée. */
export const VIDEO_REFUSAL: Record<'trop_longue' | 'trop_lourde', string> = {
  trop_longue: `Cette vidéo est trop longue : ${VIDEO_LIMITS.maxSeconds} secondes au maximum.`,
  trop_lourde: `Cette vidéo est trop lourde : ${VIDEO_LIMITS.maxMegabytes} Mo au maximum.`,
};

export type PickedVideo =
  { ok: true; uri: string } | { ok: false; reason: 'annule' | 'trop_longue' | 'trop_lourde' };

/**
 * Prendre ou choisir une vidéo : refuse celle qui dépasse le format, en disant pourquoi (au lieu
 * de la laisser monter). Comme `pickImage`, ne lève jamais : un refus ou un échec rend `annule`.
 */
export async function pickVideo(source: PhotoSource): Promise<PickedVideo> {
  try {
    const base: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: VIDEO_LIMITS.maxSeconds,
    };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { ok: false, reason: 'annule' };
      result = await ImagePicker.launchCameraAsync(base);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(base);
    }
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return { ok: false, reason: 'annule' };
    const check = checkVideo(asset);
    return check.ok ? { ok: true, uri: asset.uri } : check;
  } catch {
    return { ok: false, reason: 'annule' };
  }
}
